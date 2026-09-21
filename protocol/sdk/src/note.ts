/**
 * zSOL — cryptographic core.
 *
 * The off-chain half of the protocol: build deposit commitments, maintain the
 * Merkle tree of commitments, derive nullifiers, and assemble the public/private
 * inputs a withdrawal proof needs. This is real, runnable, tested code — it is
 * the same arithmetic the circuit enforces in zero knowledge.
 *
 * It is NOT the whole protocol. Proving/verifying (circuits/) and settlement
 * (programs/) are the other two legs, and none of it touches real SOL before an
 * audit. See ../README.md.
 */

import { buildPoseidon } from 'circomlibjs';

/** BN254 scalar field — the modulus every value lives under. */
export const FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export type Hash2 = (a: bigint, b: bigint) => bigint;
export type Hash3 = (a: bigint, b: bigint, c: bigint) => bigint;

let _poseidon: Awaited<ReturnType<typeof buildPoseidon>> | null = null;

/** Build the Poseidon hashers once. Async because the WASM has to initialise. */
export async function initHashers(): Promise<{ h2: Hash2; h3: Hash3 }> {
  if (!_poseidon) _poseidon = await buildPoseidon();
  const p = _poseidon;
  const toBig = (x: unknown) => BigInt(p.F.toString(x as never));
  return {
    h2: (a, b) => toBig(p([a, b])),
    h3: (a, b, c) => toBig(p([a, b, c])),
  };
}

/** A uniformly random field element. Uses crypto RNG, rejection-sampled. */
export function randomField(): bigint {
  const bytes = new Uint8Array(32);
  // Node and browser both expose crypto.getRandomValues via globalThis.
  const g = globalThis as unknown as { crypto?: Crypto };
  if (g.crypto?.getRandomValues) g.crypto.getRandomValues(bytes);
  else {
    // Node fallback.

    const nc = require('crypto') as typeof import('crypto');
    nc.randomFillSync(bytes);
  }
  let x = 0n;
  for (const b of bytes) x = (x << 8n) | BigInt(b);
  return x % FIELD;
}

/**
 * A depositor's secret note. Everything needed to later withdraw. Losing this is
 * losing the funds; sharing it is sharing the funds.
 */
export interface Note {
  /** The secret that authorises withdrawal and seeds the nullifier. */
  nullifierSecret: bigint;
  /** Blinding factor so equal-amount commitments are still distinct. */
  blinding: bigint;
  /** Pool identifier (denomination). Binds the note to one pool. */
  pool: bigint;
}

/** Generate a fresh note for a pool. */
export function newNote(pool: bigint): Note {
  return { nullifierSecret: randomField(), blinding: randomField(), pool };
}

/**
 * The public commitment: C = Poseidon(nullifierSecret, pool, blinding).
 * This is what gets inserted into the tree on deposit. It reveals nothing.
 */
export function commitment(h3: Hash3, note: Note): bigint {
  return h3(note.nullifierSecret, note.pool, note.blinding);
}

/**
 * The nullifier: N = Poseidon(nullifierSecret, leafIndex).
 * Revealed at withdrawal to prevent double-spend. One-way: it cannot be linked
 * back to the commitment without the secret.
 */
export function nullifier(h2: Hash2, note: Note, leafIndex: bigint): bigint {
  return h2(note.nullifierSecret, leafIndex);
}

/** Serialise a note to a string you can store; parse it back with `parseNote`. */
export function serializeNote(note: Note): string {
  return `zsol-note-v1:${note.pool.toString(16)}:${note.nullifierSecret.toString(
    16,
  )}:${note.blinding.toString(16)}`;
}

export function parseNote(s: string): Note {
  const parts = s.split(':');
  if (parts.length !== 4 || parts[0] !== 'zsol-note-v1') {
    throw new Error('Not a valid zSOL note string.');
  }
  return {
    pool: BigInt('0x' + parts[1]),
    nullifierSecret: BigInt('0x' + parts[2]),
    blinding: BigInt('0x' + parts[3]),
  };
}
