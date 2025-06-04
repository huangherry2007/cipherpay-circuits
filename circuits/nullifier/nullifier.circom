pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";

// Nullifier generation circuit
template Nullifier() {
    // Private inputs
    signal private input noteCommitment;
    signal private input secret;

    // Public output
    signal output nullifier;

    // Components
    component poseidon = Poseidon(2);

    // Generate nullifier using Poseidon hash
    poseidon.inputs[0] <== noteCommitment;
    poseidon.inputs[1] <== secret;
    nullifier <== poseidon.out;
}

// Main component
component main = Nullifier(); 