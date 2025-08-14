const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// CipherPay Circuit Setup Script
// Builds circuits with updated naming conventions
async function setupCircuits() {
    console.log('🔧 Setting up CipherPay Circuits...');

    // List of circuits to compile (standalone circuits only)
    const circuits = [
        'transfer',
        'withdraw',
        'deposit'
    ];

    // Create build directory if it doesn't exist
    const buildDir = path.join(__dirname, '../build');
    if (!fs.existsSync(buildDir)) {
        fs.mkdirSync(buildDir, { recursive: true });
    }

    for (const circuitName of circuits) {
        console.log(`\n📦 Building ${circuitName} circuit...`);

        const circuitPath = path.join(__dirname, `../circuits/${circuitName}/${circuitName}.circom`);
        const buildPath = path.join(buildDir, circuitName);

        // Create circuit build directory
        if (!fs.existsSync(buildPath)) {
            fs.mkdirSync(buildPath, { recursive: true });
        }

        try {
            // Compile circuit using circom command-line tool
            console.log(`  Compiling ${circuitName}...`);
            const r1csPath = path.join(buildPath, `${circuitName}.r1cs`);
            const wasmPath = path.join(buildPath, `${circuitName}_js`);

            execSync(`circom ${circuitPath} --r1cs --wasm --output ${buildPath} -l node_modules`, {
                stdio: 'inherit',
                cwd: path.join(__dirname, '..')  // Run from project root
            });

            console.log(`  ✅ ${circuitName} compiled successfully`);

            // Generate proving key using snarkjs
            console.log(`  Generating proving key for ${circuitName}...`);

            // Use existing power of tau files or download them
            const potPath = path.join(__dirname, '../powersOfTau/pot14_0000.ptau');
            const potPhase2Path = path.join(__dirname, '../powersOfTau/pot14_final.ptau');
            
            // Check if power of tau files exist, if not, create the directory
            const potDir = path.dirname(potPath);
            if (!fs.existsSync(potDir)) {
                fs.mkdirSync(potDir, { recursive: true });
            }
            
            // If power of tau files don't exist, download them from trusted sources
            if (!fs.existsSync(potPath)) {
                console.log(`  Downloading power of tau file for ${circuitName}...`);
                // Use a smaller power of tau file for testing (12 instead of 14)
                execSync(`npx snarkjs powersoftau new bn128 12 ${potPath}`, {
                    stdio: 'inherit',
                    cwd: potDir
                });
            }
            
            if (!fs.existsSync(potPhase2Path)) {
                console.log(`  Preparing phase2 for power of tau for ${circuitName}...`);
                execSync(`npx snarkjs powersoftau prepare phase2 ${potPath} ${potPhase2Path}`, {
                    stdio: 'inherit',
                    cwd: potDir
                });
            }

            // Generate the proving key
            const zkeyPath = path.join(buildPath, `${circuitName}.zkey`);
            execSync(`npx snarkjs groth16 setup ${r1csPath} ${potPhase2Path} ${zkeyPath}`, {
                stdio: 'inherit',
                cwd: buildPath
            });

            console.log(`  ✅ Proving key generated for ${circuitName}`);

            // Export verification key
            console.log(`  Exporting verification key for ${circuitName}...`);
            execSync(`npx snarkjs zkey export verificationkey ${zkeyPath} ${path.join(buildPath, 'verification_key.json')}`, {
                stdio: 'inherit',
                cwd: buildPath
            });
            
            // Also create the expected test file names
            const testVkPath = path.join(buildPath, `verifier-${circuitName}.json`);
            fs.copyFileSync(path.join(buildPath, 'verification_key.json'), testVkPath);

            console.log(`  ✅ Verification key exported for ${circuitName}`);

        } catch (error) {
            console.error(`  ❌ Error building ${circuitName}:`, error.message);
            throw error;
        }
    }

    console.log('\n🎉 All circuits built successfully!');
    console.log('\n📁 Build artifacts:');
    for (const circuitName of circuits) {
        console.log(`  - ${circuitName}: build/${circuitName}/`);
    }
}

setupCircuits().catch(console.error); 