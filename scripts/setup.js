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

    // Get node_modules path for circomlib
    const nodeModulesPath = path.join(__dirname, '../node_modules');

    // Compile the circuit using circom CLI with include path
    console.log('Compiling circuit...');
    execSync(`circom ${circuitPath} --r1cs --wasm -o ${buildPath} -l ${nodeModulesPath}`, {
        stdio: 'inherit'
    });

    // Generate proving key and verification key
    console.log('Generating proving key and verification key...');
    const r1csPath = path.join(buildPath, `${circuitName}.r1cs`);
    const zkeyPath = path.join(buildPath, `${circuitName}.zkey`);
    const potPath = path.join(__dirname, '../build/pot15_final.ptau');
    
    // Generate zkey using Groth16
    console.log('Generating zkey using Groth16...');
    execSync(`npx snarkjs g16s ${r1csPath} ${potPath} ${zkeyPath}`, {
        stdio: 'inherit'
    });
    
    // Export verification key
    console.log('Exporting verification key...');
    execSync(`npx snarkjs zkev ${zkeyPath} ${path.join(buildPath, 'verification_key.json')}`, {
        stdio: 'inherit'
    });

    // Define paths for different repos
    const repos = {
        sdk: path.join(__dirname, '../../cipherpay-sdk/src/zk/circuits'),
        anchor: path.join(__dirname, '../../cipherpay-anchor/src/zk/circuits'),
        evm: path.join(__dirname, '../../cipherpay-evm/src/zk/circuits'),
        relayerSolana: path.join(__dirname, '../../cipherpay-relayer-solana/src/zk/circuits'),
        relayerEvm: path.join(__dirname, '../../cipherpay-relayer-evm/src/zk/circuits')
    };

    // Create directories if they don't exist
    Object.values(repos).forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    // Copy wasm and zkey files to SDK only
    const wasmSource = path.join(buildPath, `${circuitName}_js/${circuitName}.wasm`);
    const wasmDest = path.join(repos.sdk, `${circuitName}.wasm`);
    fs.copyFileSync(wasmSource, wasmDest);

    const zkeyDest = path.join(repos.sdk, `${circuitName}.zkey`);
    fs.copyFileSync(zkeyPath, zkeyDest);

    // Copy verification key to all repos
    const vkeySource = path.join(buildPath, 'verification_key.json');
    Object.values(repos).forEach(dir => {
        const vkeyDest = path.join(dir, `verifier-${circuitName}.json`);
        fs.copyFileSync(vkeySource, vkeyDest);
    });

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

        // Create build directory if it doesn't exist
        const buildDir = path.join(__dirname, '../build');
        if (!fs.existsSync(buildDir)) {
            fs.mkdirSync(buildDir, { recursive: true });
        }

        // Generate powers of tau if not exists
        const potPath = path.join(__dirname, '../build/pot15_final.ptau');
        if (!fs.existsSync(potPath)) {
            console.log('Generating powers of tau...');
            // Use snarkjs CLI command to generate powers of tau
            execSync(`npx snarkjs powersoftau new bn128 15 ${potPath}`, {
                stdio: 'inherit'
            });
            
            // Contribute to the powers of tau
            console.log('Contributing to powers of tau...');
            execSync(`npx snarkjs powersoftau contribute ${potPath} ${potPath}.tmp --name="First contribution"`, {
                stdio: 'inherit'
            });
            fs.renameSync(`${potPath}.tmp`, potPath);
            
            // Prepare phase 2
            console.log('Preparing phase 2...');
            execSync(`npx snarkjs pt2 ${potPath} ${potPath}`, {
                stdio: 'inherit'
            });
            
            // Verify the powers of tau
            console.log('Verifying powers of tau...');
            execSync(`npx snarkjs powersoftau verify ${potPath}`, {
                stdio: 'inherit'
            });
        }

        const circuits = [
            'transfer',
            'merkle',
            'nullifier',
            'audit_proof',
            'withdraw',
            'zkStream',
            'zkSplit',
            'zkCondition'
        ];
        
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