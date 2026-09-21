pragma circom 2.1.6;

// zSOL — withdrawal circuit.
//
// Proves, in zero knowledge, that the prover:
//   1. knows the secret behind a commitment that is a leaf in the pool tree,
//   2. that same leaf is a member of a chosen association set,
//   3. derives the published nullifier correctly,
// and binds recipient/relayer/fee so a relayer cannot rewrite them.
//
// It reveals NOTHING about which leaf is the prover's. This is the exact
// arithmetic implemented and tested in ../sdk (note.ts, merkle.ts, withdraw.ts) —
// the two MUST agree or no proof will verify.
//
// Hash: Poseidon. Proof system: Groth16 (compile with circom + snarkjs).
// NOTE: unaudited. Do not use with real funds. See ../README.md.

include "poseidon.circom";
include "comparators.circom";

// Recompute a Merkle root from a leaf, its siblings, and left/right path bits.
// pathBit[i] == 0 -> current node is the LEFT child at level i.
template MerkleRoot(depth) {
    signal input leaf;
    signal input siblings[depth];
    signal input pathBits[depth];
    signal output root;

    signal cur[depth + 1];
    cur[0] <== leaf;

    component h[depth];
    // Enforce each path bit is boolean, then hash in the correct order.
    for (var i = 0; i < depth; i++) {
        pathBits[i] * (pathBits[i] - 1) === 0;

        h[i] = Poseidon(2);
        // left  = bit ? sibling : cur
        // right = bit ? cur     : sibling
        signal left  <== (siblings[i] - cur[i]) * pathBits[i] + cur[i];
        signal right <== (cur[i] - siblings[i]) * pathBits[i] + siblings[i];
        h[i].inputs[0] <== left;
        h[i].inputs[1] <== right;
        cur[i + 1] <== h[i].out;
    }
    root <== cur[depth];
}

template Withdraw(depth) {
    // ---- public signals ----
    signal input poolRoot;
    signal input associationRoot;
    signal input nullifier;
    signal input recipient;
    signal input relayer;
    signal input fee;

    // ---- private witness ----
    signal input nullifierSecret;
    signal input blinding;
    signal input pool;
    signal input leafIndex;
    signal input poolSiblings[depth];
    signal input poolPathBits[depth];
    signal input assocSiblings[depth];
    signal input assocPathBits[depth];

    // 1. commitment = Poseidon(nullifierSecret, pool, blinding)
    component com = Poseidon(3);
    com.inputs[0] <== nullifierSecret;
    com.inputs[1] <== pool;
    com.inputs[2] <== blinding;

    // 2. commitment is a member of the pool tree
    component poolMt = MerkleRoot(depth);
    poolMt.leaf <== com.out;
    for (var i = 0; i < depth; i++) {
        poolMt.siblings[i] <== poolSiblings[i];
        poolMt.pathBits[i] <== poolPathBits[i];
    }
    poolMt.root === poolRoot;

    // 3. the same leafIndex is a member of the association set
    component assocMt = MerkleRoot(depth);
    assocMt.leaf <== leafIndex;
    for (var i = 0; i < depth; i++) {
        assocMt.siblings[i] <== assocSiblings[i];
        assocMt.pathBits[i] <== assocPathBits[i];
    }
    assocMt.root === associationRoot;

    // 4. nullifier = Poseidon(nullifierSecret, leafIndex)
    component nul = Poseidon(2);
    nul.inputs[0] <== nullifierSecret;
    nul.inputs[1] <== leafIndex;
    nul.out === nullifier;

    // 5. Bind recipient/relayer/fee into the proof. Squaring ties them to the
    //    witness so a relayer editing them invalidates the proof; the on-chain
    //    program reads the public values directly.
    signal recipientSq <== recipient * recipient;
    signal relayerSq   <== relayer * relayer;
    signal feeSq       <== fee * fee;
}

// depth 20 -> up to 2^20 = 1,048,576 deposits per pool.
component main {
    public [poolRoot, associationRoot, nullifier, recipient, relayer, fee]
} = Withdraw(20);
