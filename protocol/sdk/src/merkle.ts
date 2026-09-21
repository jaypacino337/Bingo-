/**
 * zSOL — incremental Merkle tree.
 *
 * A fixed-depth binary Merkle tree of deposit commitments, hashed with Poseidon.
 * The root is the on-chain state the withdrawal circuit proves membership
 * against. This mirrors, exactly, the Merkle logic the circuit enforces — the
 * TypeScript and the circom must agree bit for bit or no proof will verify.
 */

import type { Hash2 } from './note';

export interface MerkleProof {
  /** The leaf being proven. */
  leaf: bigint;
  /** Index of the leaf, left-to-right. */
  index: number;
  /** Sibling hash at each level, bottom to top. */
  siblings: bigint[];
  /** 0 if the node is a left child at that level, 1 if right. */
  pathBits: number[];
  /** The root this proof resolves to. */
  root: bigint;
}

export class MerkleTree {
  readonly depth: number;
  private readonly h2: Hash2;
  /** Precomputed hash of an all-zero subtree at each level. */
  private readonly zeros: bigint[];
  /** Dense layer storage; layers[0] = leaves. */
  private readonly layers: bigint[][];

  constructor(depth: number, h2: Hash2, zeroLeaf = 0n) {
    this.depth = depth;
    this.h2 = h2;
    this.zeros = [zeroLeaf];
    for (let i = 1; i <= depth; i++) {
      this.zeros[i] = h2(this.zeros[i - 1], this.zeros[i - 1]);
    }
    this.layers = Array.from({ length: depth + 1 }, () => []);
  }

  get leafCount(): number {
    return this.layers[0].length;
  }

  get capacity(): number {
    return 2 ** this.depth;
  }

  get root(): bigint {
    return this.nodeAt(this.depth, 0);
  }

  /** The value at (level, position), falling back to the zero subtree. */
  private nodeAt(level: number, pos: number): bigint {
    const layer = this.layers[level];
    if (pos < layer.length) return layer[pos];
    return this.zeros[level];
  }

  /** Insert one leaf, returning its index. Recomputes the path to the root. */
  insert(leaf: bigint): number {
    if (this.leafCount >= this.capacity) throw new Error('Merkle tree is full.');
    const index = this.layers[0].length;
    this.layers[0].push(leaf);

    let pos = index;
    for (let level = 0; level < this.depth; level++) {
      const isRight = pos & 1;
      const left = isRight ? this.nodeAt(level, pos - 1) : this.nodeAt(level, pos);
      const right = isRight ? this.nodeAt(level, pos) : this.nodeAt(level, pos + 1);
      const parent = this.h2(left, right);
      pos >>= 1;
      const up = this.layers[level + 1];
      if (pos < up.length) up[pos] = parent;
      else up.push(parent);
    }
    return index;
  }

  /** Produce a membership proof for a previously inserted leaf. */
  proof(index: number): MerkleProof {
    if (index < 0 || index >= this.leafCount) throw new Error('Leaf index out of range.');
    const siblings: bigint[] = [];
    const pathBits: number[] = [];
    let pos = index;
    for (let level = 0; level < this.depth; level++) {
      const isRight = pos & 1;
      const siblingPos = isRight ? pos - 1 : pos + 1;
      siblings.push(this.nodeAt(level, siblingPos));
      pathBits.push(isRight);
      pos >>= 1;
    }
    return { leaf: this.layers[0][index], index, siblings, pathBits, root: this.root };
  }

  /** Recompute a root from a proof — the exact check the circuit performs. */
  static verify(h2: Hash2, p: MerkleProof): boolean {
    let node = p.leaf;
    for (let i = 0; i < p.siblings.length; i++) {
      node = p.pathBits[i] ? h2(p.siblings[i], node) : h2(node, p.siblings[i]);
    }
    return node === p.root;
  }
}
