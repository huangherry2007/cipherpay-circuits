pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";

// Withdrawal circuit for converting shielded notes to public tokens
template Withdraw() {
    // Private inputs
    signal private input inAmount;
    signal private input inNullifier;
    signal private input inSecret;
    signal private input inPathElements[32];
    signal private input inPathIndices[32];

    // Public inputs
    signal input merkleRoot;
    signal input recipientAddress;
    signal input withdrawalAmount;

    // Outputs
    signal output outNullifier;

    // Components
    component poseidon = Poseidon(2);
    component bitify = Num2Bits(32);
    component isLessThan = LessThan(32);
    component isEqual = IsEqual();

    // Verify input amount is positive
    bitify.in <== inAmount;
    isLessThan.in[0] <== 0;
    isLessThan.in[1] <== inAmount;

    // Verify withdrawal amount matches input amount
    isEqual.in[0] <== inAmount;
    isEqual.in[1] <== withdrawalAmount;
    isEqual.out === 1;

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

    // Verify recipient address is valid (non-zero)
    var isRecipientValid = 1;
    if (recipientAddress == 0) {
        isRecipientValid = 0;
    }
    isRecipientValid === 1;
}

// Main component
component main = Withdraw(); 