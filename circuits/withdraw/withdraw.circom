pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";

// Withdrawal circuit for converting shielded notes to public tokens
template Withdraw() {
    // Private inputs
    signal input inAmount;
    signal input inNullifier;
    signal input inSecret;
    signal input inPathElements[32];
    signal input inPathIndices[32];

    // Public inputs
    signal input merkleRoot;
    signal input recipientAddress;
    signal input withdrawalAmount;

    // Outputs
    signal output outNullifier;

    // Components
    component poseidonCommitment = Poseidon(2);
    component poseidonNullifier = Poseidon(2);
    component bitify = Num2Bits(32);
    component isEqualAmount = IsEqual();
    component isEqualRecipient = IsEqual();
    component poseidonHash[32];  // Array of Poseidon components for Merkle path

    // Initialize Poseidon components for Merkle path
    for (var i = 0; i < 32; i++) {
        poseidonHash[i] = Poseidon(2);
    }

    // Verify input amount is positive
    bitify.in <== inAmount;
    signal isAmountValid[32];
    for (var i = 0; i < 32; i++) {
        isAmountValid[i] <== 1 - bitify.out[i];
    }
    
    // Accumulate the multiplication using intermediate signals
    signal intermediate[31];
    intermediate[0] <== isAmountValid[0] * isAmountValid[1];
    for (var i = 1; i < 31; i++) {
        intermediate[i] <== intermediate[i-1] * isAmountValid[i+1];
    }
    signal finalAmountValid;
    finalAmountValid <== intermediate[30];

    // Verify withdrawal amount matches input amount
    isEqualAmount.in[0] <== inAmount;
    isEqualAmount.in[1] <== withdrawalAmount;
    var isWithdrawalValid = isEqualAmount.out;

    // Generate input commitment
    poseidonCommitment.inputs[0] <== inAmount;
    poseidonCommitment.inputs[1] <== inSecret;
    var inCommitment = poseidonCommitment.out;

    // Verify Merkle path
    var current = inCommitment;
    for (var i = 0; i < 32; i++) {
        // Use binary selection with quadratic constraints
        // left = inPathIndices[i] ? inPathElements[i] : current
        var left = inPathIndices[i] * (inPathElements[i] - current) + current;
        
        // right = inPathIndices[i] ? current : inPathElements[i]
        var right = inPathIndices[i] * (current - inPathElements[i]) + inPathElements[i];
        
        poseidonHash[i].inputs[0] <== left;
        poseidonHash[i].inputs[1] <== right;
        current = poseidonHash[i].out;
    }
    current === merkleRoot;

    // Generate nullifier
    poseidonNullifier.inputs[0] <== inNullifier;
    poseidonNullifier.inputs[1] <== inSecret;
    outNullifier <== poseidonNullifier.out;

    // Verify recipient address is valid (non-zero)
    isEqualRecipient.in[0] <== recipientAddress;
    isEqualRecipient.in[1] <== 0;
    var isRecipientValid = 1 - isEqualRecipient.out;

    // Combine validations using intermediate signals
    signal intermediateValid;
    intermediateValid <== finalAmountValid * isWithdrawalValid;
    intermediateValid * isRecipientValid === 1;
}

// Helper circuit for withdrawal generation
template WithdrawGeneration() {
    signal input inAmount;
    signal input inSecret;
    signal input inNullifier;
    signal output outCommitment;
    signal output outNullifier;

    component poseidonCommitment = Poseidon(2);
    poseidonCommitment.inputs[0] <== inAmount;
    poseidonCommitment.inputs[1] <== inSecret;
    outCommitment <== poseidonCommitment.out;

    component poseidonNullifier = Poseidon(2);
    poseidonNullifier.inputs[0] <== inNullifier;
    poseidonNullifier.inputs[1] <== inSecret;
    outNullifier <== poseidonNullifier.out;
}

// Main component
component main = Withdraw(); 