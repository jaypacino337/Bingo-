# zSOL Protocol

The real protocol — not the landing page. Three legs: an off-chain SDK, a
zero-knowledge circuit, and a Solana program. This is the honest start of "making
it work."

> **UNAUDITED. NOT DEPLOYED. NO REAL SOL.** The SDK runs and is tested today. The
> circuit and program are written and internally consistent but require
> compilation, a trusted-setup ceremony, wiring the verifier, devnet testing, and
> a security audit before they can touch mainnet or real funds. Skipping any of
> that is how pools get drained. See "Build path" below.

## What actually works right now

```
protocol/sdk/        ✅ runs, 10/10 tests passing
protocol/circuits/   ✅ compiles, proves, and VERIFIES end-to-end (real zk proof)
protocol/programs/   ✍️  written — needs verifier wiring + anchor build + audit
```

**The zero-knowledge proof system works.** `bash circuits/build.sh` compiles the
circuit (10,350 constraints), builds a witness from the SDK, runs a Groth16 setup,
generates a proof, and verifies it — then confirms the proof's public signals
match the SDK's values and that a tampered proof is **rejected**. That is a
genuine, working shielded-withdrawal proof, generated and checked end-to-end. The
trusted setup used there is a local throwaway; production needs a real ceremony.

The SDK (`sdk/`) is the cryptographic core, and it is real, runnable code:

- **Commitments** — `Poseidon(nullifierSecret, pool, blinding)`, real Poseidon via `circomlibjs`.
- **Merkle tree** — incremental, fixed-depth, with membership proofs that verify.
- **Nullifiers** — `Poseidon(nullifierSecret, leafIndex)`, one-way, unlinkable.
- **Withdrawal assembly** — builds the exact public/private inputs a proof needs,
  and refuses to assemble a withdrawal for a deposit that isn't in the chosen
  association set — the core "flagged funds can't exit" guarantee.

Run it:

```bash
cd protocol/sdk
npm install       # if it errors on 'edgesOut', see the note below
npm test          # 10 passing — commitments, merkle, nullifiers, the flagged-deposit block
```

> npm install note: some npm versions hit an `edgesOut` bug on this dep tree.
> Workaround: `npm install --no-save circomlibjs@0.1.7 && npm install --no-save vitest typescript`.

The test that matters most:

```
✓ a FLAGGED deposit cannot be withdrawn — this is the core guarantee
```

It builds a pool with an honest deposit and a thief's deposit, has the provider
vouch for only the honest one, and proves the thief's withdrawal **cannot even be
assembled** against that set. That is the whole difference from a mixer, and it
is enforced in code, not prose.

## The circuit (`circuits/withdraw.circom`)

Enforces, in zero knowledge, the same four facts the SDK checks in the clear:
commitment membership in the pool, leaf membership in the association set,
correct nullifier derivation, and binding of recipient/relayer/fee. The circom
and the SDK implement identical arithmetic — they must, or no proof verifies.

Compile + set up (needs `circom` and `snarkjs` installed):

```bash
cd protocol/circuits
circom withdraw.circom --r1cs --wasm --sym -l ../node_modules/circomlib/circuits
# then a Groth16 trusted-setup ceremony with snarkjs -> proving key + verifying key
```

## The program (`programs/zsol/src/lib.rs`)

An Anchor program: `init_pool`, `register_set`, `deposit`, `withdraw`. It holds
pooled SOL in a PDA vault, keeps a rolling window of recent Merkle roots, records
association-set roots, and on withdrawal checks the root is known, the set
matches, the nullifier is unspent (enforced by initialising a per-nullifier
account), verifies the Groth16 proof, then pays out.

The Groth16 verify (`verify_groth16`) is deliberately left returning an explicit
`VerifierNotInitialized` error rather than a stub `true` — **the program can
never silently approve a withdrawal before the real verifying key from the
trusted setup is embedded.** That is a safety choice, not an omission.

## Build path — what "fully working" actually requires

1. ✅ **SDK** — done and tested.
2. ✅ **Compile the circuit + prove/verify** — done. `circuits/build.sh` runs it
   end-to-end and a real proof verifies (tamper-rejected). Production still needs
   a multi-party ceremony to replace the local throwaway setup key.
3. **Wire the verifier** — embed the verifying key (dev key saved at
   `circuits/artifacts/verification_key.dev.json`), implement the alt_bn128
   pairing check in `verify_groth16`, confirm the SDK's proofs verify on-chain.
4. **Devnet** — `anchor build && anchor deploy` to devnet, end-to-end
   deposit→withdraw against the deployed program. (This sandbox can't reach
   Solana, so this step runs on your machine.)
5. **Audit** — independent circuit + program audit. No mainnet before it passes.
6. **Mainnet** — only after 5.

Each step is real and doable. None is skippable. Anyone who tells you it can go to
mainnet faster is telling you something that ends with drained deposits.

## Layout

```
protocol/
  sdk/
    src/note.ts       commitments, nullifiers, notes
    src/merkle.ts     incremental Merkle tree + proofs
    src/withdraw.ts   association sets + withdrawal assembly
    test/protocol.test.ts   10 tests
  circuits/
    withdraw.circom   the zero-knowledge circuit
  programs/zsol/
    src/lib.rs        the Anchor program
```
