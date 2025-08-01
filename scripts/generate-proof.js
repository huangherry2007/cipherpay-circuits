const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

async function generateProof(circuitName, input) {
    console.log(`Generating proof for ${circuitName} circuit...`);

    const buildPath = path.join(__dirname, `../build/${circuitName}`);

    // Load the circuit and keys
    const wasmPath = path.join(buildPath, `${circuitName}_js/${circuitName}.wasm`);
    const zkeyPath = path.join(buildPath, `${circuitName}.zkey`);

    // Check if files exist
    if (!fs.existsSync(wasmPath)) {
        throw new Error(`WASM file not found at ${wasmPath}. Please run setup.js first.`);
    }
    if (!fs.existsSync(zkeyPath)) {
        throw new Error(`ZKey file not found at ${zkeyPath}. Please run setup.js first.`);
    }

    // Generate the proof using the correct snarkjs API
    console.log('Generating proof...');
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        wasmPath,
        zkeyPath
    );

    // Save the proof and public signals
    const proofPath = path.join(buildPath, 'proof.json');
    const signalsPath = path.join(buildPath, 'public_signals.json');

    fs.writeFileSync(proofPath, JSON.stringify(proof));
    fs.writeFileSync(signalsPath, JSON.stringify(publicSignals));

    console.log(`Proof generated and saved to ${proofPath}`);
    return { proof, publicSignals };
}

// Example inputs for core circuits
const exampleInputs = {
    transfer: {
        // === Private input note (5-field note preimage) ===
        inAmount: "1000000000000000000", // 1 ETH in wei
        inSenderWalletPubKey: "1234567890123456789012345678901234567890123456789012345678901234",
        inSenderWalletPrivKey: "1111111111111111111111111111111111111111111111111111111111111111",
        inRandomness: "9876543210987654321098765432109876543210987654321098765432109876",
        inTokenId: "1",
        inMemo: "0",
        inPathElements: Array(16).fill("0"),
        inPathIndices: Array(16).fill(0),

        // === Output note 1 (for recipient) ===
        out1Amount: "800000000000000000", // 0.8 ETH to recipient
        out1RecipientCipherPayPubKey: "2222222222222222222222222222222222222222222222222222222222222222",
        out1Randomness: "4444444444444444444444444444444444444444444444444444444444444444",
        out1TokenId: "1",
        out1Memo: "0",

        // === Output note 2 (change note) ===
        out2Amount: "200000000000000000", // 0.2 ETH change
        out2SenderCipherPayPubKey: "5555555555555555555555555555555555555555555555555555555555555555",
        out2Randomness: "7777777777777777777777777777777777777777777777777777777777777777",
        out2TokenId: "1",
        out2Memo: "0"
    },

    withdraw: {
        // === Private inputs ===
        recipientWalletPrivKey: "1111111111111111111111111111111111111111111111111111111111111111",
        randomness: "9876543210987654321098765432109876543210987654321098765432109876",
        memo: "0",
        pathElements: Array(16).fill("0"),
        pathIndices: Array(16).fill(0),

        // === Public inputs ===
        recipientWalletPubKey: "1234567890123456789012345678901234567890123456789012345678901234",
        amount: "1000000000000000000", // 1 ETH in wei
        tokenId: "1",
        commitment: "7777777777777777777777777777777777777777777777777777777777777777"
    },

    deposit: {
        // Private inputs for note (5-field structure)
        ownerWalletPubKey: "1234567890123456789012345678901234567890123456789012345678901234",
        ownerWalletPrivKey: "1111111111111111111111111111111111111111111111111111111111111111",
        randomness: "9876543210987654321098765432109876543210987654321098765432109876",
        tokenId: "1",
        memo: "0",

        // Public inputs
        nonce: "1",
        amount: "1000000000000000000", // 1 ETH in wei
        // Note: This depositHash should match the computed hash from ownerCipherPayPubKey, amount, nonce
        depositHash: "3333333333333333333333333333333333333333333333333333333333333333"
    },

    nullifier: {
        // === Private inputs ===
        ownerWalletPubKey: "1234567890123456789012345678901234567890123456789012345678901234",
        ownerWalletPrivKey: "1111111111111111111111111111111111111111111111111111111111111111",
        randomness: "9876543210987654321098765432109876543210987654321098765432109876",
        tokenId: "1"
    }
};

// Example usage
async function main() {
    const circuitName = process.argv[2] || 'transfer';

    if (!exampleInputs[circuitName]) {
        console.error(`Error: No example input found for circuit '${circuitName}'`);
        console.error('Available circuits:', Object.keys(exampleInputs).join(', '));
        process.exit(1);
    }

    try {
        console.log(`Generating proof for ${circuitName} circuit...`);
        const { proof, publicSignals } = await generateProof(circuitName, exampleInputs[circuitName]);
        console.log('Proof generated successfully!');
        console.log('Public signals:', publicSignals);
        console.log('');
        console.log('Note: These are example inputs. In production, use real note data and private keys.');
    } catch (err) {
        console.error('Error generating proof:', err);
        process.exit(1);
    }
}

main(); 