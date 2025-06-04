pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";

// Merkle tree proof verification circuit
template MerkleProof(depth) {
    // Public inputs
    signal input root;
    signal input leaf;

    // Private inputs
    signal private input pathElements[depth];
    signal private input pathIndices[depth];

    // Components
    component poseidon = Poseidon(2);

    // Verify Merkle path
    var current = leaf;
    for (var i = 0; i < depth; i++) {
        if (pathIndices[i] == 0) {
            current = Poseidon(2)([current, pathElements[i]]);
        } else {
            current = Poseidon(2)([pathElements[i], current]);
        }
    }
    current === root;
}

// Main component with 32 levels (standard for most use cases)
component main = MerkleProof(32); 