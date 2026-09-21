/**
 * zSOL — withdrawal assembly.
 *
 * Ties a note, the pool Merkle tree, and a chosen association set into the exact
 * public + private inputs the withdrawal circuit consumes. The association set
 * is itself a Merkle tree over the leaf indices a provider vouches for — this is
 * the "proof of clean origin" half that separates zSOL from a plain mixer.
 */

import { MerkleTree, type MerkleProof } from './merkle';
import { commitment, nullifier, type Hash2, type Hash3, type Note } from './note';

/** Public signals — revealed on-chain, checked by the verifier. */
export interface PublicInputs {
  poolRoot: bigint;
  associationRoot: bigint;
  nullifier: bigint;
  /** Recipient + fee are bound into the proof so a relayer can't rewrite them. */
  recipient: bigint;
  relayer: bigint;
  fee: bigint;
}

/** Private witness — never leaves the prover. */
export interface PrivateInputs {
  nullifierSecret: bigint;
  blinding: bigint;
  pool: bigint;
  leafIndex: bigint;
  poolSiblings: bigint[];
  poolPathBits: number[];
  assocSiblings: bigint[];
  assocPathBits: number[];
}

export interface WithdrawalInputs {
  publicInputs: PublicInputs;
  privateInputs: PrivateInputs;
}

/**
 * An association set: a provider's published list of vouched leaf indices,
 * committed as a Merkle tree. Members can prove inclusion; flagged deposits are
 * simply never added, so they can never prove it.
 */
export class AssociationSet {
  private readonly tree: MerkleTree;
  /** leafIndex (in the pool) -> position in this set's tree. */
  private readonly positions = new Map<number, number>();

  constructor(depth: number, private readonly h2: Hash2) {
    this.tree = new MerkleTree(depth, h2);
  }

  get root(): bigint {
    return this.tree.root;
  }

  /** Vouch for a pool leaf index by adding it to the set. */
  add(poolLeafIndex: number): void {
    const pos = this.tree.insert(BigInt(poolLeafIndex));
    this.positions.set(poolLeafIndex, pos);
  }

  has(poolLeafIndex: number): boolean {
    return this.positions.has(poolLeafIndex);
  }

  proof(poolLeafIndex: number): MerkleProof {
    const pos = this.positions.get(poolLeafIndex);
    if (pos === undefined) {
      throw new Error(
        `Leaf ${poolLeafIndex} is not in this association set — no clean-origin proof is possible against it.`,
      );
    }
    return this.tree.proof(pos);
  }
}

/**
 * Assemble everything needed to prove and submit a withdrawal.
 *
 * Throws if the note isn't in the pool, or isn't vouched for by the chosen set —
 * which is exactly the case the protocol is designed to make unprovable for
 * flagged funds.
 */
export function buildWithdrawal(params: {
  h2: Hash2;
  h3: Hash3;
  note: Note;
  leafIndex: number;
  poolTree: MerkleTree;
  associationSet: AssociationSet;
  recipient: bigint;
  relayer: bigint;
  fee: bigint;
}): WithdrawalInputs {
  const { h2, h3, note, leafIndex, poolTree, associationSet } = params;

  const c = commitment(h3, note);
  const poolProof = poolTree.proof(leafIndex);
  if (poolProof.leaf !== c) {
    throw new Error('Note does not match the commitment at that leaf index.');
  }
  if (!associationSet.has(leafIndex)) {
    throw new Error(
      'This deposit is not in the chosen association set. Pick a set that vouches for it, or withdraw to the original depositor.',
    );
  }
  const assocProof = associationSet.proof(leafIndex);
  const nul = nullifier(h2, note, BigInt(leafIndex));

  return {
    publicInputs: {
      poolRoot: poolTree.root,
      associationRoot: associationSet.root,
      nullifier: nul,
      recipient: params.recipient,
      relayer: params.relayer,
      fee: params.fee,
    },
    privateInputs: {
      nullifierSecret: note.nullifierSecret,
      blinding: note.blinding,
      pool: note.pool,
      leafIndex: BigInt(leafIndex),
      poolSiblings: poolProof.siblings,
      poolPathBits: poolProof.pathBits,
      assocSiblings: assocProof.siblings,
      assocPathBits: assocProof.pathBits,
    },
  };
}

/**
 * Re-check a withdrawal the way the circuit + on-chain program will: pool
 * membership, association membership, nullifier derivation. Pure verification,
 * no proof — used in tests and as the reference the circuit must match.
 */
export function checkWithdrawal(
  h2: Hash2,
  h3: Hash3,
  note: Note,
  w: WithdrawalInputs,
): { poolOk: boolean; assocOk: boolean; nullifierOk: boolean; ok: boolean } {
  const c = commitment(h3, note);

  let poolNode = c;
  for (let i = 0; i < w.privateInputs.poolSiblings.length; i++) {
    const s = w.privateInputs.poolSiblings[i];
    poolNode = w.privateInputs.poolPathBits[i] ? h2(s, poolNode) : h2(poolNode, s);
  }
  const poolOk = poolNode === w.publicInputs.poolRoot;

  let assocNode = w.privateInputs.leafIndex;
  for (let i = 0; i < w.privateInputs.assocSiblings.length; i++) {
    const s = w.privateInputs.assocSiblings[i];
    assocNode = w.privateInputs.assocPathBits[i] ? h2(s, assocNode) : h2(assocNode, s);
  }
  const assocOk = assocNode === w.publicInputs.associationRoot;

  const nullifierOk =
    nullifier(h2, note, w.privateInputs.leafIndex) === w.publicInputs.nullifier;

  return { poolOk, assocOk, nullifierOk, ok: poolOk && assocOk && nullifierOk };
}
