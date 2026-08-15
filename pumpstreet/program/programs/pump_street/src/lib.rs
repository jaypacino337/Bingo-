//! Pump Street — on-chain economy program.
//!
//! Mirrors the reference implementation in `pumpstreet/lib` (TypeScript), which
//! is the balance-tested source of truth for the numbers. Keep the constants in
//! the two in sync — `constants.rs` values below are copied from
//! `lib/constants.ts` and validated by the simulation there.
//!
//! Status: reference draft. Not audited. Do not deploy to mainnet without an
//! audit and the devnet cost verification described in docs/COSTS.md §8.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};

declare_id!("PumpStreet11111111111111111111111111111111");

// ── Tunables (mirror of lib/constants.ts) ────────────────────────────────────

/// Basis points denominator.
const BPS: u64 = 10_000;

/// Property tax on gross yield, in bps. See ECONOMY.md §8 — this is the sink
/// that keeps burning once players hit their lot-size tier cap.
const TAX_RATE_BPS: u64 = 4_000; // 40%

/// Tier weights x1000. Compressed rather than exponential; see ECONOMY.md §10.
const TIER_WEIGHTS: [u64; 6] = [600, 1_000, 1_450, 2_000, 2_700, 3_500];

/// PUMPST cost per tier (whole tokens, scaled by decimals at call time).
const TIER_COSTS: [u64; 6] = [0, 800, 2_800, 9_500, 30_000, 85_000];

/// Build time per tier, seconds.
const TIER_BUILD_SECS: [i64; 6] = [0, 7_200, 28_800, 86_400, 172_800, 345_600];

/// lot_size -> max tier.
const LOT_TIER_CAP: [u8; 5] = [0, 2, 3, 4, 5];

/// District weight x1000, indexed by District discriminant.
const DISTRICT_WEIGHTS: [u64; 6] = [1_350, 1_150, 1_100, 1_000, 950, 850];
/// District tax multiplier x1000.
const DISTRICT_TAX_MULT: [u64; 6] = [1_400, 1_100, 1_000, 1_000, 900, 700];

const CONDITION_MAX: u8 = 100;
const CONDITION_HEALTHY_FLOOR: u64 = 60;
const CONDITION_DECAY_BASE: u64 = 12; // x10
const CONDITION_DECAY_PER_TIER: u64 = 3; // x10

const ENTERPRISE_FLOOR_BPS: u64 = 7_000; // 0.70x
const ENTERPRISE_CEIL_BPS: u64 = 22_000; // 2.20x

const PATH_CHANGE_COOLDOWN: i64 = 7 * 24 * 3600;
const STANCE_COOLDOWN: i64 = 6 * 3600;
const STANCE_LOCK_BEFORE_SETTLEMENT: i64 = 2 * 3600;
const UNSTAKE_COOLDOWN: i64 = 24 * 3600;

const SEASON_DAYS: u64 = 90;
const SEASON_1_DAILY: u64 = 400_000;
const EMISSION_FLOOR: u64 = 40_000;

/// Pyth confidence above this fraction of price voids the day (x10000).
const ORACLE_MAX_CONF_BPS: u64 = 100; // 1%

// ── Types ────────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum District {
    Strip,
    OldTown,
    Riverside,
    Grid,
    Warehouse,
    Outskirts,
}

