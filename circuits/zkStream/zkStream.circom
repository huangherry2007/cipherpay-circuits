pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

// zkStream circuit for handling streaming payments
template ZkStream() {
    // Private inputs
    signal input totalAmount;
    signal input startTime;
    signal input endTime;
    signal input currentTime;
    signal input streamSecret;
    signal input streamId;
    signal input claimedAmount;

    // Public inputs
    signal input recipientAddress;
    signal input merkleRoot;
    signal input streamCommitment;

    // Outputs
    signal output isValid;
    signal output availableAmount;

    // Components
    component poseidonCommitment = Poseidon(2);
    component isLessThanStart = LessThan(32);
    component isLessThanEnd = LessThan(32);
    component isEqualCommitment = IsEqual();
    component isEqualRecipient = IsEqual();

    // Verify time constraints
    isLessThanStart.in[0] <== startTime;
    isLessThanStart.in[1] <== currentTime;
    var isAfterStart = isLessThanStart.out;

    isLessThanEnd.in[0] <== currentTime;
    isLessThanEnd.in[1] <== endTime;
    var isBeforeEnd = isLessThanEnd.out;

    // Calculate time elapsed and total duration
    signal timeElapsed;
    timeElapsed <== currentTime - startTime;

    signal totalDuration;
    totalDuration <== endTime - startTime;

    // Calculate available amount based on time elapsed
    signal intermediate;
    intermediate <== totalAmount * timeElapsed;
    
    // Verify the claimed amount is correct
    claimedAmount * totalDuration === intermediate;

    // Set the output available amount
    availableAmount <== claimedAmount;

    // Verify stream commitment
    poseidonCommitment.inputs[0] <== streamId;
    poseidonCommitment.inputs[1] <== streamSecret;
    var computedCommitment = poseidonCommitment.out;

    // Verify commitment matches
    isEqualCommitment.in[0] <== computedCommitment;
    isEqualCommitment.in[1] <== streamCommitment;
    var isCommitmentValid = isEqualCommitment.out;

    // Verify recipient address is valid (non-zero)
    isEqualRecipient.in[0] <== recipientAddress;
    isEqualRecipient.in[1] <== 0;
    var isRecipientValid = 1 - isEqualRecipient.out;

    // Set validity using equality constraints
    signal isTimeValid;
    isTimeValid <== isAfterStart * isBeforeEnd;
    isTimeValid === 1;

    signal isCommitmentAndRecipientValid;
    isCommitmentAndRecipientValid <== isCommitmentValid * isRecipientValid;
    isCommitmentAndRecipientValid === 1;

    // Set outputs
    isValid <== 1;
}

// Helper circuit for stream generation
template StreamGeneration() {
    signal input streamId;
    signal input streamSecret;
    signal output out;

    component poseidon = Poseidon(2);
    poseidon.inputs[0] <== streamId;
    poseidon.inputs[1] <== streamSecret;
    out <== poseidon.out;
}

// Main component
component main = ZkStream(); 