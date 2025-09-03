#!/usr/bin/env node

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Generate zkey files and verification keys for CipherPay circuits
 * This script handles the complete Groth16 setup process
 */

async function generateZkeyAndVk(circuitName, options = {}) {
    console.log(`🔧 Generating zkey and verification key for ${circuitName}...`);
    
    const buildPath = path.join(__dirname, `../build/${circuitName}`);
    const r1csPath = path.join(buildPath, `${circuitName}.r1cs`);
    const zkeyPath = path.join(buildPath, `${circuitName}.zkey`);
    const vkPath = path.join(buildPath, 'verification_key.json');
    
    // Check if R1CS file exists
    if (!fs.existsSync(r1csPath)) {
        throw new Error(`R1CS file not found at ${r1csPath}. Please compile the circuit first.`);
    }
    
    try {
        // Step 1: Generate or find ptau file
        const ptauPath = await getPtauFile(buildPath, options);
        console.log(`  📁 Using ptau file: ${ptauPath}`);
        
        // Step 2: Generate zkey file
        console.log(`  🔑 Generating zkey file...`);
        await generateZkey(r1csPath, ptauPath, zkeyPath, options);
        console.log(`  ✅ Zkey file generated: ${zkeyPath}`);
        
        // Step 3: Export verification key
        console.log(`  📋 Exporting verification key...`);
        await exportVerificationKey(zkeyPath, vkPath);
        console.log(`  ✅ Verification key exported: ${vkPath}`);
        
        // Step 4: Create test verification key copy
        const testVkPath = path.join(buildPath, `verifier-${circuitName}.json`);
        fs.copyFileSync(vkPath, testVkPath);
        console.log(`  ✅ Test verification key created: ${testVkPath}`);
        
        // Step 5: Display verification key info
        const vkInfo = await getVerificationKeyInfo(vkPath);
        console.log(`  📊 Verification key info:`);
        console.log(`     - Public inputs: ${vkInfo.nPublic}`);
        console.log(`     - IC length: ${vkInfo.IC.length}`);
        console.log(`     - Protocol: ${vkInfo.protocol}`);
        console.log(`     - Curve: ${vkInfo.curve}`);
        
        return {
            zkeyPath,
            vkPath,
            testVkPath,
            info: vkInfo
        };
        
    } catch (error) {
        console.error(`  ❌ Error generating zkey/vk for ${circuitName}:`, error.message);
        throw error;
    }
}

async function getPtauFile(buildPath, options = {}) {
    // Use shared ptau file in the main build directory
    const sharedBuildPath = path.join(__dirname, '../build');
    const ptauPath = path.join(sharedBuildPath, 'pot14_final.ptau');
    
    // If ptau file exists, use it
    if (fs.existsSync(ptauPath)) {
        return ptauPath;
    }
    
    // If auto-generate is enabled, create ptau file in shared location
    if (options.autoGeneratePtau !== false) {
        console.log(`  🔧 Creating shared ptau file...`);
        await createPtauFile(sharedBuildPath, options.ptauSize || 14);
        return ptauPath;
    }
    
    throw new Error(`Ptau file not found at ${ptauPath}. Set autoGeneratePtau: true or provide ptau file manually.`);
}

async function createPtauFile(buildPath, size = 14) {
    const potPath = path.join(buildPath, `pot${size}_0000.ptau`);
    const potPhase2Path = path.join(buildPath, `pot${size}_final.ptau`);
    
    try {
        // Create initial ptau file using system snarkjs
        console.log(`    Creating power of tau file (size: ${size})...`);
        execSync(`snarkjs ptn bn128 ${size} ${potPath}`, {
            stdio: 'inherit',
            cwd: buildPath
        });
        
        // Prepare phase 2 using system snarkjs
        console.log(`    Preparing phase 2...`);
        execSync(`snarkjs pt2 ${potPath} ${potPhase2Path}`, {
            stdio: 'inherit',
            cwd: buildPath
        });
        
        console.log(`    ✅ Ptau file created: ${potPhase2Path}`);
        
    } catch (error) {
        throw new Error(`Failed to create ptau file: ${error.message}`);
    }
}

async function generateZkey(r1csPath, ptauPath, zkeyPath, options = {}) {
    try {
        const cmd = `snarkjs g16s ${r1csPath} ${ptauPath} ${zkeyPath}`;
        execSync(cmd, {
            stdio: 'inherit',
            cwd: path.dirname(r1csPath)
        });
    } catch (error) {
        throw new Error(`Failed to generate zkey: ${error.message}`);
    }
}

async function exportVerificationKey(zkeyPath, vkPath) {
    try {
        const cmd = `snarkjs zkev ${zkeyPath} ${vkPath}`;
        execSync(cmd, {
            stdio: 'inherit',
            cwd: path.dirname(zkeyPath)
        });
    } catch (error) {
        throw new Error(`Failed to export verification key: ${error.message}`);
    }
}

async function getVerificationKeyInfo(vkPath) {
    const vk = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
    return {
        nPublic: vk.nPublic,
        IC: vk.IC,
        protocol: vk.protocol,
        curve: vk.curve
    };
}

async function generateAllZkeys(options = {}) {
    console.log('🔧 Generating zkey files and verification keys for all circuits...\n');
    
    const circuits = ['transfer', 'withdraw', 'deposit'];
    const results = {};
    
    for (const circuitName of circuits) {
        console.log(`\n📦 Processing ${circuitName} circuit...`);
        
        try {
            const result = await generateZkeyAndVk(circuitName, options);
            results[circuitName] = result;
            console.log(`  ✅ ${circuitName} completed successfully`);
        } catch (error) {
            console.error(`  ❌ ${circuitName} failed: ${error.message}`);
            if (options.stopOnError) {
                throw error;
            }
        }
    }
    
    console.log('\n🎉 All zkey and verification key generation completed!');
    console.log('\n📁 Generated files:');
    
    for (const [circuitName, result] of Object.entries(results)) {
        console.log(`  ${circuitName}:`);
        console.log(`    - Zkey: ${result.zkeyPath}`);
        console.log(`    - VK: ${result.vkPath}`);
        console.log(`    - Test VK: ${result.testVkPath}`);
    }
    
    return results;
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    const circuitName = args[0];
    
    const options = {
        autoGeneratePtau: true,
        ptauSize: 14,
        stopOnError: false
    };
    
    // Parse command line options
    for (let i = 1; i < args.length; i++) {
        if (args[i] === '--no-auto-ptau') {
            options.autoGeneratePtau = false;
        } else if (args[i] === '--ptau-size' && i + 1 < args.length) {
            options.ptauSize = parseInt(args[i + 1]);
            i++;
        } else if (args[i] === '--stop-on-error') {
            options.stopOnError = true;
        }
    }
    
    try {
        if (circuitName) {
            // Generate for specific circuit
            const result = await generateZkeyAndVk(circuitName, options);
            console.log(`\n✅ Successfully generated zkey and vk for ${circuitName}`);
        } else {
            // Generate for all circuits
            await generateAllZkeys(options);
        }
    } catch (error) {
        console.error('❌ Generation failed:', error.message);
        process.exit(1);
    }
}

// Export functions for use in other scripts
module.exports = {
    generateZkeyAndVk,
    generateAllZkeys,
    getVerificationKeyInfo,
    createPtauFile
};

// Run if called directly
if (require.main === module) {
    main();
}