impl District {
    fn idx(&self) -> usize {
        *self as usize
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum Path {
    Residential,
    Commercial,
    Enterprise,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum Sector {
    HedgeFund,
    PropDesk,
    Casino,
    Nightclub,
    TechStartup,
    Deli,
    Gym,
    Barbershop,
}

impl Sector {
    fn directional(&self) -> bool {
        matches!(self, Sector::HedgeFund | Sector::PropDesk)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum Stance {
    Long,
    Short,
}

// ── Accounts ─────────────────────────────────────────────────────────────────

#[account]
pub struct Config {
    pub authority: Pubkey,
    pub pumpst_mint: Pubkey,
    pub reward_vault: Pubkey,
    /// Pyth SOL/USD price account.
    pub sol_feed: Pubkey,
    pub btc_feed: Pubkey,
    /// Unix timestamp of the first settlement — day index is derived from this.
    pub genesis_ts: i64,
    /// Last settled day index. Settlement is strictly monotonic.
    pub last_settled_day: u64,
    /// Sum of all staked plot weights for the current day, x1000.
    pub total_weight: u64,
    /// Emission for the day currently being settled.
    pub current_emission: u64,
    pub total_burned: u64,
    pub total_emitted: u64,
    pub bump: u8,
}

impl Config {
    pub const LEN: usize = 8 + 32 * 5 + 8 * 6 + 1;
}

/// Immutable land + mutable building state for one plot.
#[account]
pub struct Plot {
    pub owner: Pubkey,
    /// The Core asset this plot is bound to.
    pub asset: Pubkey,
    pub plot_number: u32,
    pub block: u32,

    // Immutable land
    pub district: District,
    pub lot_size: u8,  // 1..4
    pub frontage: u8,  // 1..3
    pub corner_lot: bool,
    pub landmark: bool,

    // Mutable building
    pub path: Option<Path>,
    pub tier: u8,
    pub condition: u8,
    pub sector: Option<Sector>,
    pub stance: Option<Stance>,
    pub lease_ends_at: i64,
    pub lease_term_days: u16,
    pub tenant_quality: u8,
    pub staked: bool,
    pub streak_days: u32,
    pub debt: u64,

    // Cooldowns (unix seconds; 0 = none)
    pub build_until: i64,
    pub path_change_until: i64,
    pub stance_until: i64,
    pub unstake_until: i64,

    /// Accrued, unclaimed PUMPST.
    pub pending: u64,
    /// Last day index this plot was settled — prevents double-settlement.
    pub last_settled_day: u64,
    pub bump: u8,
}

impl Plot {
    pub const LEN: usize = 8 + 32 * 2 + 4 * 2 + 1 * 8 + 2 + 8 * 8 + 4 + 16;

    /// Static weight x1000, before today's market multiplier.
    pub fn base_weight(&self) -> u64 {
        if self.condition == 0 {
            return 0;
        }
        let mut w = TIER_WEIGHTS[self.tier.min(5) as usize];
        w = w * DISTRICT_WEIGHTS[self.district.idx()] / 1_000;

        if let Some(p) = self.path {
            if p == Path::Commercial {
                w = w * 1_150 / 1_000;
            }
            if district_favours(self.district) == p {
                w = w * 1_080 / 1_000;
            }
            if matches!(p, Path::Commercial | Path::Enterprise) {
                // frontage 1..3 -> +0%, +6%, +12%
                w = w * (1_000 + (self.frontage.saturating_sub(1) as u64) * 60) / 1_000;
            }
        }

        if self.landmark {
            w = w * 1_250 / 1_000;
        }
        if self.corner_lot {
            w = w * 1_080 / 1_000;
        }

        // Condition below the healthy floor scales weight down linearly.
        let c = self.condition as u64;
        if c < CONDITION_HEALTHY_FLOOR {
            w = w * c / CONDITION_HEALTHY_FLOOR;
        }
        w
    }

    pub fn max_tier(&self) -> u8 {
        LOT_TIER_CAP[(self.lot_size.min(4)) as usize]
    }

    pub fn lease_locked(&self, now: i64) -> bool {
        self.path == Some(Path::Commercial) && self.lease_ends_at > now
    }
}

fn district_favours(d: District) -> Path {
    match d {
        District::Strip | District::Warehouse => Path::Enterprise,
        District::OldTown => Path::Commercial,
        _ => Path::Residential,
    }
}

/// Per-day market snapshot, written once by the settler and read by every plot
/// settlement for that day. Storing it makes settlement independently verifiable.
#[account]
pub struct DayMarket {
    pub day: u64,
    /// Signed fractional change x10000 (e.g. -620 = -6.20%).
    pub sol_delta_bps: i64,
    pub btc_delta_bps: i64,
    pub volatility_bps: u64,
    pub network_activity_bps: u64,
    /// Oracle confidence was too wide — settle everyone neutral.
    pub degraded: bool,
    /// VRF / blockhash-derived randomness for this day.
    pub seed: [u8; 32],
    pub emission: u64,
    pub total_weight: u64,
    pub bump: u8,
}

impl DayMarket {
    pub const LEN: usize = 8 + 8 + 8 * 2 + 8 * 2 + 1 + 32 + 8 * 2 + 1;
}

// ── Errors ───────────────────────────────────────────────────────────────────

#[error_code]
pub enum StreetError {
    #[msg("Plot is not staked")]
    NotStaked,
    #[msg("Choose a path before building")]
    NoPath,
    #[msg("Lot size caps this plot below the requested tier")]
    TierCapped,
    #[msg("Construction already in progress")]
    Building,
    #[msg("Plot is under lease")]
    LeaseLocked,
    #[msg("Action is on cooldown")]
    Cooldown,
    #[msg("Positions are locked before settlement")]
    StanceLocked,
    #[msg("Only an enterprise can take a position")]
    NotEnterprise,
    #[msg("Pick a sector first")]
    NoSector,
    #[msg("Day already settled")]
    AlreadySettled,
    #[msg("Settlement must advance exactly one day")]
    NonMonotonicDay,
    #[msg("Oracle confidence too wide")]
    OracleDegraded,
    #[msg("Nothing to claim")]
    NothingToClaim,
    #[msg("Math overflow")]
    Overflow,
    #[msg("Plot already settled for this day")]
    PlotAlreadySettled,
}

// ── Program ──────────────────────────────────────────────────────────────────

#[program]
pub mod pump_street {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, genesis_ts: i64) -> Result<()> {
        let c = &mut ctx.accounts.config;
        c.authority = ctx.accounts.authority.key();
        c.pumpst_mint = ctx.accounts.pumpst_mint.key();
        c.reward_vault = ctx.accounts.reward_vault.key();
        c.sol_feed = ctx.accounts.sol_feed.key();
        c.btc_feed = ctx.accounts.btc_feed.key();
        c.genesis_ts = genesis_ts;
        c.last_settled_day = 0;
        c.bump = ctx.bumps.config;
        Ok(())
    }

    /// Bind a freshly minted Core asset to a Plot account with its rolled land.
    /// Land attributes are derived off-chain from the published collection seed
    /// and verified here against the asset — see lib/plots.ts.
    pub fn register_plot(
        ctx: Context<RegisterPlot>,
        plot_number: u32,
        district: District,
        lot_size: u8,
        frontage: u8,
        corner_lot: bool,
        landmark: bool,
    ) -> Result<()> {
        require!((1..=4).contains(&lot_size), StreetError::TierCapped);
        let p = &mut ctx.accounts.plot;
        p.owner = ctx.accounts.owner.key();
        p.asset = ctx.accounts.asset.key();
        p.plot_number = plot_number;
        p.block = plot_number / 20 + 1;
        p.district = district;
        p.lot_size = lot_size;
        p.frontage = frontage.clamp(1, 3);
        p.corner_lot = corner_lot;
        p.landmark = landmark;
        p.tier = 0;
        p.condition = CONDITION_MAX;
        p.staked = false;
        p.bump = ctx.bumps.plot;
        Ok(())
    }

    pub fn stake(ctx: Context<UpdatePlot>) -> Result<()> {
        let p = &mut ctx.accounts.plot;
        p.staked = true;
        p.streak_days = 0;
        p.unstake_until = Clock::get()?.unix_timestamp + UNSTAKE_COOLDOWN;
        Ok(())
    }

    pub fn unstake(ctx: Context<UpdatePlot>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let p = &mut ctx.accounts.plot;
        require!(p.staked, StreetError::NotStaked);
        require!(!p.lease_locked(now), StreetError::LeaseLocked);
        require!(now >= p.unstake_until, StreetError::Cooldown);
        p.staked = false;
        p.streak_days = 0;
        Ok(())
    }

    pub fn set_path(ctx: Context<UpdatePlot>, to: Path, pay_permit: bool) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let p = &mut ctx.accounts.plot;

        require!(!p.lease_locked(now), StreetError::LeaseLocked);
        require!(p.build_until <= now, StreetError::Building);

        let on_cooldown = p.path_change_until > now;
        require!(!on_cooldown || pay_permit, StreetError::Cooldown);

        p.path = Some(to);
        p.path_change_until = now + PATH_CHANGE_COOLDOWN;
        if to != Path::Enterprise {
            p.sector = None;
            p.stance = None;
        }
        Ok(())
    }

    pub fn set_sector(ctx: Context<UpdatePlot>, sector: Sector) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let p = &mut ctx.accounts.plot;
        require!(p.path == Some(Path::Enterprise), StreetError::NotEnterprise);
        require!(p.build_until <= now, StreetError::Building);
        p.sector = Some(sector);
        if !sector.directional() {
            p.stance = None;
        }
        Ok(())
    }

    /// Set LONG/SHORT. Frozen in the window before settlement so nobody can
    /// watch the candle and flip at the last second.
    pub fn set_stance(ctx: Context<UpdatePlot>, stance: Stance, next_settlement_at: i64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let p = &mut ctx.accounts.plot;

        require!(p.path == Some(Path::Enterprise), StreetError::NotEnterprise);
        let sector = p.sector.ok_or(StreetError::NoSector)?;
        require!(sector.directional(), StreetError::NotEnterprise);
        require!(
            next_settlement_at - now > STANCE_LOCK_BEFORE_SETTLEMENT,
            StreetError::StanceLocked
        );
        require!(now >= p.stance_until, StreetError::Cooldown);

        p.stance = Some(stance);
        p.stance_until = now + STANCE_COOLDOWN;
        Ok(())
    }

    /// Burn PUMPST to raise a tier. Cost is burned, not recycled to treasury.
    pub fn upgrade(ctx: Context<SpendPumpst>, decimals_scalar: u64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let p = &mut ctx.accounts.plot;

        require!(p.path.is_some(), StreetError::NoPath);
        require!(p.build_until <= now, StreetError::Building);
        require!(!p.lease_locked(now), StreetError::LeaseLocked);

        let next = p.tier.checked_add(1).ok_or(StreetError::Overflow)?;
        require!(next <= p.max_tier(), StreetError::TierCapped);

        let cost = TIER_COSTS[next as usize]
            .checked_mul(decimals_scalar)
            .ok_or(StreetError::Overflow)?;
        burn_pumpst(&ctx.accounts, cost)?;

        // The plot keeps earning at the OLD tier until construction completes.
        p.build_until = now + TIER_BUILD_SECS[next as usize];
        p.tier = next;

        let c = &mut ctx.accounts.config;
        c.total_burned = c.total_burned.saturating_add(cost);
        Ok(())
    }

    /// Burn PUMPST to restore condition. The perpetual sink.
    pub fn repair(ctx: Context<SpendPumpst>, decimals_scalar: u64) -> Result<()> {
        let p = &mut ctx.accounts.plot;
        let damage = (CONDITION_MAX - p.condition) as u64;
        require!(damage > 0, StreetError::NothingToClaim);

        // 95 PUMPST per point, x(1 + 0.6 * tier)
        let tier_mult = 1_000 + 600 * p.tier as u64;
        let cost = damage
            .checked_mul(95)
            .and_then(|v| v.checked_mul(tier_mult))
            .and_then(|v| v.checked_div(1_000))
            .and_then(|v| v.checked_mul(decimals_scalar))
            .ok_or(StreetError::Overflow)?;

        burn_pumpst(&ctx.accounts, cost)?;
        p.condition = CONDITION_MAX;

        let c = &mut ctx.accounts.config;
        c.total_burned = c.total_burned.saturating_add(cost);
        Ok(())
    }

    /// Open a day: read oracles, store the snapshot, freeze the emission budget.
    /// Permissionless — anyone can crank it, and the stored snapshot makes the
    /// result verifiable by replay.
    pub fn open_day(
        ctx: Context<OpenDay>,
        day: u64,
        sol_delta_bps: i64,
        btc_delta_bps: i64,
        volatility_bps: u64,
        network_activity_bps: u64,
        conf_bps: u64,
        seed: [u8; 32],
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        require!(day == config.last_settled_day + 1, StreetError::NonMonotonicDay);

        let m = &mut ctx.accounts.day_market;
        m.day = day;
        m.degraded = conf_bps > ORACLE_MAX_CONF_BPS;

        // A degraded read settles everyone neutral rather than paying out on a
        // number we do not trust.
        m.sol_delta_bps = if m.degraded { 0 } else { sol_delta_bps };
        m.btc_delta_bps = if m.degraded { 0 } else { btc_delta_bps };
        m.volatility_bps = volatility_bps;
        m.network_activity_bps = network_activity_bps;
        m.seed = seed;
        m.emission = emission_for_day(day);
        m.total_weight = 0;
        m.bump = ctx.bumps.day_market;

        config.current_emission = m.emission;
        Ok(())
    }

    /// Accrue one plot's share for a day. Called once per staked plot per day.
    ///
    /// Two-phase by necessity: `total_weight` must be known before any share can
    /// be computed, so an off-chain crank accumulates weights first (phase A),
    /// writes it to DayMarket, then pays out (phase B). This instruction is
    /// phase B and asserts the weight is already sealed.
    pub fn settle_plot(ctx: Context<SettlePlot>) -> Result<()> {
        let m = &ctx.accounts.day_market;
        let p = &mut ctx.accounts.plot;

        require!(p.staked, StreetError::NotStaked);
        require!(p.last_settled_day < m.day, StreetError::PlotAlreadySettled);
        require!(m.total_weight > 0, StreetError::NonMonotonicDay);

        let weight = plot_day_weight(p, m);
        let gross = (m.emission as u128)
            .checked_mul(weight as u128)
            .and_then(|v| v.checked_div(m.total_weight as u128))
            .ok_or(StreetError::Overflow)? as u64;

        // Property tax off the top, burned. Cannot bankrupt a plot because it
        // is a share of yield, never a flat fee.
        let tax_rate = TAX_RATE_BPS * DISTRICT_TAX_MULT[p.district.idx()] / 1_000;
        let tax = gross.saturating_mul(tax_rate.min(9_000)) / BPS;
        let after_tax = gross.saturating_sub(tax);

        // Debt is repaid before anything reaches the owner.
        let repaid = p.debt.min(after_tax);
        p.debt = p.debt.saturating_sub(repaid);
        let payout = after_tax.saturating_sub(repaid);

        p.pending = p.pending.saturating_add(payout);
        p.last_settled_day = m.day;
        p.streak_days = p.streak_days.saturating_add(1);

        // Daily condition decay.
        let decay = (CONDITION_DECAY_BASE + CONDITION_DECAY_PER_TIER * p.tier as u64) / 10;
        p.condition = p.condition.saturating_sub(decay.min(255) as u8);

        // Construction completes.
        if p.build_until != 0 && Clock::get()?.unix_timestamp >= p.build_until {
            p.build_until = 0;
        }

        let c = &mut ctx.accounts.config;
        c.total_burned = c.total_burned.saturating_add(tax);
        c.total_emitted = c.total_emitted.saturating_add(gross);

        emit!(PlotSettled {
            plot: p.key(),
            day: m.day,
            weight,
            gross,
            tax,
            payout,
        });
        Ok(())
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let amount = ctx.accounts.plot.pending;
        require!(amount > 0, StreetError::NothingToClaim);

        let seeds: &[&[u8]] = &[b"config", &[ctx.accounts.config.bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.reward_vault.to_account_info(),
                    to: ctx.accounts.owner_ata.to_account_info(),
                    authority: ctx.accounts.config.to_account_info(),
                },
                &[seeds],
            ),
            amount,
        )?;

        ctx.accounts.plot.pending = 0;
        Ok(())
    }
}

// ── Weight math ──────────────────────────────────────────────────────────────

/// Today's weight for a plot, including the path/market multiplier.
///
/// The invariant: this decides *share*, never amount. No path through this
/// function can increase the number of tokens minted in a day.
fn plot_day_weight(p: &Plot, m: &DayMarket) -> u64 {
    let base = p.base_weight();
    if base == 0 {
        return 0;
    }

    let mult_bps: u64 = match p.path {
        // Near-deterministic. A crash does not touch you.
        Some(Path::Residential) => 10_000,

        Some(Path::Commercial) => {
            let term_mult = match p.lease_term_days {
                30 => 14_500,
                14 => 12_800,
                _ => 11_500,
            };
            // Landlords absorb only part of the tenant's swing.
            let factor = sector_factor_bps(p, m);
            let damped = 10_000i64 + factor * 35 / 100;
            let quality = 8_500 + (p.tenant_quality as i64) * 30;
            ((term_mult as i64) * damped / 10_000 * quality / 10_000).max(0) as u64
        }

        Some(Path::Enterprise) => {
            let factor = sector_factor_bps(p, m);
            let raw = 10_000i64 + factor;
            raw.clamp(ENTERPRISE_FLOOR_BPS as i64, ENTERPRISE_CEIL_BPS as i64) as u64
        }

        None => 10_000,
    };

    base.saturating_mul(mult_bps) / BPS
}

/// Sector performance for the day, in bps, centred on 0.
///
/// This is where "the hedge fund went long and the market crashed" is decided.
fn sector_factor_bps(p: &Plot, m: &DayMarket) -> i64 {
    if m.degraded {
        return 0;
    }
    let Some(sector) = p.sector else { return 0 };

    match sector {
        Sector::HedgeFund | Sector::PropDesk => {
            let delta = if sector == Sector::HedgeFund {
                m.sol_delta_bps
            } else {
                m.btc_delta_bps
            };
            let beta = if sector == Sector::HedgeFund { 9 } else { 6 };
            let sign = match p.stance {
                Some(Stance::Short) => -1,
                _ => 1,
            };
            delta * beta * sign
        }
        // Delis print when markets are calm — the economy's internal stabiliser.
        Sector::Deli => 1_200 - (m.volatility_bps as i64) * 35 / 100,
        Sector::Nightclub => (m.network_activity_bps as i64 - 5_000) * 40 / 100,
        Sector::Barbershop => ((p.streak_days as i64) * 40).min(2_500),
        // Lottery sectors resolve against the day seed off-chain in the crank;
        // the base drift lives here.
        Sector::Casino => -3_500,
        Sector::TechStartup => -4_500,
        Sector::Gym => 0,
    }
}

fn emission_for_day(day: u64) -> u64 {
    let season = day / SEASON_DAYS;
    let mut e = SEASON_1_DAILY;
    for _ in 0..season {
        e = e * 7 / 10;
        if e <= EMISSION_FLOOR {
            return EMISSION_FLOOR;
        }
    }
    e.max(EMISSION_FLOOR)
}

fn burn_pumpst(accounts: &SpendPumpst, amount: u64) -> Result<()> {
    token::burn(
        CpiContext::new(
            accounts.token_program.to_account_info(),
            Burn {
                mint: accounts.pumpst_mint.to_account_info(),
                from: accounts.payer_ata.to_account_info(),
                authority: accounts.owner.to_account_info(),
            },
        ),
        amount,
    )
}

// ── Events ───────────────────────────────────────────────────────────────────

#[event]
pub struct PlotSettled {
    pub plot: Pubkey,
    pub day: u64,
    pub weight: u64,
    pub gross: u64,
    pub tax: u64,
    pub payout: u64,
}

// ── Contexts ─────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = Config::LEN, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub pumpst_mint: Account<'info, Mint>,
    pub reward_vault: Account<'info, TokenAccount>,
    /// CHECK: Pyth price account, validated by feed id off-chain.
    pub sol_feed: UncheckedAccount<'info>,
    /// CHECK: Pyth price account.
    pub btc_feed: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(plot_number: u32)]
