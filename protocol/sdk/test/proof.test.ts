import { describe, expect, it } from 'vitest';
import { BASE_FIELD, be32, encodeG1, encodeG2, formatProofForChain, negateG1, type SnarkjsProof } from '../src/proof';

// BN254 G1 generator, for on-curve sanity checks: y^2 = x^3 + 3 (mod p).
const G1X = 1n, G1Y = 2n;
const onCurve = (x: bigint, y: bigint) => (y * y) % BASE_FIELD === (x * x * x + 3n) % BASE_FIELD;

describe('be32', () => {
  it('encodes big-endian and pads to 32 bytes', () => {
    const b = be32('1');
    expect(b.length).toBe(32);
    expect(b[31]).toBe(1);
    expect(b.slice(0, 31).every((v) => v === 0)).toBe(true);
  });
  it('encodes the top byte of a large value first', () => {
    const b = be32(BASE_FIELD - 1n);
    expect(b[0]).toBe(0x30); // p−1 starts 0x30644e...
  });
  it('rejects values that do not fit', () => {
    expect(() => be32(1n << 256n)).toThrow(/fit/);
  });
});

describe('negateG1', () => {
  it('maps y to p − y and keeps the point on the curve', () => {
    expect(onCurve(G1X, G1Y)).toBe(true);
    const n = negateG1(G1X, G1Y);
    expect(n.x).toBe(G1X);
    expect(n.y).toBe(BASE_FIELD - G1Y);
    expect(onCurve(n.x, n.y)).toBe(true);
  });
  it('is an involution: negating twice returns the original', () => {
    const n = negateG1(G1X, G1Y);
    const nn = negateG1(n.x, n.y);
    expect(nn).toEqual({ x: G1X, y: G1Y });
  });
  it('leaves the identity (y = 0) alone', () => {
    expect(negateG1(5n, 0n).y).toBe(0n);
  });
});

describe('encoding', () => {
  it('G1 is 64 bytes: x ‖ y', () => {
    const e = encodeG1('1', '2');
    expect(e.length).toBe(64);
    expect(e[31]).toBe(1);
    expect(e[63]).toBe(2);
  });
  it('G2 is 128 bytes in c1‖c0 order (swapped from snarkjs)', () => {
    const e = encodeG2([['10', '11'], ['20', '21'], ['1', '0']]);
    expect(e.length).toBe(128);
    // x.c1 first, then x.c0, then y.c1, then y.c0
    expect(e[31]).toBe(11);
    expect(e[63]).toBe(10);
    expect(e[95]).toBe(21);
    expect(e[127]).toBe(20);
  });
});

describe('formatProofForChain', () => {
  const proof: SnarkjsProof = {
    pi_a: [G1X.toString(), G1Y.toString(), '1'],
    pi_b: [['10', '11'], ['20', '21'], ['1', '0']],
    pi_c: ['3', '4', '1'],
    protocol: 'groth16',
    curve: 'bn128',
  };
  const signals = ['5', '6', '7', '8', '9', '1000'];

  it('produces the exact byte sizes the program expects', () => {
    const f = formatProofForChain(proof, signals);
    expect(f.a.length).toBe(64);
    expect(f.b.length).toBe(128);
    expect(f.c.length).toBe(64);
    expect(f.publicInputs.length).toBe(6);
    f.publicInputs.forEach((p) => expect(p.length).toBe(32));
  });

  it('negates A but leaves C untouched', () => {
    const f = formatProofForChain(proof, signals);
    // A.y should be p − 2, i.e. NOT the raw y=2
    const ay = BigInt('0x' + Buffer.from(f.a.slice(32)).toString('hex'));
    expect(ay).toBe(BASE_FIELD - G1Y);
    // C.y is the raw 4
    expect(f.c[63]).toBe(4);
  });

  it('keeps public signals in order', () => {
    const f = formatProofForChain(proof, signals);
    expect(f.publicInputs[5][30]).toBe(0x03); // 1000 = 0x03E8
    expect(f.publicInputs[5][31]).toBe(0xe8);
  });

  it('refuses a non-groth16/bn128 proof', () => {
    expect(() => formatProofForChain({ ...proof, protocol: 'plonk' }, signals)).toThrow(/groth16/);
  });
});
