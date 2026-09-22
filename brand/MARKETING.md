# zSOL — Marketing Kit

All copy below is written to be **truthful about status**: zSOL is a design +
working proof-of-concept, not a live pool. Nothing here tells anyone to deposit
real funds. Keep it that way — the honesty is the moat, given how many "privacy"
projects get delisted or prosecuted for pretending.

Brand assets: `brand/logo.svg`, `brand/banner.svg` (X header, 1500×500).

---

## X (Twitter) bio  — 160 char

> Shielded SOL on Solana. Privacy proven on Zcash, brought to Solana — with proof
> of clean origin built in. Not a mixer. ◎ zk. Building in public.

Alt (shorter):

> Shielded SOL, done right. Zcash-grade privacy + proof your funds aren't
> flagged. Not a mixer. Building in public. ◎

---

## Short project description  ("stonk description" / directory blurb)

> **zSOL** is shielded SOL on Solana. You deposit SOL and withdraw to a fresh
> address with a zero-knowledge proof that your deposit is *not* one of the
> flagged ones — private, and provably clean. Zcash proved private money works;
> zSOL brings that to Solana and adds the missing half: proof of clean origin, so
> honest users stay private without hiding stolen funds. Powered by STONK.

One-liner:

> Zcash-grade privacy for SOL, with proof your money isn't dirty. Not a mixer.

---

## Thesis tweet (thread opener)

> Every privacy coin faces the same trap:
>
> Hide everyone together, and the honest look identical to the thief. So exchanges
> delist you, and regulators come.
>
> zSOL breaks the trap. You stay private — and prove your funds aren't flagged.
> Here's how 🧵

Follow-up beats (optional thread):

> 2/ A mixer hides your trail. That's it. Which is why the stolen and the honest
> come out looking the same — and why "privacy" keeps getting killed.

> 3/ zSOL uses association sets (Buterin et al., 2023). You withdraw with a
> zero-knowledge proof that your deposit is in a vouched-for set — and NOT among
> flagged ones. Privacy for you, no shield for thieves.

> 4/ Zcash spent a decade proving shielded transactions are safe and practical.
> zSOL takes that heritage to Solana — cheap, fast blocks so the anonymity set
> actually grows.

> 5/ Status: the spec is public and the zk proof system already works end-to-end
> (proof generates + verifies, forgeries rejected). Not deployed, not audited —
> we build in public and gate mainnet behind an audit. Waitlist below. ◎

---

## Article  (Medium / Mirror / blog)

**Title:** Privacy isn't the problem. Proof is the missing half.

Crypto privacy has a branding problem that's really a design problem. Every tool
that hides your transactions — mixers, shielded pools, tumblers — hides
*everyone's*. That's the point, and it's also the flaw: once funds are pooled and
anonymized, there is no way to tell an ordinary user from someone laundering a
hack. So the honest and the stolen come out the other side looking identical.

That single fact is why private money keeps dying. Exchanges refuse deposits that
touched a mixer. Regulators treat the whole pool as suspect. And the developers
get caught in the blast radius — not for laundering anything themselves, but for
writing code that couldn't tell the difference.

zSOL starts from a different premise: **you should be able to prove where your
money didn't come from.**

Here's the mechanism. You deposit SOL into a pool and get back a private claim.
Later, you withdraw to a brand-new address. But the withdrawal carries a
zero-knowledge proof of two things: that your deposit belongs to a published
"association set" of vouched-for deposits, and that it is *not* one of the flagged
ones — say, deposits traced to a known exploit. The proof reveals nothing about
which deposit is yours. It only proves your funds are clean.

A thief can still deposit — nobody can stop that. But no honest association set
will include their deposit, so they can never produce a withdrawal proof anyone
accepts. Privacy stops being a shield for them, and stays one for everyone else.

None of this is our invention. The association-set model comes from a 2023 paper
by Vitalik Buterin, Jacob Illum, Matthias Nadler, Fabian Schär, and Ameen
Soleimani. And the shielding heritage is Zcash's — a decade of proving that
private transactions can be safe, sound, and practical. zSOL's contribution is
bringing those two ideas together on Solana, where blocks are cheap and fast
enough for the anonymity set to actually grow.

Where things stand, honestly: the specification is public, and the zero-knowledge
proof system already works end-to-end — we generate a real proof of a clean
withdrawal and verify it, and a tampered proof is rejected. What's left is wiring
the verifier on-chain, a multi-party trusted-setup ceremony, and an independent
audit. No real SOL touches this before that audit passes. We're building in
public, and you can read the spec and follow along.

If you want privacy that doesn't get you delisted — or prosecuted — that's what
we're building. Get on the waitlist.

*zSOL is an independent project inspired by Zcash's shielded-transaction design.
It is not affiliated with or endorsed by the Zcash project or the Electric Coin
Company. Not deployed, not audited; nothing here is financial or legal advice.*

---

## 3 post-launch tweets

**1 — the launch**

> zSOL is live. ◎
>
> Shielded SOL on Solana: deposit, then withdraw to a fresh address with a
> zero-knowledge proof your funds aren't flagged. Private, and provably clean.
>
> Spec's public. Proof system already works. Site + waitlist 👇
> [link]

**2 — the distinction (pin this)**

> "Isn't this just a mixer?"
>
> No. A mixer hides everyone — including the thief. zSOL lets you *prove* your
> deposit isn't one of the flagged ones, in zero knowledge.
>
> Same privacy. No cover for stolen funds. That's the whole design.

**3 — the proof milestone + CTA**

> Receipts, not roadmap:
>
> The zSOL zk circuit compiles (10,350 constraints), generates a real proof of a
> clean withdrawal, and verifies it. Forged proofs get rejected.
>
> Next: on-chain verifier → devnet → audit. Building in public.
> Waitlist 👇 [link]

---

## Usage notes

- Replace `[link]` with your live domain.
- The banner already carries "Powered by STONK"; the site footer does too.
- Do **not** add live metrics (TVL, users, deposits) until they're real. Fake
  numbers are the fastest way to lose the credibility this honesty buys you.
- Keep the "not affiliated with Zcash / not audited" lines wherever you reuse this
  copy at length — they protect you.
