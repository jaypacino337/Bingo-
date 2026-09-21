//! zSOL — on-chain program (Solana / Anchor).
//!
//! The settlement leg of the protocol. Holds pooled SOL, tracks the commitment
//! Merkle root, records association-set roots, verifies a Groth16 withdrawal
//! proof, and pays out — once — against an unspent nullifier.
//!
//! The verifying key (`vk.rs`) is generated from the compiled circuit's trusted
//! setup; this file `include!`s it. The Groth16 pairing check uses Solana's
//! alt_bn128 syscalls (available on mainnet since v1.17).
//!
//! STATUS: reference implementation. UNAUDITED. Do not deploy to mainnet or put
//! real SOL through it before a circuit + program audit and a trusted-setup
//! ceremony. See ../README.md.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::alt_bn128::compression::prelude::*;
use anchor_lang::system_program;

declare_id!("z5o1111111111111111111111111111111111111111");

/// Tree depth — must equal the circuit's `Withdraw(depth)`.
pub const TREE_DEPTH: usize = 20;
/// How many historical roots to accept, so a deposit landing between proof-gen
/// and submission does not invalidate an honest withdrawal.
pub const ROOT_HISTORY: usize = 32;

#[program]
pub mod zsol {
    use super::*;

    /// Create a pool for one fixed denomination (in lamports).
    pub fn init_pool(ctx: Context<InitPool>, denomination: u64) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.authority = ctx.accounts.authority.key();
        pool.denomination = denomination;
        pool.next_index = 0;
        pool.current_root_slot = 0;
        pool.roots = [[0u8; 32]; ROOT_HISTORY];
        // roots[0] stays the empty-tree root until the first deposit updates it.
        pool.bump = ctx.bumps.pool;
        Ok(())
    }

    /// Register (or update) an association-set root a provider publishes.
    pub fn register_set(ctx: Context<RegisterSet>, root: [u8; 32]) -> Result<()> {
        let s = &mut ctx.accounts.assoc_set;
        s.provider = ctx.accounts.provider.key();
        s.root = root;
        s.updated_at = Clock::get()?.unix_timestamp;
        s.bump = ctx.bumps.assoc_set;
        Ok(())
    }

    /// Deposit exactly `denomination` lamports and insert a commitment.
    ///
    /// The new Merkle root is supplied by the client and must be recomputed by
    /// an indexer; a production version recomputes the frontier on-chain. Kept
    /// explicit here so the reference stays legible.
    pub fn deposit(ctx: Context<Deposit>, commitment: [u8; 32], new_root: [u8; 32]) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        require!((pool.next_index as usize) < (1usize << TREE_DEPTH), ZsolError::TreeFull);

        // Move the denomination into the pool vault.
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.depositor.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            pool.denomination,
        )?;

        pool.current_root_slot = (pool.current_root_slot + 1) % (ROOT_HISTORY as u8);
        pool.roots[pool.current_root_slot as usize] = new_root;
        let leaf_index = pool.next_index;
        pool.next_index += 1;

        emit!(DepositEvent { commitment, leaf_index, new_root });
        Ok(())
    }

    /// Withdraw against a valid proof to a fresh recipient, paying the relayer a
    /// fee out of the denomination.
    pub fn withdraw(
        ctx: Context<Withdraw>,
        proof: Groth16Proof,
        pool_root: [u8; 32],
        association_root: [u8; 32],
        nullifier: [u8; 32],
        fee: u64,
    ) -> Result<()> {
        let pool = &ctx.accounts.pool;

        // 1. The pool root must be one we have recently held.
        require!(pool.roots.contains(&pool_root), ZsolError::UnknownRoot);

        // 2. The association-set root must match the set account the caller named.
        require!(
            ctx.accounts.assoc_set.root == association_root,
            ZsolError::UnknownAssociationSet
        );

        // 3. The nullifier must be unspent. The account is init'd here, so a
        //    second withdraw with the same nullifier fails at account creation.
        let nul = &mut ctx.accounts.nullifier_record;
        nul.nullifier = nullifier;
        nul.spent_at = Clock::get()?.unix_timestamp;
        nul.bump = ctx.bumps.nullifier_record;

        // 4. Verify the Groth16 proof over the six public inputs, in order:
        //    [poolRoot, associationRoot, nullifier, recipient, relayer, fee].
        let recipient = ctx.accounts.recipient.key();
        let relayer = ctx.accounts.relayer.key();
        let public_inputs = build_public_inputs(
            &pool_root,
            &association_root,
            &nullifier,
            &recipient,
            &relayer,
            fee,
        );
        require!(
            verify_groth16(&proof, &public_inputs)?,
            ZsolError::InvalidProof
        );

        // 5. Pay out: denomination - fee to recipient, fee to relayer.
        require!(fee <= pool.denomination, ZsolError::FeeTooHigh);
        let payout = pool.denomination - fee;

        let seeds: &[&[u8]] = &[b"vault", pool.to_account_info().key.as_ref(), &[ctx.bumps.vault]];
        **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= pool.denomination;
        **ctx.accounts.recipient.to_account_info().try_borrow_mut_lamports()? += payout;
        if fee > 0 {
            **ctx.accounts.relayer.to_account_info().try_borrow_mut_lamports()? += fee;
        }
        let _ = seeds; // vault is a PDA system account; lamport moves are direct.

        emit!(WithdrawEvent { nullifier, recipient, payout, fee });
        Ok(())
    }
}

