pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";

// zkSplit circuit for handling payment splitting
template ZkSplit() {
    // Private inputs
    signal input totalAmount;
    signal input splitSecret;
    signal input splitId;
    signal input amounts[2]; // Array of split amounts
    signal input recipientAddresses[2]; // Array of recipient addresses

    // Public inputs
    signal input merkleRoot;
    signal input splitCommitment;

    // Outputs
    signal output isValid;

    // Components
    component poseidonCommitment = Poseidon(2);
    component isEqualCommitment = IsEqual();
    component isEqualRecipient1 = IsEqual();
    component isEqualRecipient2 = IsEqual();
    component isPositive1 = LessThan(32);
    component isPositive2 = LessThan(32);

    // Verify commitment
    poseidonCommitment.inputs[0] <== splitId;
    poseidonCommitment.inputs[1] <== splitSecret;
    var computedCommitment = poseidonCommitment.out;

    isEqualCommitment.in[0] <== computedCommitment;
    isEqualCommitment.in[1] <== splitCommitment;
    var isCommitmentValid = isEqualCommitment.out;

    // Verify amounts are positive
    isPositive1.in[0] <== 0;
    isPositive1.in[1] <== amounts[0];
    var isAmount1Positive = isPositive1.out;

    isPositive2.in[0] <== 0;
    isPositive2.in[1] <== amounts[1];
    var isAmount2Positive = isPositive2.out;

    // Verify recipient addresses are valid (non-zero)
    isEqualRecipient1.in[0] <== recipientAddresses[0];
    isEqualRecipient1.in[1] <== 0;
    var isRecipient1Valid = 1 - isEqualRecipient1.out;

    isEqualRecipient2.in[0] <== recipientAddresses[1];
    isEqualRecipient2.in[1] <== 0;
    var isRecipient2Valid = 1 - isEqualRecipient2.out;

    // Verify total amount matches sum of splits
    signal sumAmounts;
    sumAmounts <== amounts[0] + amounts[1];
    sumAmounts === totalAmount;

    // Combine validity checks using intermediate signals
    signal intermediate1;
    intermediate1 <== isCommitmentValid * isAmount1Positive;

    signal intermediate2;
    intermediate2 <== intermediate1 * isAmount2Positive;

    signal intermediate3;
    intermediate3 <== intermediate2 * isRecipient1Valid;

    // Set final validity
    isValid <== intermediate3 * isRecipient2Valid;
}

// Helper circuit for split generation
template SplitGeneration() {
    signal input splitId;
    signal input splitSecret;
    signal output out;

    component poseidon = Poseidon(2);
    poseidon.inputs[0] <== splitId;
    poseidon.inputs[1] <== splitSecret;
    out <== poseidon.out;
}

// Main component
component main = ZkSplit(); 