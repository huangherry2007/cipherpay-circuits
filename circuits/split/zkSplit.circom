pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";

// zkSplit circuit for handling payment splitting
template ZkSplit() {
    // Private inputs
    signal private input totalAmount;
    signal private input splitSecret;
    signal private input splitId;
    signal private input numRecipients;

    // Public inputs
    signal input recipientAddresses[10]; // Maximum 10 recipients
    signal input splitAmounts[10];      // Corresponding amounts
    signal input merkleRoot;
    signal input splitCommitment;

    // Outputs
    signal output isValid;

    // Components
    component poseidon = Poseidon(2);
    component bitify = Num2Bits(32);
    component isLessThan = LessThan(32);
    component isEqual = IsEqual();

    // Verify split commitment
    poseidon.inputs[0] <== splitId;
    poseidon.inputs[1] <== splitSecret;
    var computedCommitment = poseidon.out;

    // Verify commitment matches
    isEqual.in[0] <== computedCommitment;
    isEqual.in[1] <== splitCommitment;
    var isCommitmentValid = isEqual.out;

    // Verify total amount matches sum of splits
    var sumAmount = 0;
    for (var i = 0; i < 10; i++) {
        if (i < numRecipients) {
            sumAmount += splitAmounts[i];
        }
    }
    var isAmountValid = 1;
    if (sumAmount != totalAmount) {
        isAmountValid = 0;
    }

    // Verify all amounts are positive
    var areAmountsPositive = 1;
    for (var i = 0; i < 10; i++) {
        if (i < numRecipients) {
            if (splitAmounts[i] <= 0) {
                areAmountsPositive = 0;
            }
        }
    }

    // Verify all recipient addresses are valid (non-zero)
    var areRecipientsValid = 1;
    for (var i = 0; i < 10; i++) {
        if (i < numRecipients) {
            if (recipientAddresses[i] == 0) {
                areRecipientsValid = 0;
            }
        }
    }

    // Set final validity
    isValid <== isCommitmentValid * isAmountValid * areAmountsPositive * areRecipientsValid;
}

// Main component
component main = ZkSplit(); 