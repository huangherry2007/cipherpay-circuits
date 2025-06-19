pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

// zkCondition circuit for handling conditional payments
template ZkCondition() {
    // Private inputs
    signal input conditionType; // 0: Time-based, 1: Event-based, 2: Threshold-based
    signal input conditionSecret;
    signal input conditionId;
    signal input currentTime;
    signal input targetTime;
    signal input eventHash;
    signal input targetHash;
    signal input currentAmount;
    signal input thresholdAmount;

    // Public inputs
    signal input merkleRoot;
    signal input conditionCommitment;

    // Outputs
    signal output isValid;
    signal output isConditionMet;

    // Components
    component poseidonCommitment = Poseidon(2);
    component isEqualCommitment = IsEqual();
    component isLessThanTime = LessThan(32);
    component isEqualEvent = IsEqual();
    component isLessThanAmount = LessThan(32);
    component isPositive = LessThan(32);
    component isEqualType0 = IsEqual();
    component isEqualType1 = IsEqual();
    component isEqualType2 = IsEqual();

    // Verify commitment
    poseidonCommitment.inputs[0] <== conditionId;
    poseidonCommitment.inputs[1] <== conditionSecret;
    var computedCommitment = poseidonCommitment.out;

    isEqualCommitment.in[0] <== computedCommitment;
    isEqualCommitment.in[1] <== conditionCommitment;
    var isCommitmentValid = isEqualCommitment.out;

    // Time-based condition check
    isLessThanTime.in[0] <== currentTime;
    isLessThanTime.in[1] <== targetTime;
    var isTimeValid = isLessThanTime.out;

    // Event-based condition check
    isEqualEvent.in[0] <== eventHash;
    isEqualEvent.in[1] <== targetHash;
    var isEventValid = isEqualEvent.out;

    // Threshold-based condition check
    isLessThanAmount.in[0] <== currentAmount;
    isLessThanAmount.in[1] <== thresholdAmount;
    var isThresholdValid = isLessThanAmount.out;

    // Amount positivity check
    isPositive.in[0] <== 0;
    isPositive.in[1] <== currentAmount;
    var isAmountPositive = isPositive.out;

    // Create type selectors using equality checks
    isEqualType0.in[0] <== conditionType;
    isEqualType0.in[1] <== 0;
    var isTimeType = isEqualType0.out;

    isEqualType1.in[0] <== conditionType;
    isEqualType1.in[1] <== 1;
    var isEventType = isEqualType1.out;

    isEqualType2.in[0] <== conditionType;
    isEqualType2.in[1] <== 2;
    var isThresholdType = isEqualType2.out;

    // Combine condition checks using type selectors
    signal timeBasedMet;
    timeBasedMet <== isTimeType * isTimeValid;

    signal eventBasedMet;
    eventBasedMet <== isEventType * isEventValid;

    signal thresholdBasedMet;
    thresholdBasedMet <== isThresholdType * isThresholdValid;

    // Combine all condition checks
    isConditionMet <== timeBasedMet + eventBasedMet + thresholdBasedMet;

    // Combine validity checks using intermediate signals
    signal intermediate1;
    intermediate1 <== isConditionMet * isCommitmentValid;

    // Set final validity
    isValid <== intermediate1 * isAmountPositive;
}

// Main component
component main = ZkCondition(); 