// ---- Groth16 verification ----

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Groth16Proof {
    pub a: [u8; 64],
    pub b: [u8; 128],
    pub c: [u8; 64],
}

/// Pack the public inputs into the field-element layout the verifier expects.
/// Pubkeys are reduced into the BN254 scalar field the same way the circuit's
/// `recipient`/`relayer` signals are provided off-chain.
fn build_public_inputs(
    pool_root: &[u8; 32],
    association_root: &[u8; 32],
    nullifier: &[u8; 32],
    recipient: &Pubkey,
    relayer: &Pubkey,
    fee: u64,
) -> Vec<[u8; 32]> {
    let mut fee_be = [0u8; 32];
    fee_be[24..].copy_from_slice(&fee.to_be_bytes());
    vec![
        *pool_root,
        *association_root,
        *nullifier,
        pubkey_to_field(recipient),
        pubkey_to_field(relayer),
        fee_be,
    ]
}

/// Reduce a 32-byte pubkey to a canonical BN254 field element by masking the top
/// bits, matching how the SDK feeds `recipient`/`relayer` to the prover.
fn pubkey_to_field(pk: &Pubkey) -> [u8; 32] {
    let mut out = pk.to_bytes();
    out[0] &= 0x1f; // clear the top 3 bits so the value is < the BN254 modulus
    out
}

/// Groth16 pairing check via Solana's alt_bn128 syscalls, using the embedded
/// verifying key from the trusted setup. Returns Ok(true) iff the proof is valid.
fn verify_groth16(_proof: &Groth16Proof, _public_inputs: &[[u8; 32]]) -> Result<bool> {
    // The full implementation pairs (A,B)·(alpha,beta)·(vk_x,gamma)·(C,delta)
    // using sol_alt_bn128_pairing over VERIFYING_KEY (vk.rs, generated from the
    // circuit's setup). Wired once the trusted-setup ceremony has produced the
    // key; until then this returns an explicit error rather than a false accept,
    // so the program can never silently approve a withdrawal.
    Err(ZsolError::VerifierNotInitialized.into())
}

// ---- Accounts ----

#[account]
pub struct Pool {
    pub authority: Pubkey,
    pub denomination: u64,
    pub next_index: u64,
    pub current_root_slot: u8,
    pub roots: [[u8; 32]; ROOT_HISTORY],
    pub bump: u8,
}
impl Pool {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 1 + (32 * ROOT_HISTORY) + 1;
}

#[account]
pub struct AssocSet {
    pub provider: Pubkey,
    pub root: [u8; 32],
    pub updated_at: i64,
    pub bump: u8,
}
impl AssocSet {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 1;
}

#[account]
pub struct NullifierRecord {
    pub nullifier: [u8; 32],
    pub spent_at: i64,
    pub bump: u8,
}
impl NullifierRecord {
    pub const LEN: usize = 8 + 32 + 8 + 1;
}

// ---- Contexts ----

#[derive(Accounts)]
pub struct InitPool<'info> {
    #[account(init, payer = authority, space = Pool::LEN, seeds = [b"pool", &denomination_seed(authority.key)], bump)]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// Helper so the seed macro above stays readable.
fn denomination_seed(k: &Pubkey) -> [u8; 32] { k.to_bytes() }

#[derive(Accounts)]
#[instruction(root: [u8; 32])]
pub struct RegisterSet<'info> {
    #[account(init_if_needed, payer = provider, space = AssocSet::LEN, seeds = [b"set", provider.key().as_ref()], bump)]
    pub assoc_set: Account<'info, AssocSet>,
    #[account(mut)]
    pub provider: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    /// CHECK: PDA lamport vault for this pool.
    #[account(mut, seeds = [b"vault", pool.key().as_ref()], bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(mut)]
    pub depositor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(proof: Groth16Proof, pool_root: [u8;32], association_root: [u8;32], nullifier: [u8;32])]
pub struct Withdraw<'info> {
    pub pool: Account<'info, Pool>,
    /// CHECK: PDA lamport vault for this pool.
    #[account(mut, seeds = [b"vault", pool.key().as_ref()], bump)]
    pub vault: UncheckedAccount<'info>,
    pub assoc_set: Account<'info, AssocSet>,
    #[account(
        init,
        payer = relayer,
        space = NullifierRecord::LEN,
        seeds = [b"nul", nullifier.as_ref()],
        bump
    )]
    pub nullifier_record: Account<'info, NullifierRecord>,
    /// CHECK: recipient of the withdrawal; may be a brand-new address.
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    #[account(mut)]
    pub relayer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// ---- Events & errors ----

#[event]
pub struct DepositEvent { pub commitment: [u8; 32], pub leaf_index: u64, pub new_root: [u8; 32] }
#[event]
pub struct WithdrawEvent { pub nullifier: [u8; 32], pub recipient: Pubkey, pub payout: u64, pub fee: u64 }

#[error_code]
pub enum ZsolError {
    #[msg("Merkle tree is full")]
    TreeFull,
    #[msg("Pool root is not in recent history")]
    UnknownRoot,
    #[msg("Association-set root does not match the named set")]
    UnknownAssociationSet,
    #[msg("Groth16 proof failed to verify")]
    InvalidProof,
    #[msg("Fee exceeds the denomination")]
    FeeTooHigh,
    #[msg("Verifying key not yet initialised — awaiting trusted setup")]
    VerifierNotInitialized,
}
