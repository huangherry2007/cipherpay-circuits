const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

async function setupCircuit(circuitName) {
    console.log(`Setting up ${circuitName} circuit...`);
    
    // Load the circuit
    const circuitPath = path.join(__dirname, `../circuits/${circuitName}/${circuitName}.circom`);
    const buildPath = path.join(__dirname, `../build/${circuitName}`);
    
    // Create build directory if it doesn't exist
    if (!fs.existsSync(buildPath)) {
        fs.mkdirSync(buildPath, { recursive: true });
    }

    // Generate proving key and verification key
    console.log('Generating proving key and verification key...');
    const { provingKey, verificationKey } = await snarkjs.groth16.setup(
        circuitPath,
        path.join(buildPath, `${circuitName}.r1cs`),
        path.join(buildPath, `${circuitName}.wasm`)
    );

    // Save the keys
    fs.writeFileSync(
        path.join(buildPath, 'proving_key.json'),
        JSON.stringify(provingKey)
    );
    fs.writeFileSync(
        path.join(buildPath, 'verification_key.json'),
        JSON.stringify(verificationKey)
    );

    console.log(`${circuitName} circuit setup complete!`);
}

async function main() {
    const circuits = ['transfer', 'merkle', 'nullifier'];
    
    for (const circuit of circuits) {
        await setupCircuit(circuit);
    }
}

main().then(() => {
    console.log('All circuits setup complete!');
}).catch(err => {
    console.error('Error during setup:', err);
    process.exit(1);
}); 