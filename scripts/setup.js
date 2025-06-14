const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function setupCircuit(circuitName) {
    console.log(`Setting up ${circuitName} circuit...`);
    
    // Load the circuit
    const circuitPath = path.join(__dirname, `../circuits/${circuitName}/${circuitName}.circom`);
    const buildPath = path.join(__dirname, `../build/${circuitName}`);
    
    // Create build directory if it doesn't exist
    if (!fs.existsSync(buildPath)) {
        fs.mkdirSync(buildPath, { recursive: true });
    }

    // Compile the circuit using circom CLI
    console.log('Compiling circuit...');
    execSync(`circom ${circuitPath} --r1cs --wasm -o ${buildPath}`, {
        stdio: 'inherit'
    });

    // Generate proving key and verification key
    console.log('Generating proving key and verification key...');
    const { zkey, vkey } = await snarkjs.groth16.setup(
        path.join(buildPath, `${circuitName}.r1cs`)
    );
    
    // Save the keys
    fs.writeFileSync(
        path.join(buildPath, 'proving_key.json'),
        JSON.stringify(zkey)
    );
    fs.writeFileSync(
        path.join(buildPath, 'verification_key.json'),
        JSON.stringify(vkey)
    );

    console.log(`${circuitName} circuit setup complete!`);
}

async function main() {
    try {
        // Check if circom is installed
        try {
            execSync('circom --version', { stdio: 'ignore' });
        } catch (error) {
            console.error('Error: circom is not installed. Please install it first:');
            console.error('npm install -g circom');
            process.exit(1);
        }

        const circuits = ['transfer', 'merkle', 'nullifier'];
        
        for (const circuit of circuits) {
            await setupCircuit(circuit);
        }
    } catch (error) {
        console.error('Error during setup:', error);
        process.exit(1);
    }
}

main().then(() => {
    console.log('All circuits setup complete!');
}).catch(err => {
    console.error('Error during setup:', err);
    process.exit(1);
}); 