const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

// Helper function to generate test input for transfer circuit
function generateTransferInput() {
    return {
        inAmount: 100,
        inNullifier: "0x1234567890abcdef",
        inSecret: "0xfedcba0987654321",
        inPathElements: Array(32).fill("0x0"),
        inPathIndices: Array(32).fill(0),
        outCommitment: "0xabcdef1234567890",
        merkleRoot: "0x0987654321fedcba",
        recipientPubKey: "0x1234567890abcdef"
    };
}

// Helper function to generate test input for merkle circuit
function generateMerkleInput() {
    return {
        root: "0x1234567890abcdef",
        leaf: "0xfedcba0987654321",
        pathElements: Array(32).fill("0x0"),
        pathIndices: Array(32).fill(0)
    };
}

// Helper function to generate test input for nullifier circuit
function generateNullifierInput() {
    return {
        noteCommitment: "0x1234567890abcdef",
        secret: "0xfedcba0987654321"
    };
}

// Helper function to generate test input for audit proof circuit
function generateAuditInput() {
    return {
        noteCommitment: "0x1234567890abcdef",
        viewKey: "0xfedcba0987654321",
        amount: 100,
        timestamp: 1234567890,
        purpose: "compliance",
        auditId: "0xabcdef1234567890",
        merkleRoot: "0x0987654321fedcba"
    };
}

// Helper function to generate test input for withdraw circuit
function generateWithdrawInput() {
    return {
        inAmount: 100,
        inNullifier: "0x1234567890abcdef",
        inSecret: "0xfedcba0987654321",
        inPathElements: Array(32).fill("0x0"),
        inPathIndices: Array(32).fill(0),
        merkleRoot: "0x0987654321fedcba",
        recipientAddress: "0x1234567890abcdef",
        withdrawalAmount: 100
    };
}

// Helper function to generate test input for zkStream circuit
function generateZkStreamInput() {
    return {
        totalAmount: 1000,
        startTime: 1234567890,
        endTime: 1234567890 + 86400, // 24 hours later
        currentTime: 1234567890 + 43200, // 12 hours later
        streamSecret: "0xfedcba0987654321",
        streamId: "0x1234567890abcdef",
        recipientAddress: "0xabcdef1234567890",
        merkleRoot: "0x0987654321fedcba",
        streamCommitment: "0x1234567890abcdef"
    };
}

// Helper function to generate test input for zkSplit circuit
function generateZkSplitInput() {
    return {
        totalAmount: 1000,
        splitSecret: "0xfedcba0987654321",
        splitId: "0x1234567890abcdef",
        numRecipients: 3,
        recipientAddresses: [
            "0x1234567890abcdef",
            "0xabcdef1234567890",
            "0x0987654321fedcba",
            ...Array(7).fill("0x0")
        ],
        splitAmounts: [400, 350, 250, ...Array(7).fill(0)],
        merkleRoot: "0x0987654321fedcba",
        splitCommitment: "0x1234567890abcdef"
    };
}

// Helper function to generate test input for zkCondition circuit
function generateZkConditionInput() {
    return {
        amount: 1000,
        conditionSecret: "0xfedcba0987654321",
        conditionId: "0x1234567890abcdef",
        conditionType: 0, // Time-based
        conditionValue: 1234567890 + 86400, // 24 hours later
        currentValue: 1234567890 + 43200, // 12 hours later
        recipientAddress: "0xabcdef1234567890",
        merkleRoot: "0x0987654321fedcba",
        conditionCommitment: "0x1234567890abcdef"
    };
}

// Helper function to load circuit and keys
async function loadCircuit(circuitName) {
    const buildPath = path.join(__dirname, `../build/${circuitName}`);
    
    const circuit = await snarkjs.groth16.loadCircuit(
        path.join(buildPath, `${circuitName}.wasm`)
    );
    const provingKey = JSON.parse(
        fs.readFileSync(path.join(buildPath, 'proving_key.json'))
    );
    const verificationKey = JSON.parse(
        fs.readFileSync(path.join(buildPath, 'verification_key.json'))
    );

    return { circuit, provingKey, verificationKey };
}

module.exports = {
    generateTransferInput,
    generateMerkleInput,
    generateNullifierInput,
    generateAuditInput,
    generateWithdrawInput,
    generateZkStreamInput,
    generateZkSplitInput,
    generateZkConditionInput,
    loadCircuit
}; 