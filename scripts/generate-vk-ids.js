#!/usr/bin/env node

/**
 * Generate Verification Key IDs for zkVerify Integration
 * 
 * This script generates the verification key IDs needed for zkVerify integration
 * by hashing the verification key files from your circuits.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Circuit verification key files
const CIRCUITS = [
    'deposit',
    'transfer', 
    'withdraw'
];

// Build directory path
const BUILD_DIR = path.join(__dirname, '../build');

/**
 * Generate SHA256 hash of a file
 */
function generateFileHash(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
}

/**
 * Convert hex string to byte array
 */
function hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}

/**
 * Format byte array as Rust constant
 */
function formatRustConstant(name, bytes) {
    const hexValues = bytes.map(b => `0x${b.toString(16).padStart(2, '0')}`);
    const chunks = [];
    
    for (let i = 0; i < hexValues.length; i += 8) {
        chunks.push(hexValues.slice(i, i + 8).join(', '));
    }
    
    return `pub const ${name}: [u8; 32] = [\n    ${chunks.join(',\n    ')}\n];`;
}

/**
 * Main function
 */
function main() {
    console.log('🔑 Generating Verification Key IDs for zkVerify Integration\n');
    
    const vkIds = {};
    const rustConstants = [];
    
    for (const circuit of CIRCUITS) {
        const vkPath = path.join(BUILD_DIR, circuit, `verifier-${circuit}.json`);
        
        if (!fs.existsSync(vkPath)) {
            console.log(`⚠️  Warning: ${vkPath} not found. Run 'npm run setup' first.`);
            continue;
        }
        
        try {
            const hash = generateFileHash(vkPath);
            const bytes = hexToBytes(hash);
            
            vkIds[circuit] = {
                hash,
                bytes,
                rustConstant: formatRustConstant(
                    `${circuit.toUpperCase()}_VK_ID`, 
                    bytes
                )
            };
            
            console.log(`✅ ${circuit.toUpperCase()}: ${hash}`);
            
        } catch (error) {
            console.error(`❌ Error processing ${circuit}:`, error.message);
        }
    }
    
    if (Object.keys(vkIds).length === 0) {
        console.log('\n❌ No verification keys found. Please run:');
        console.log('   npm run setup');
        return;
    }
    
    // Generate Rust constants file
    const rustContent = `// Auto-generated verification key IDs for zkVerify integration
// Generated on: ${new Date().toISOString()}
// 
// To regenerate: node scripts/generate-vk-ids.js

pub mod vk_ids {
    use super::*;
    
    // These are the actual verification key IDs from your circuits
    // DO NOT change these values unless you regenerate your circuits
    
${Object.values(vkIds).map(vk => vk.rustConstant).join('\n\n')}
}
`;

    const rustOutputPath = path.join(__dirname, '../../cipherpay-anchor/src/zk_verifier/vk_ids.rs');
    
    try {
        // Ensure directory exists
        const dir = path.dirname(rustOutputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(rustOutputPath, rustContent);
        console.log(`\n📝 Rust constants written to: ${rustOutputPath}`);
        
    } catch (error) {
        console.error('❌ Error writing Rust file:', error.message);
    }
    
    // Generate summary
    console.log('\n📋 Summary:');
    console.log('==========');
    
    for (const [circuit, vk] of Object.entries(vkIds)) {
        console.log(`${circuit.toUpperCase()}:`);
        console.log(`  Hash: ${vk.hash}`);
        console.log(`  Bytes: [${vk.bytes.join(', ')}]`);
        console.log('');
    }
    
    console.log('🎉 Verification key IDs generated successfully!');
    console.log('\nNext steps:');
    console.log('1. Copy the generated vk_ids.rs to your cipherpay-anchor project');
    console.log('2. Update your mod.rs to use the actual VK IDs');
    console.log('3. Test the integration with zkVerify');
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { generateFileHash, hexToBytes, formatRustConstant };
