/**
 * Generate a real circuit witness from the tested SDK.
 *
 * Builds a small pool, assembles an honest, vouched withdrawal, and writes
 * `input.json` in the exact signal layout `withdraw.circom` expects — plus
 * `expected.json` with the public signals so we can confirm the proof carries
 * the right values. Run with vite-node (see build.sh).
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initHashers, newNote, commitment } from '../sdk/src/note';
import { MerkleTree } from '../sdk/src/merkle';
import { AssociationSet, buildWithdrawal, checkWithdrawal } from '../sdk/src/withdraw';

const DEPTH = 20;
const POOL_1_SOL = 1n;
const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const { h2, h3 } = await initHashers();

  const pool = new MerkleTree(DEPTH, h2);
  const set = new AssociationSet(DEPTH, h2);

  // A few honest depositors; we withdraw the middle one.
  const notes = [newNote(POOL_1_SOL), newNote(POOL_1_SOL), newNote(POOL_1_SOL)];
  const idx = notes.map((n) => pool.insert(commitment(h3, n)));
  idx.forEach((i) => set.add(i));

  const me = 1;
  const recipient = 0xABCDn;
  const relayer = 0xF00Dn;
  const fee = 1000n;

  const w = buildWithdrawal({
    h2, h3, note: notes[me], leafIndex: idx[me],
    poolTree: pool, associationSet: set, recipient, relayer, fee,
  });

  // Sanity: the SDK's own check must pass before we ever try to prove it.
  const ok = checkWithdrawal(h2, h3, notes[me], w);
  if (!ok.ok) throw new Error('SDK check failed — refusing to generate a bad witness: ' + JSON.stringify(ok));

  const s = (x: bigint) => x.toString();
  const input = {
    poolRoot: s(w.publicInputs.poolRoot),
    associationRoot: s(w.publicInputs.associationRoot),
    nullifier: s(w.publicInputs.nullifier),
    recipient: s(w.publicInputs.recipient),
    relayer: s(w.publicInputs.relayer),
    fee: s(w.publicInputs.fee),
    nullifierSecret: s(w.privateInputs.nullifierSecret),
    blinding: s(w.privateInputs.blinding),
    pool: s(w.privateInputs.pool),
    leafIndex: s(w.privateInputs.leafIndex),
    poolSiblings: w.privateInputs.poolSiblings.map(s),
    poolPathBits: w.privateInputs.poolPathBits.map(String),
    assocSiblings: w.privateInputs.assocSiblings.map(s),
    assocPathBits: w.privateInputs.assocPathBits.map(String),
  };

  writeFileSync(join(here, 'input.json'), JSON.stringify(input, null, 2));
  // Public signals in the circuit's declared order.
  writeFileSync(
    join(here, 'expected.json'),
    JSON.stringify(
      [input.poolRoot, input.associationRoot, input.nullifier, input.recipient, input.relayer, input.fee],
      null, 2,
    ),
  );
  console.log('wrote input.json (SDK check passed:', ok.ok + ')');
}

main().catch((e) => { console.error(e); process.exit(1); });
