#!/usr/bin/env bash
# zSOL — end-to-end proving pipeline.
#
# Compiles the circuit, generates a witness from the tested SDK, runs a Groth16
# trusted setup (a throwaway one for local proving — a real deployment needs a
# multi-party ceremony), proves, and verifies. All offline; no downloads.
#
# Usage: bash build.sh   (from protocol/circuits)
set -euo pipefail

export PATH="$HOME/.cargo/bin:$PATH"
ROOT="/home/user/Bingo-"
SNARKJS="$ROOT/node_modules/.bin/snarkjs"
LIB="$ROOT/node_modules/circomlib/circuits"
BUILD="./build"
mkdir -p "$BUILD"

echo "==> 1/6  Compile withdraw.circom"
circom withdraw.circom --r1cs --wasm --sym -l "$LIB" -o "$BUILD"
$SNARKJS r1cs info "$BUILD/withdraw.r1cs"

echo "==> 2/6  Generate witness input from the SDK"
( cd "$ROOT" && ./node_modules/.bin/vite-node protocol/circuits/gen-input.ts )

echo "==> 3/6  Compute the witness"
node "$BUILD/withdraw_js/generate_witness.js" \
     "$BUILD/withdraw_js/withdraw.wasm" input.json "$BUILD/witness.wtns"

echo "==> 4/6  Trusted setup (local, throwaway)"
if [ ! -f "$BUILD/pot16_final.ptau" ]; then
  $SNARKJS powersoftau new bn128 16 "$BUILD/pot16_0.ptau" -v
  $SNARKJS powersoftau contribute "$BUILD/pot16_0.ptau" "$BUILD/pot16_1.ptau" \
    --name="zsol-local" -v -e="$(head -c32 /dev/urandom | xxd -p)"
  $SNARKJS powersoftau prepare phase2 "$BUILD/pot16_1.ptau" "$BUILD/pot16_final.ptau" -v
fi
$SNARKJS groth16 setup "$BUILD/withdraw.r1cs" "$BUILD/pot16_final.ptau" "$BUILD/withdraw_0.zkey"
$SNARKJS zkey contribute "$BUILD/withdraw_0.zkey" "$BUILD/withdraw_final.zkey" \
  --name="zsol-key" -v -e="$(head -c32 /dev/urandom | xxd -p)"
$SNARKJS zkey export verificationkey "$BUILD/withdraw_final.zkey" "$BUILD/verification_key.json"

echo "==> 5/6  Prove"
$SNARKJS groth16 prove "$BUILD/withdraw_final.zkey" "$BUILD/witness.wtns" \
  "$BUILD/proof.json" "$BUILD/public.json"

echo "==> 6/6  Verify"
$SNARKJS groth16 verify "$BUILD/verification_key.json" "$BUILD/public.json" "$BUILD/proof.json"

echo "==> check: proof's public signals match the SDK's expected values"
node -e "
const pub=require('./build/public.json'), exp=require('./expected.json');
if (JSON.stringify(pub)!==JSON.stringify(exp)) { console.error('MISMATCH'); process.exit(1); }
console.log('  match: OK');
"

echo "==> check: a tampered public signal is rejected"
node -e "
const fs=require('fs'), p=require('./build/public.json'), t=[...p];
t[2]=(BigInt(t[2])+1n).toString(); fs.writeFileSync('build/public_tampered.json',JSON.stringify(t));
"
if $SNARKJS groth16 verify "$BUILD/verification_key.json" "$BUILD/public_tampered.json" "$BUILD/proof.json" 2>/dev/null; then
  echo "  FAIL: tampered proof was accepted"; exit 1
else
  echo "  tampered proof rejected: OK"
fi

# Preserve the dev verifying key for wiring the on-chain verifier.
mkdir -p artifacts
cp "$BUILD/verification_key.json" artifacts/verification_key.dev.json

echo
echo "ALL CHECKS PASSED — real zk proof generated, verified, and tamper-rejected."
