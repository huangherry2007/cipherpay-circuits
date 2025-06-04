const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

async function verifyProof(circuitName) {
    console.log(`Verifying proof for ${circuitName} circuit...`);
    
    const buildPath = path.join(__dirname, `../build/${circuitName}`);
    
    // Load the verification key and proof
    const verificationKey = JSON.parse(
        fs.readFileSync(path.join(buildPath, 'verification_key.json'))
    );
    const proof = JSON.parse(
        fs.readFileSync(path.join(buildPath, 'proof.json'))
    );
    const publicSignals = JSON.parse(
        fs.readFileSync(path.join(buildPath, 'public_signals.json'))
    );

    // Verify the proof
    console.log('Verifying proof...');
    const isValid = await snarkjs.groth16.verify(
        verificationKey,
        publicSignals,
        proof
    );

    if (isValid) {
        console.log('Proof is valid!');
    } else {
        console.error('Proof is invalid!');
        process.exit(1);
    }

    return isValid;
}

// Example usage
async function main() {
    try {
        await verifyProof('transfer');
    } catch (err) {
        console.error('Error verifying proof:', err);
        process.exit(1);
    }
}

main(); 