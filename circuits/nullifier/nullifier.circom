pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";

// Nullifier generation circuit
template Nullifier() {
    // Private inputs
    signal input noteCommitment;
    signal input secret;

    // Public output
    signal output nullifier;

    // Components
    component poseidonNullifier = Poseidon(2);

    // Generate nullifier using Poseidon hash
    poseidonNullifier.inputs[0] <== noteCommitment;
    poseidonNullifier.inputs[1] <== secret;
    nullifier <== poseidonNullifier.out;
}

// Helper circuit for nullifier generation
template NullifierGeneration() {
    signal input noteCommitment;
    signal input secret;
    signal output out;

    component poseidon = Poseidon(2);
    poseidon.inputs[0] <== noteCommitment;
    poseidon.inputs[1] <== secret;
    out <== poseidon.out;
}

// Main component
component main = Nullifier(); 