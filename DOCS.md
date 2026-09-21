# zSOL — Protocol Specification

**Status:** draft design. Not implemented, not audited, not deployed.
**Shielding heritage:** Zcash. **Compliance model:** association sets
(Buterin, Illum, Nadler, Schär, Soleimani, 2023).

This is the working spec for the site's "Read the spec" link and the thing the
first engineering phase builds against. It is deliberately concrete — every
section is a thing that has to exist in code.

---

## 1. What zSOL is

A shielded pool for native SOL. You deposit SOL and receive a private claim
(zSOL) you can later withdraw to a fresh address. The withdrawal publishes a
zero-knowledge proof of two facts:

1. You know the secret behind one deposit in a chosen **association set**.
2. That deposit has not been withdrawn before.

It never reveals *which* deposit is yours. Unlike a plain mixer, the association
set lets an honest user prove their funds are **not** among flagged (e.g. stolen)
deposits — the property that keeps private money exchange-acceptable.

Zcash proved shielding is safe and practical but is all-or-nothing. zSOL keeps the
shielding and adds provable clean origin, on a chain fast and cheap enough for the
anonymity set to grow.

---

## 2. Fixed-denomination pools

Anonymity comes from indistinguishability, so deposits must be uniform. Launch
denominations:

| Pool | Denomination |
|------|--------------|
| A | 1 SOL |
| B | 10 SOL |
| C | 100 SOL |

Variable amounts leak the amount and shrink the crowd. Users combine pools for
larger sums. (A later note-based design can relax this; v1 does not.)

---

## 3. Cryptographic objects

- **Commitment** `C = H(nullifier_secret ‖ amount_pool ‖ blinding)`
  Published on deposit. Hides the secret; binds the pool.
- **Merkle tree** — an append-only tree of all commitments in a pool. The root is
  on-chain state. Membership is a Merkle path.
- **Nullifier** `N = H(nullifier_secret ‖ leaf_index)`
  Revealed on withdrawal. One-way, unlinkable to `C`; spent-set membership
  prevents double-withdraw.
- **Association set** `S` — a published list (or its own Merkle root) of leaf
  indices a provider vouches for. Multiple providers, user's choice.

Hash: Poseidon (SNARK-friendly). Proof system: Groth16 (small proofs, cheap
verify) for v1; a transparent system (e.g. PLONK/Halo2) is a later option that
removes the trusted setup.

---

## 4. The withdrawal circuit

Private inputs: `nullifier_secret`, `blinding`, `leaf_index`, Merkle path to the
pool root, membership path into the association-set root.

Public inputs: pool Merkle root, association-set root, nullifier `N`, recipient,
relayer fee.

The circuit proves:

1. `C` reconstructed from the secrets is a leaf in the pool tree (Merkle path to
   the public pool root).
2. The same leaf is in the association set (path to the public set root). **This
   is the exclusion property** — flagged leaves are simply not in `S`.
3. `N` is correctly derived from the secret and `leaf_index`.
4. Recipient and fee are bound into the proof (stops a relayer rewriting them).

On-chain the program checks: proof verifies, pool/set roots are recognised, `N`
is unspent → marks `N` spent → pays `denomination − fee` to recipient, `fee` to
relayer.

---

## 5. On-chain program (Solana / Anchor)

Accounts:

- `Pool` — denomination, current Merkle root, ring buffer of recent roots
  (tolerate races), config.
- `NullifierSet` — spent nullifiers. A PDA-per-nullifier, or a compressed set.
- `SetRegistry` — recognised association-set roots and who published them.

Instructions:

- `deposit(commitment)` — transfer SOL in, insert leaf, update root.
- `withdraw(proof, publicInputs)` — verify, check root recognised + nullifier
  unspent, mark spent, pay out.
- `register_set(root, meta)` — a provider publishes/updates an association set.
- `admin` — pause, config, within a published trust model.

The Groth16 verifier is the hard on-chain piece (pairing checks within the compute
budget). Prior art exists (Light Protocol, zk verifiers on Solana); v1 leans on a
proven verifier crate rather than hand-rolling pairings.

---

## 6. Relayers

A user withdrawing to a fresh address has no SOL there for gas. A **relayer**
submits the withdrawal and takes `fee` from the proceeds. The fee and recipient
are inside the proof, so a relayer cannot alter either. Relayers are permissionless
and interchangeable; the protocol needs no trusted one.

---

## 7. Association sets — the trust model

The protocol verifies a proof against a set root the user names; it takes no
position on what belongs in a set. A set is a signed list of leaf indices.

- **Conservative** provider: excludes anything within N hops of a known hack.
- **Permissive** provider: excludes only direct, adjudicated theft.

Users pick. Exchanges pick which they honour. **Risk:** if everyone converges on
one provider, that provider is a de-facto censor. Mitigation is set diversity —
tooling and docs that make running a set easy — tracked as a first-class roadmap
item, not an afterthought.

**Floor guarantee:** a deposit is always withdrawable to the *original depositor*
without any set proof. No provider can strand funds; the worst case is loss of
anonymity, never loss of money.

---

## 8. Trusted setup

Groth16 needs a per-circuit trusted setup. v1 runs a multi-party ceremony with
public transcripts; the circuit is safe if one participant was honest. A later
migration to a transparent proof system removes this requirement entirely and is
the preferred long-term path.

---

## 9. Threat notes

- **Amount correlation** — fixed denominations + relayers address it; timing
  analysis remains a user-behaviour concern (wait, don't deposit-and-immediately-
  withdraw).
- **Small anonymity set** — early on, few deposits = weak privacy. The UI must
  show the live set size and warn honestly. This is why cheap fast chains matter.
- **Root races** — accept a window of recent roots so a deposit landing between
  proof-gen and submission doesn't invalidate a withdrawal.
- **Verifier soundness** — the entire security rests on the circuit + verifier.
  Audit is non-negotiable before mainnet.

---

## 10. Build phases

1. **Circuits** — Poseidon commitments, Merkle membership, exclusion, nullifier.
   Test vectors. (circom/arkworks or Halo2.)
2. **Devnet program** — Anchor, Groth16 verify, deposit/withdraw/register_set,
   nullifier set. Local relayer.
3. **Audit + ceremony** — circuit audit, multi-party setup, public transcripts.
4. **Set ecosystem** — reference set provider, publishing tooling, docs.
5. **Mainnet** — only after 3 and a clean audit.

No step is skippable, and nothing touches real SOL before step 3 is done.

---

## 11. What exists today

The landing page and this spec. No circuits, no program, no token. Every "not
deployed / not audited" line on the site is literally true, and stays until the
phases above change it.
