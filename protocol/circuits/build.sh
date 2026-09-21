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

echo
echo "Public signals produced by the proof:"
cat "$BUILD/public.json"
echo
echo "Public signals the SDK expected:"
cat expected.json
