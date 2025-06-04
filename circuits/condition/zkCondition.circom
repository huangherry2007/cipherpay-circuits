pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";

// zkCondition circuit for handling conditional payments
template ZkCondition() {
    // Private inputs
    signal private input amount;
    signal private input conditionSecret;
    signal private input conditionId;
    signal private input conditionType; // 0: time-based, 1: event-based, 2: threshold-based
    signal private input conditionValue;
    signal private input currentValue;

    // Public inputs
    signal input recipientAddress;
    signal input merkleRoot;
    signal input conditionCommitment;

    // Outputs
    signal output isValid;
    signal output isConditionMet;

    // Components
    component poseidon = Poseidon(2);
    component bitify = Num2Bits(32);
    component isLessThan = LessThan(32);
    component isEqual = IsEqual();

    // Verify condition commitment
    poseidon.inputs[0] <== conditionId;
    poseidon.inputs[1] <== conditionSecret;
    var computedCommitment = poseidon.out;

    // Verify commitment matches
    isEqual.in[0] <== computedCommitment;
    isEqual.in[1] <== conditionCommitment;
    var isCommitmentValid = isEqual.out;

    // Verify recipient address is valid (non-zero)
    var isRecipientValid = 1;
    if (recipientAddress == 0) {
        isRecipientValid = 0;
    }

    // Check condition based on type
    var conditionMet = 0;
    if (conditionType == 0) { // Time-based
        isLessThan.in[0] <== currentValue;
        isLessThan.in[1] <== conditionValue;
        conditionMet = isLessThan.out;
    } else if (conditionType == 1) { // Event-based
        isEqual.in[0] <== currentValue;
        isEqual.in[1] <== conditionValue;
        conditionMet = isEqual.out;
    } else if (conditionType == 2) { // Threshold-based
        isLessThan.in[0] <== conditionValue;
        isLessThan.in[1] <== currentValue;
        conditionMet = isLessThan.out;
    }

    // Verify amount is positive
    var isAmountPositive = 1;
    if (amount <= 0) {
        isAmountPositive = 0;
    }

    // Set outputs
    isValid <== isCommitmentValid * isRecipientValid * isAmountPositive;
    isConditionMet <== conditionMet;
}

// Main component
component main = ZkCondition(); 