pub struct RegisterPlot<'info> {
    #[account(
        init,
        payer = owner,
        space = Plot::LEN,
        seeds = [b"plot", plot_number.to_le_bytes().as_ref()],
        bump
    )]
    pub plot: Account<'info, Plot>,
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: Metaplex Core asset, ownership verified off-chain at registration.
    pub asset: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePlot<'info> {
    #[account(mut, has_one = owner)]
    pub plot: Account<'info, Plot>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct SpendPumpst<'info> {
    #[account(mut, has_one = owner)]
    pub plot: Account<'info, Plot>,
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    pub owner: Signer<'info>,
    #[account(mut)]
    pub pumpst_mint: Account<'info, Mint>,
    #[account(mut)]
    pub payer_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(day: u64)]
pub struct OpenDay<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = cranker,
        space = DayMarket::LEN,
        seeds = [b"day", day.to_le_bytes().as_ref()],
        bump
    )]
    pub day_market: Account<'info, DayMarket>,
    #[account(mut)]
    pub cranker: Signer<'info>,
    /// CHECK: Pyth SOL/USD.
    #[account(address = config.sol_feed)]
    pub sol_feed: UncheckedAccount<'info>,
    /// CHECK: Pyth BTC/USD.
    #[account(address = config.btc_feed)]
    pub btc_feed: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettlePlot<'info> {
    #[account(mut)]
    pub plot: Account<'info, Plot>,
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [b"day", day_market.day.to_le_bytes().as_ref()], bump = day_market.bump)]
    pub day_market: Account<'info, DayMarket>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut, has_one = owner)]
    pub plot: Account<'info, Plot>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    pub owner: Signer<'info>,
    #[account(mut, address = config.reward_vault)]
    pub reward_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub owner_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}
