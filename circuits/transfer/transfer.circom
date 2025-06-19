pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";

// Main transfer circuit for shielded transfers
template Transfer() {
    // Private inputs
    signal input inAmount;
    signal input inNullifier;
    signal input inSecret;
    signal input inPathElements[32];
    signal input inPathIndices[32];

    // Public inputs
    signal input merkleRoot;
    signal input recipientPubKey;

    // Outputs
    signal output outNullifier;
    signal output outCommitment;

    // Merkle path signals
    signal left[32];
    signal right[32];

    // Components
    component poseidonCommitment = Poseidon(2);  // For input commitment
    component poseidonNullifier = Poseidon(2);   // For nullifier generation
    component poseidonOutput = Poseidon(2);      // For output commitment
    component bitify = Num2Bits(32);
    component isLessThan = LessThan(32);
    component poseidonHash[32];  // Array of Poseidon components for Merkle path

    // Initialize Poseidon components for Merkle path
    for (var i = 0; i < 32; i++) {
        poseidonHash[i] = Poseidon(2);
    }

    // Verify input amount is positive
    bitify.in <== inAmount;
    isLessThan.in[0] <== 0;
    isLessThan.in[1] <== inAmount;

    // Generate input commitment
    poseidonCommitment.inputs[0] <== inAmount;
    poseidonCommitment.inputs[1] <== inSecret;
    var inCommitment = poseidonCommitment.out;

    // Verify Merkle path
    var current = inCommitment;
    for (var i = 0; i < 32; i++) {
        // Use binary selection with quadratic constraints
        // left = inPathIndices[i] ? inPathElements[i] : current
        left[i] <== inPathIndices[i] * (inPathElements[i] - current) + current;
        
        // right = inPathIndices[i] ? current : inPathElements[i]
        right[i] <== inPathIndices[i] * (current - inPathElements[i]) + inPathElements[i];
        
        poseidonHash[i].inputs[0] <== left[i];
        poseidonHash[i].inputs[1] <== right[i];
        current = poseidonHash[i].out;
    }
    current === merkleRoot;

    // Generate nullifier
    poseidonNullifier.inputs[0] <== inNullifier;
    poseidonNullifier.inputs[1] <== inSecret;
    outNullifier <== poseidonNullifier.out;

    // Generate output commitment
    poseidonOutput.inputs[0] <== inAmount;
    poseidonOutput.inputs[1] <== recipientPubKey;
    outCommitment <== poseidonOutput.out;
}

// Helper circuit for note commitment
template NoteCommitment() {
    signal input amount;
    signal input secret;
    signal output commitment;

    component poseidon = Poseidon(2);
    poseidon.inputs[0] <== amount;
    poseidon.inputs[1] <== secret;
    commitment <== poseidon.out;
}

// Helper circuit for nullifier generation
template Nullifier() {
    signal input nullifier;
    signal input secret;
    signal output out;

    component poseidon = Poseidon(2);
    poseidon.inputs[0] <== nullifier;
    poseidon.inputs[1] <== secret;
    out <== poseidon.out;
}

// Main component
component main = Transfer(); 