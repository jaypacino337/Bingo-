import { describe, expect, it, beforeAll } from 'vitest';
import { initHashers, newNote, commitment, nullifier, serializeNote, parseNote, type Hash2, type Hash3 } from '../src/note';
import { MerkleTree } from '../src/merkle';
import { AssociationSet, buildWithdrawal, checkWithdrawal } from '../src/withdraw';

let h2: Hash2, h3: Hash3;
beforeAll(async () => { ({ h2, h3 } = await initHashers()); });

const DEPTH = 20;
const POOL_1_SOL = 1n;

describe('commitment & nullifier', () => {
  it('commitment is deterministic and hides the secret', () => {
    const note = newNote(POOL_1_SOL);
    const a = commitment(h3, note);
    const b = commitment(h3, note);
    expect(a).toBe(b);
    // Different note -> different commitment.
    expect(commitment(h3, newNote(POOL_1_SOL))).not.toBe(a);
  });

  it('nullifier depends on both the secret and the leaf index', () => {
    const note = newNote(POOL_1_SOL);
    expect(nullifier(h2, note, 5n)).not.toBe(nullifier(h2, note, 6n));
    const other = newNote(POOL_1_SOL);
    expect(nullifier(h2, other, 5n)).not.toBe(nullifier(h2, note, 5n));
  });

  it('note survives a serialize/parse round trip', () => {
    const note = newNote(POOL_1_SOL);
    const back = parseNote(serializeNote(note));
    expect(back).toEqual(note);
  });
});

describe('merkle tree', () => {
  it('produces proofs that verify against the root', () => {
    const t = new MerkleTree(DEPTH, h2);
    const leaves = [11n, 22n, 33n, 44n, 55n];
    const idx = leaves.map((l) => t.insert(l));
    for (const i of idx) {
      expect(MerkleTree.verify(h2, t.proof(i))).toBe(true);
    }
  });

  it('rejects a tampered proof', () => {
    const t = new MerkleTree(DEPTH, h2);
    t.insert(11n); t.insert(22n);
    const p = t.proof(0);
    p.siblings[0] = p.siblings[0] + 1n;
    expect(MerkleTree.verify(h2, p)).toBe(false);
  });

  it('refuses to overflow capacity', () => {
    const t = new MerkleTree(2, h2); // capacity 4
    for (let i = 0; i < 4; i++) t.insert(BigInt(i));
    expect(() => t.insert(99n)).toThrow(/full/);
  });
});

describe('withdrawal — the whole flow', () => {
  it('an honest, vouched deposit produces inputs that all check out', () => {
    const pool = new MerkleTree(DEPTH, h2);
    const set = new AssociationSet(DEPTH, h2);

    // Three honest depositors.
    const notes = [newNote(POOL_1_SOL), newNote(POOL_1_SOL), newNote(POOL_1_SOL)];
    const idx = notes.map((n) => pool.insert(commitment(h3, n)));
    idx.forEach((i) => set.add(i)); // provider vouches for all three

    const me = 1;
    const w = buildWithdrawal({
      h2, h3, note: notes[me], leafIndex: idx[me],
      poolTree: pool, associationSet: set,
      recipient: 0xABCDn, relayer: 0xF00Dn, fee: 1000n,
    });

    const res = checkWithdrawal(h2, h3, notes[me], w);
    expect(res.poolOk).toBe(true);
    expect(res.assocOk).toBe(true);
    expect(res.nullifierOk).toBe(true);
    expect(res.ok).toBe(true);
    // Recipient/fee are public and bound.
    expect(w.publicInputs.recipient).toBe(0xABCDn);
    expect(w.publicInputs.fee).toBe(1000n);
  });

  it('a FLAGGED deposit cannot be withdrawn — this is the core guarantee', () => {
    const pool = new MerkleTree(DEPTH, h2);
    const set = new AssociationSet(DEPTH, h2);

    const honest = newNote(POOL_1_SOL);
    const thief = newNote(POOL_1_SOL);
    const honestIdx = pool.insert(commitment(h3, honest));
    const thiefIdx = pool.insert(commitment(h3, thief));

    // The provider vouches for the honest deposit only. The thief is simply
    // never added — so no clean-origin proof against this set is possible.
    set.add(honestIdx);

    expect(() =>
      buildWithdrawal({
        h2, h3, note: thief, leafIndex: thiefIdx,
        poolTree: pool, associationSet: set,
        recipient: 0x1n, relayer: 0x2n, fee: 0n,
      }),
    ).toThrow(/not in the chosen association set/);
  });

  it('the same nullifier reappears for the same note — enabling double-spend detection', () => {
    const pool = new MerkleTree(DEPTH, h2);
    const set = new AssociationSet(DEPTH, h2);
    const note = newNote(POOL_1_SOL);
    const i = pool.insert(commitment(h3, note));
    set.add(i);

    const w1 = buildWithdrawal({ h2, h3, note, leafIndex: i, poolTree: pool, associationSet: set, recipient: 1n, relayer: 2n, fee: 0n });
    const w2 = buildWithdrawal({ h2, h3, note, leafIndex: i, poolTree: pool, associationSet: set, recipient: 9n, relayer: 2n, fee: 0n });
    // Same note + leaf -> same nullifier. The chain marks it spent after the first.
    expect(w1.publicInputs.nullifier).toBe(w2.publicInputs.nullifier);
  });

  it('a note with the wrong leaf index fails to assemble', () => {
    const pool = new MerkleTree(DEPTH, h2);
    const set = new AssociationSet(DEPTH, h2);
    const a = newNote(POOL_1_SOL), b = newNote(POOL_1_SOL);
    const ai = pool.insert(commitment(h3, a));
    const bi = pool.insert(commitment(h3, b));
    set.add(ai); set.add(bi);
    // Try to withdraw note a while pointing at b's leaf.
    expect(() =>
      buildWithdrawal({ h2, h3, note: a, leafIndex: bi, poolTree: pool, associationSet: set, recipient: 1n, relayer: 2n, fee: 0n }),
    ).toThrow(/does not match the commitment/);
  });
});
