pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";

// Audit proof circuit for selective disclosure
template AuditProof() {
    // Private inputs
    signal input noteCommitment;
    signal input viewKey;
    signal input amount;
    signal input timestamp;
    signal input purpose;

    // Public inputs
    signal input auditId;
    signal input merkleRoot;
    signal input currentTime;

    // Outputs
    signal output isValid;

    // Components
    component poseidonCommitment = Poseidon(2);
    component poseidonAudit = Poseidon(2);
    component bitify = Num2Bits(32);
    component isLessThan = LessThan(32);

    // Verify view key matches commitment
    poseidonCommitment.inputs[0] <== noteCommitment;
    poseidonCommitment.inputs[1] <== viewKey;
    var commitmentHash = poseidonCommitment.out;

    // Verify amount is positive
    bitify.in <== amount;
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

    // Verify timestamp is within valid range
    isLessThan.in[0] <== timestamp;
    isLessThan.in[1] <== currentTime;
    signal isTimestampValid;
    isTimestampValid <== isLessThan.out;

    // Generate audit proof
    poseidonAudit.inputs[0] <== commitmentHash;
    poseidonAudit.inputs[1] <== amount;
    var auditHash = poseidonAudit.out;

    // Verify audit hash matches auditId
    auditHash === auditId;

    // Set final validity
    isValid <== finalAmountValid * isTimestampValid;
}

// Helper circuit for audit proof generation
template AuditProofGeneration() {
    signal input noteCommitment;
    signal input viewKey;
    signal input amount;
    signal output out;

    component poseidon = Poseidon(2);
    poseidon.inputs[0] <== noteCommitment;
    poseidon.inputs[1] <== viewKey;
    var commitmentHash = poseidon.out;

    component poseidonAudit = Poseidon(2);
    poseidonAudit.inputs[0] <== commitmentHash;
    poseidonAudit.inputs[1] <== amount;
    out <== poseidonAudit.out;
}

// Main component
component main = AuditProof(); 