/**
 * zSOL — end-to-end devnet demo.
 *
 * Runs the whole protocol against the LIVE deployed program on devnet:
 *   init_pool → deposit (real test SOL) → register_set → withdraw (with a real
 *   zk proof) → confirm the recipient got paid.
 *
 * This is the "it actually works" proof: a shielded withdrawal, verified on-chain
 * by the program's Groth16 verifier, paying out to a fresh address.
 *
 * Devnet + dev key only. Never real SOL — the embedded key is forgeable.
 *
 *   ./node_modules/.bin/vite-node protocol/demo/e2e-devnet.ts
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction,
  LAMPORTS_PER_SOL, sendAndConfirmTransaction,
} from '@solana/web3.js';
import { initHashers, newNote, commitment } from '../sdk/src/note';
import { MerkleTree } from '../sdk/src/merkle';
import { AssociationSet, buildWithdrawal } from '../sdk/src/withdraw';
import { formatProofForChain, type SnarkjsProof } from '../sdk/src/proof';

const RPC = 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('8GMgaGZ88xh5dQbYtCFoDxPoUmAxMHzo43if7nBA9apX');
const DEPTH = 20;
const DENOM = Math.round(0.05 * LAMPORTS_PER_SOL); // 0.05 SOL pool
const FEE = 0;
const REPO = '/home/user/Bingo-';
const SNARKJS = `${REPO}/node_modules/.bin/snarkjs`;
const CIRCUIT = `${REPO}/protocol/circuits/build`;

// Anchor 8-byte instruction discriminator.
const disc = (name: string) =>
  createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);

// 32-byte big-endian encoding of a bigint.
function be32(n: bigint): Buffer {
  const b = Buffer.alloc(32);
  for (let i = 31; i >= 0; i--) { b[i] = Number(n & 0xffn); n >>= 8n; }
  return b;
}
const u64le = (n: number) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const bytesToBigIntBE = (b: Uint8Array) => { let n = 0n; for (const x of b) n = (n << 8n) | BigInt(x); return n; };

// Mirror the program's pubkey_to_field: clear the top 3 bits, big-endian value.
function pubkeyToField(pk: PublicKey): bigint {
  const b = Buffer.from(pk.toBytes());
  b[0] &= 0x1f;
  return bytesToBigIntBE(b);
}

const meta = (pubkey: PublicKey, isSigner: boolean, isWritable: boolean) => ({ pubkey, isSigner, isWritable });
const log = (...a: unknown[]) => console.log(...a);

async function main() {
  const conn = new Connection(RPC, 'confirmed');
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(join(homedir(), '.config/solana/id.json'), 'utf8'))),
  );
  log('payer/relayer:', payer.publicKey.toBase58());
  log('balance:', (await conn.getBalance(payer.publicKey)) / LAMPORTS_PER_SOL, 'SOL\n');

  const { h2, h3 } = await initHashers();

  // ── PDAs ──────────────────────────────────────────────────────────────────
  const [pool] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), u64le(DENOM)], PROGRAM_ID);
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), pool.toBuffer()], PROGRAM_ID);
  const [assocSet] = PublicKey.findProgramAddressSync(
    [Buffer.from('set'), payer.publicKey.toBuffer()], PROGRAM_ID);

  // ── 1. init_pool (idempotent) ───────────────────────────────────────────────
  if (!(await conn.getAccountInfo(pool))) {
    log('1/5  init_pool  (denomination 0.05 SOL)');
    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [meta(pool, false, true), meta(payer.publicKey, true, true), meta(SystemProgram.programId, false, false)],
      data: Buffer.concat([disc('init_pool'), u64le(DENOM)]),
    });
    const sig = await sendAndConfirmTransaction(conn, new Transaction().add(ix), [payer]);
    log('     ok', sig.slice(0, 20) + '…\n');
  } else {
    log('1/5  pool already exists — reusing\n');
  }

  // ── 2. deposit ──────────────────────────────────────────────────────────────
  const note = newNote(1n);
  const c = commitment(h3, note);
  const tree = new MerkleTree(DEPTH, h2);
  const leafIndex = tree.insert(c);
  const poolRoot = tree.root;

  log('2/5  deposit  (commitment into the pool, 0.05 test SOL locked)');
  const depositIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [meta(pool, false, true), meta(vault, false, true), meta(payer.publicKey, true, true), meta(SystemProgram.programId, false, false)],
    data: Buffer.concat([disc('deposit'), be32(c), be32(poolRoot)]),
  });
  log('     vault balance before:', (await conn.getBalance(vault)) / LAMPORTS_PER_SOL, 'SOL');
  let sig = await sendAndConfirmTransaction(conn, new Transaction().add(depositIx), [payer]);
  log('     ok', sig.slice(0, 20) + '…  leaf', leafIndex);
  log('     vault balance after: ', (await conn.getBalance(vault)) / LAMPORTS_PER_SOL, 'SOL\n');

  // ── 3. register_set (provider vouches for this deposit) ─────────────────────
  const set = new AssociationSet(DEPTH, h2);
  set.add(leafIndex);
  const assocRoot = set.root;

  log('3/5  register_set  (association set that vouches for the deposit)');
  const regIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [meta(assocSet, false, true), meta(payer.publicKey, true, true), meta(SystemProgram.programId, false, false)],
    data: Buffer.concat([disc('register_set'), be32(assocRoot)]),
  });
  sig = await sendAndConfirmTransaction(conn, new Transaction().add(regIx), [payer]);
  log('     ok', sig.slice(0, 20) + '…\n');

  // ── 4. build a real proof for a withdrawal to a FRESH address ───────────────
  const recipient = Keypair.generate();
  const recipientField = pubkeyToField(recipient.publicKey);
  const relayerField = pubkeyToField(payer.publicKey);

  const w = buildWithdrawal({
    h2, h3, note, leafIndex, poolTree: tree, associationSet: set,
    recipient: recipientField, relayer: relayerField, fee: BigInt(FEE),
  });

  log('4/5  generate zk proof of a clean withdrawal…');
  const dir = mkdtempSync(join(tmpdir(), 'zsol-'));
  const s = (x: bigint) => x.toString();
  writeFileSync(join(dir, 'input.json'), JSON.stringify({
    poolRoot: s(w.publicInputs.poolRoot), associationRoot: s(w.publicInputs.associationRoot),
    nullifier: s(w.publicInputs.nullifier), recipient: s(w.publicInputs.recipient),
    relayer: s(w.publicInputs.relayer), fee: s(w.publicInputs.fee),
    nullifierSecret: s(w.privateInputs.nullifierSecret), blinding: s(w.privateInputs.blinding),
    pool: s(w.privateInputs.pool), leafIndex: s(w.privateInputs.leafIndex),
    poolSiblings: w.privateInputs.poolSiblings.map(s), poolPathBits: w.privateInputs.poolPathBits.map(String),
    assocSiblings: w.privateInputs.assocSiblings.map(s), assocPathBits: w.privateInputs.assocPathBits.map(String),
  }));
  execSync(`node ${CIRCUIT}/withdraw_js/generate_witness.js ${CIRCUIT}/withdraw_js/withdraw.wasm ${dir}/input.json ${dir}/w.wtns`, { stdio: 'pipe' });
  execSync(`${SNARKJS} groth16 prove ${CIRCUIT}/withdraw_final.zkey ${dir}/w.wtns ${dir}/proof.json ${dir}/public.json`, { stdio: 'pipe' });
  // Sanity: verify locally before spending a transaction on it.
  execSync(`${SNARKJS} groth16 verify ${CIRCUIT}/verification_key.json ${dir}/public.json ${dir}/proof.json`, { stdio: 'pipe' });
  log('     proof generated + locally verified');

  const proof = JSON.parse(readFileSync(join(dir, 'proof.json'), 'utf8')) as SnarkjsProof;
  const publicSignals = JSON.parse(readFileSync(join(dir, 'public.json'), 'utf8')) as string[];
  const fp = formatProofForChain(proof, publicSignals);

  // ── 5. withdraw on-chain — the program verifies the proof and pays out ──────
  const [nullifierRec] = PublicKey.findProgramAddressSync(
    [Buffer.from('nul'), be32(w.publicInputs.nullifier)], PROGRAM_ID);

  log('\n5/5  withdraw  (program verifies the proof on-chain, pays the fresh address)');
  const before = await conn.getBalance(recipient.publicKey);
  const withdrawIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      meta(pool, false, false), meta(vault, false, true), meta(assocSet, false, false),
      meta(nullifierRec, false, true), meta(recipient.publicKey, false, true),
      meta(payer.publicKey, true, true), meta(SystemProgram.programId, false, false),
    ],
    data: Buffer.concat([
      disc('withdraw'),
      Buffer.from(fp.a), Buffer.from(fp.b), Buffer.from(fp.c),
      be32(w.publicInputs.poolRoot), be32(w.publicInputs.associationRoot),
      be32(w.publicInputs.nullifier), u64le(FEE),
    ]),
  });
  sig = await sendAndConfirmTransaction(conn, new Transaction().add(withdrawIx), [payer], { skipPreflight: false });
  const after = await conn.getBalance(recipient.publicKey);

  log('     ok', sig);
  log('     recipient (fresh addr):', recipient.publicKey.toBase58());
  log('     recipient balance:', before / LAMPORTS_PER_SOL, '→', after / LAMPORTS_PER_SOL, 'SOL');
  log('\n────────────────────────────────────────────');
  if (after - before === DENOM - FEE) {
    log('✅  WORKS END-TO-END: shielded withdrawal paid out, proof verified ON-CHAIN.');
    log('    tx: https://explorer.solana.com/tx/' + sig + '?cluster=devnet');
  } else {
    log('⚠️  withdrawal did not pay the expected amount — inspect the tx.');
    process.exit(1);
  }
}

main().catch((e) => { console.error('\nFAILED:', e.message || e); process.exit(1); });
