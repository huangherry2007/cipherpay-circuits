pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";

// Main transfer circuit for shielded transfers
template Transfer() {
    // Private inputs
    signal private input inAmount;
    signal private input inNullifier;
    signal private input inSecret;
    signal private input inPathElements[32];
    signal private input inPathIndices[32];

    // Public inputs
    signal input outCommitment;
    signal input merkleRoot;
    signal input recipientPubKey;

    // Outputs
    signal output outNullifier;

    // Components
    component poseidon = Poseidon(2);
    component bitify = Num2Bits(32);
    component isLessThan = LessThan(32);

    // Verify input amount is positive
    bitify.in <== inAmount;
    isLessThan.in[0] <== 0;
    isLessThan.in[1] <== inAmount;

    // Generate input commitment
    poseidon.inputs[0] <== inAmount;
    poseidon.inputs[1] <== inSecret;
    var inCommitment = poseidon.out;

    // Verify Merkle path
    var current = inCommitment;
    for (var i = 0; i < 32; i++) {
        if (inPathIndices[i] == 0) {
            current = Poseidon(2)([current, inPathElements[i]]);
        } else {
            current = Poseidon(2)([inPathElements[i], current]);
        }
    }
    current === merkleRoot;

    // Generate nullifier
    poseidon.inputs[0] <== inNullifier;
    poseidon.inputs[1] <== inSecret;
    outNullifier <== poseidon.out;

    // Generate output commitment
    poseidon.inputs[0] <== inAmount;
    poseidon.inputs[1] <== recipientPubKey;
    outCommitment <== poseidon.out;
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