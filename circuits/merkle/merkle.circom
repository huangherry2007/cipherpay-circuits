pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";

// Merkle tree proof verification circuit
template MerkleProof(depth) {
    // Public inputs
    signal input root;
    signal input leaf;

    // Private inputs
    signal input pathElements[depth];
    signal input pathIndices[depth];

    // Merkle path signals
    signal left[depth];
    signal right[depth];

    // Components
    component poseidonHash[depth];  // Array of Poseidon components for Merkle path

    // Initialize Poseidon components for Merkle path
    for (var i = 0; i < depth; i++) {
        poseidonHash[i] = Poseidon(2);
    }

    // Verify Merkle path
    var current = leaf;
    for (var i = 0; i < depth; i++) {
        // Use binary selection with quadratic constraints
        // left = pathIndices[i] ? pathElements[i] : current
        left[i] <== pathIndices[i] * (pathElements[i] - current) + current;
        
        // right = pathIndices[i] ? current : pathElements[i]
        right[i] <== pathIndices[i] * (current - pathElements[i]) + pathElements[i];
        
        poseidonHash[i].inputs[0] <== left[i];
        poseidonHash[i].inputs[1] <== right[i];
        current = poseidonHash[i].out;
    }
    current === root;
}

// Main component with 32 levels (standard for most use cases)
component main = MerkleProof(32); 