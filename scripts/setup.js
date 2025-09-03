const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { generateZkeyAndVk } = require('./generate-zkey-vk.js');

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

    // Create shared ptau file first (if needed)
    const sharedPtauPath = path.join(buildDir, 'pot14_final.ptau');
    if (!fs.existsSync(sharedPtauPath)) {
        console.log('🔧 Creating shared ptau file for all circuits...');
        const { createPtauFile } = require('./generate-zkey-vk.js');
        await createPtauFile(buildDir, 14);
        console.log('✅ Shared ptau file created');
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

            // Generate zkey and verification key using the new script
            console.log(`  Generating zkey and verification key for ${circuitName}...`);
            await generateZkeyAndVk(circuitName, {
                autoGeneratePtau: true,
                ptauSize: 14
            });

            console.log(`  ✅ ${circuitName} zkey and vk generated successfully`);

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