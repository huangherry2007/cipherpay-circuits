const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

async function verifyProof(circuitName) {
    console.log(`Verifying proof for ${circuitName} circuit...`);

    const buildPath = path.join(__dirname, `../build/${circuitName}`);

    // Check if required files exist
    const verificationKeyPath = path.join(buildPath, 'verification_key.json');
    const proofPath = path.join(buildPath, 'proof.json');
    const signalsPath = path.join(buildPath, 'public_signals.json');

    if (!fs.existsSync(verificationKeyPath)) {
        console.error(`Error: Verification key not found at ${verificationKeyPath}`);
        console.error('Please run setup.js first to generate verification keys.');
        process.exit(1);
    }

    if (!fs.existsSync(proofPath)) {
        console.error(`Error: Proof file not found at ${proofPath}`);
        console.error('Please run generate-proof.js first to generate a proof.');
        process.exit(1);
    }

    if (!fs.existsSync(signalsPath)) {
        console.error(`Error: Public signals file not found at ${signalsPath}`);
        console.error('Please run generate-proof.js first to generate public signals.');
        process.exit(1);
    }

    // Load the verification key and proof
    const verificationKey = JSON.parse(
        fs.readFileSync(verificationKeyPath)
    );
    const proof = JSON.parse(
        fs.readFileSync(proofPath)
    );
    const publicSignals = JSON.parse(
        fs.readFileSync(signalsPath)
    );

    // Verify the proof
    console.log('Verifying proof...');
    const isValid = await snarkjs.groth16.verify(
        verificationKey,
        publicSignals,
        proof
    );

    if (isValid) {
        console.log('✅ Proof is valid!');
        console.log('');
        console.log('Public signals:');
        publicSignals.forEach((signal, index) => {
            console.log(`  [${index}]: ${signal}`);
        });
    } else {
        console.error('❌ Proof is invalid!');
        process.exit(1);
    }

    return isValid;
}

// Example usage
async function main() {
    const circuitName = process.argv[2] || 'transfer';

    // Available circuits
    const availableCircuits = [
        'transfer',
        'withdraw',
        'deposit',
        'nullifier'
    ];

    if (!availableCircuits.includes(circuitName)) {
        console.error(`Error: Unknown circuit '${circuitName}'`);
        console.error('Available circuits:', availableCircuits.join(', '));
        console.error('');
        console.error('Usage: node verify-proof.js [circuit_name]');
        console.error('Example: node verify-proof.js transfer');
        process.exit(1);
    }

    try {
        await verifyProof(circuitName);
    } catch (err) {
        console.error('Error verifying proof:', err);
        process.exit(1);
    }
}

main(); 