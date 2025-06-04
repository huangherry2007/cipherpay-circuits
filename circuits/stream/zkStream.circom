pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";

// zkStream circuit for handling streaming payments
template ZkStream() {
    // Private inputs
    signal private input totalAmount;
    signal private input startTime;
    signal private input endTime;
    signal private input currentTime;
    signal private input streamSecret;
    signal private input streamId;

    // Public inputs
    signal input recipientAddress;
    signal input merkleRoot;
    signal input streamCommitment;

    // Outputs
    signal output isValid;
    signal output availableAmount;

    // Components
    component poseidon = Poseidon(2);
    component bitify = Num2Bits(32);
    component isLessThan = LessThan(32);
    component isEqual = IsEqual();

    // Verify time constraints
    isLessThan.in[0] <== startTime;
    isLessThan.in[1] <== currentTime;
    var isAfterStart = isLessThan.out;

    isLessThan.in[0] <== currentTime;
    isLessThan.in[1] <== endTime;
    var isBeforeEnd = isLessThan.out;

    // Calculate time elapsed and total duration
    var timeElapsed = currentTime - startTime;
    var totalDuration = endTime - startTime;

    // Calculate available amount based on time elapsed
    var timeBasedAmount = (totalAmount * timeElapsed) / totalDuration;

    // Verify stream commitment
    poseidon.inputs[0] <== streamId;
    poseidon.inputs[1] <== streamSecret;
    var computedCommitment = poseidon.out;

    // Verify commitment matches
    isEqual.in[0] <== computedCommitment;
    isEqual.in[1] <== streamCommitment;
    var isCommitmentValid = isEqual.out;

    // Verify recipient address is valid (non-zero)
    var isRecipientValid = 1;
    if (recipientAddress == 0) {
        isRecipientValid = 0;
    }

    // Set final validity
    isValid <== isAfterStart * isBeforeEnd * isCommitmentValid * isRecipientValid;
    availableAmount <== timeBasedAmount;
}

// Main component
component main = ZkStream(); 