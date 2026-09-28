/**
 * zSOL — proof formatting for the on-chain verifier.
 *
 * snarkjs emits a Groth16 proof as decimal-string coordinates. The Solana program
 * (groth16-solana) wants raw bytes: big-endian field elements, G2 coordinates in
 * c1‖c0 order (the Ethereum precompile convention), and — crucially — the A point
 * NEGATED, because the verifier checks
 *
 *     e(-A, B) · e(α, β) · e(vk_x, γ) · e(C, δ) == 1
 *
 * and expects the submitter to have done the negation. Negating a BN254 G1 point
 * is (x, p − y) over the base field p. Pure bigint math; no dependencies.
 *
 * If a submitter forgets to negate, the proof simply fails to verify — it can
 * never be turned into a forgery.
 */

/** BN254 base field prime — the field point *coordinates* live in. */
export const BASE_FIELD =
  21888242871839275222246405745257275088696311157297823662689037894645226208583n;

/** Shape of snarkjs' proof.json. */
export interface SnarkjsProof {
  pi_a: [string, string, string];
  pi_b: [[string, string], [string, string], [string, string]];
  pi_c: [string, string, string];
  protocol: string;
  curve: string;
}

export interface OnChainProof {
  /** 64 bytes: x ‖ (p − y) — A already negated. */
  a: Uint8Array;
  /** 128 bytes: x.c1 ‖ x.c0 ‖ y.c1 ‖ y.c0 */
  b: Uint8Array;
  /** 64 bytes: x ‖ y */
  c: Uint8Array;
  /** N × 32 bytes, big-endian, in the circuit's public-signal order. */
  publicInputs: Uint8Array[];
}

/** 32-byte big-endian encoding of a decimal (or bigint) field element. */
export function be32(v: string | bigint): Uint8Array {
  let n = typeof v === 'bigint' ? v : BigInt(v);
  if (n < 0n) throw new Error('negative field element');
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) { out[i] = Number(n & 0xffn); n >>= 8n; }
  if (n !== 0n) throw new Error('field element does not fit in 32 bytes');
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** Negate a G1 point: (x, y) ↦ (x, p − y). The identity's y = 0 stays 0. */
export function negateG1(x: bigint, y: bigint): { x: bigint; y: bigint } {
  const yn = y === 0n ? 0n : BASE_FIELD - y;
  return { x, y: yn };
}

/** Encode a G1 point (affine) as 64 big-endian bytes. */
export function encodeG1(x: string | bigint, y: string | bigint): Uint8Array {
  return concat(be32(x), be32(y));
}

/**
 * Encode a G2 point as 128 big-endian bytes in c1‖c0 order.
 * snarkjs gives [[x.c0, x.c1], [y.c0, y.c1]] — note the swap.
 */
export function encodeG2(p: [[string, string], [string, string], [string, string]]): Uint8Array {
  const [[xc0, xc1], [yc0, yc1]] = p;
  return concat(be32(xc1), be32(xc0), be32(yc1), be32(yc0));
}

/**
 * Convert a snarkjs proof + public signals into the byte layout the program
 * verifies. This is what a relayer submits in `withdraw`.
 */
export function formatProofForChain(proof: SnarkjsProof, publicSignals: string[]): OnChainProof {
  if (proof.protocol !== 'groth16' || proof.curve !== 'bn128') {
    throw new Error(`expected a groth16/bn128 proof, got ${proof.protocol}/${proof.curve}`);
  }
  const ax = BigInt(proof.pi_a[0]);
  const ay = BigInt(proof.pi_a[1]);
  const aNeg = negateG1(ax, ay);

  return {
    a: encodeG1(aNeg.x, aNeg.y),
    b: encodeG2(proof.pi_b),
    c: encodeG1(proof.pi_c[0], proof.pi_c[1]),
    publicInputs: publicSignals.map(be32),
  };
}
