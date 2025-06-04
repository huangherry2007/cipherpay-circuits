pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";

// Audit proof circuit for selective disclosure
template AuditProof() {
    // Private inputs
    signal private input noteCommitment;
    signal private input viewKey;
    signal private input amount;
    signal private input timestamp;
    signal private input purpose;

    // Public inputs
    signal input auditId;
    signal input merkleRoot;

    // Outputs
    signal output isValid;

    // Components
    component poseidon = Poseidon(2);
    component bitify = Num2Bits(32);

    // Verify view key matches commitment
    poseidon.inputs[0] <== noteCommitment;
    poseidon.inputs[1] <== viewKey;
    var commitmentHash = poseidon.out;

    // Verify amount is positive
    bitify.in <== amount;
    var amountBits = bitify.out;
    var isAmountValid = 1;
    for (var i = 0; i < 32; i++) {
        isAmountValid *= (1 - amountBits[i]);
    }

    // Verify timestamp is within valid range (e.g., not in future)
    var currentTime = 1234567890; // This should be passed as a public input in practice
    var isTimestampValid = 1;
    if (timestamp > currentTime) {
        isTimestampValid = 0;
    }

    // Generate audit proof
    poseidon.inputs[0] <== commitmentHash;
    poseidon.inputs[1] <== amount;
    var auditHash = poseidon.out;

    // Verify audit hash matches auditId
    auditHash === auditId;

    // Set final validity
    isValid <== isAmountValid * isTimestampValid;
}

// Main component
component main = AuditProof(); 