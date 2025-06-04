const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

async function generateProof(circuitName, input) {
    console.log(`Generating proof for ${circuitName} circuit...`);
    
    const buildPath = path.join(__dirname, `../build/${circuitName}`);
    
    // Load the circuit and keys
    const circuit = await snarkjs.groth16.loadCircuit(
        path.join(buildPath, `${circuitName}.wasm`)
    );
    const provingKey = JSON.parse(
        fs.readFileSync(path.join(buildPath, 'proving_key.json'))
    );

    // Generate the proof
    console.log('Generating proof...');
    const { proof, publicSignals } = await snarkjs.groth16.prove(
        provingKey,
        input
    );

    // Save the proof and public signals
    const proofPath = path.join(buildPath, 'proof.json');
    const signalsPath = path.join(buildPath, 'public_signals.json');
    
    fs.writeFileSync(proofPath, JSON.stringify(proof));
    fs.writeFileSync(signalsPath, JSON.stringify(publicSignals));

    console.log(`Proof generated and saved to ${proofPath}`);
    return { proof, publicSignals };
}

// Example usage
async function main() {
    // Example input for transfer circuit
    const transferInput = {
        inAmount: 100,
        inNullifier: "0x123...",
        inSecret: "0x456...",
        inPathElements: Array(32).fill("0x0"),
        inPathIndices: Array(32).fill(0),
        outCommitment: "0x789...",
        merkleRoot: "0xabc...",
        recipientPubKey: "0xdef..."
    };

    try {
        const { proof, publicSignals } = await generateProof('transfer', transferInput);
        console.log('Proof generated successfully!');
        console.log('Public signals:', publicSignals);
    } catch (err) {
        console.error('Error generating proof:', err);
        process.exit(1);
    }
}

main(); 