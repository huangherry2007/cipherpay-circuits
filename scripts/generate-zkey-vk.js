#!/usr/bin/env node

/**
 * Drop-in generate-zkey-vk.js
 * - Works with build/<circuit>/{circuit}.r1cs
 * - Produces build/<circuit>/{circuit}.zkey and verification_key.json
 * - Guardrails:
 *    • Optional zkey verification (on by default)
 *    • Rejects vkey if all IC points are [0,1,0] (infinity)
 *    • Optional nPublic check via --expected-publics or env
 *
 * ENV:
 *   EXPECTED_PUBLICS=<n>                 // global default
 *   EXPECTED_PUBLICS_deposit=<n>         // per-circuit override
 *   EXPECTED_PUBLICS_transfer=<n>
 *   EXPECTED_PUBLICS_withdraw=<n>
 *
 * CLI:
 *   node scripts/generate-zkey-vk.js [circuit]
 *     --expected-publics <n>
 *     --ptau-size <p>              // default 14
 *     --no-auto-ptau               // require ptau to exist
 *     --skip-verify                // skip 'snarkjs zkey verify'
 *     --allow-infinity-ic          // do not enforce IC ≠ infinity
 *     --stop-on-error              // stop when one circuit fails
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function relativeFromRoot(p) {
  try { return path.relative(path.join(__dirname, '..'), p); } catch { return p; }
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function isInfinityG1(p) {
  // Projective coords exported by snarkjs as strings: [ "0","1","0" ]
  return Array.isArray(p) && p.length === 3 && p[0] === '0' && p[1] === '1' && p[2] === '0';
}

function assertNonInfinityIC(vk) {
  if (!Array.isArray(vk.IC) || vk.IC.length === 0) {
    throw new Error('VK missing IC array.');
  }
  if (vk.IC.every(isInfinityG1)) {
    throw new Error('All IC points are [0,1,0] (infinity) — public signals are unconstrained.');
  }
}

function assertExpectedPublics(vk, expectedPublics, circuitName) {
  if (typeof expectedPublics !== 'number') return; // no expectation set
  if (vk.nPublic !== expectedPublics) {
    throw new Error(`nPublic mismatch for ${circuitName}: expected ${expectedPublics}, got ${vk.nPublic}`);
  }
  if (Array.isArray(vk.IC) && vk.IC.length !== expectedPublics + 1) {
    throw new Error(`IC length mismatch for ${circuitName}: expected ${expectedPublics + 1}, got ${vk.IC.length}`);
  }
}

function resolveOptionsWithEnv(circuitName, options) {
  const out = { ...options };
  if (out.autoGeneratePtau === undefined) out.autoGeneratePtau = true;
  if (out.ptauSize === undefined) out.ptauSize = 14;
  if (out.verifyZkey === undefined) out.verifyZkey = true;
  if (out.requireNonInfinityIC === undefined) out.requireNonInfinityIC = true;

  if (out.expectedPublics === undefined) {
    const perCircuit = process.env[`EXPECTED_PUBLICS_${circuitName}`];
    const globalExp  = process.env.EXPECTED_PUBLICS;
    if (perCircuit) out.expectedPublics = parseInt(perCircuit, 10);
    else if (globalExp) out.expectedPublics = parseInt(globalExp, 10);
  }
  return out;
}

async function createPtauFile(buildPath, size = 14) {
  const pot0 = path.join(buildPath, `pot${size}_0000.ptau`);
  const potFinal = path.join(buildPath, `pot${size}_final.ptau`);
  console.log(`    ⚙️  ptn bn128 2^${size} ...`);
  execSync(`snarkjs ptn bn128 ${size} ${pot0}`, { stdio: 'inherit', cwd: buildPath });
  console.log('    ⚙️  pt2 ...');
  execSync(`snarkjs pt2 ${pot0} ${potFinal}`, { stdio: 'inherit', cwd: buildPath });
  console.log(`    ✅ ptau ready: ${relativeFromRoot(potFinal)}`);
  return potFinal;
}

async function getPtauFile(buildPath, options = {}) {
  const sharedBuildPath = path.join(__dirname, '../build');
  const ptauPath = path.join(sharedBuildPath, `pot${options.ptauSize || 14}_final.ptau`);
  if (fs.existsSync(ptauPath)) return ptauPath;
  if (options.autoGeneratePtau !== false) {
    console.log('  🔧 Creating shared ptau...');
    await createPtauFile(sharedBuildPath, options.ptauSize || 14);
    return ptauPath;
  }
  throw new Error(`Ptau not found: ${ptauPath}`);
}

async function generateZkeyAndVk(circuitName, options = {}) {
  console.log(`🔧 Generating zkey and verification key for ${circuitName}...`);

  const buildPath = path.join(__dirname, `../build/${circuitName}`);
  const r1csPath  = path.join(buildPath, `${circuitName}.r1cs`);
  const zkeyPath  = path.join(buildPath, `${circuitName}.zkey`);
  const vkPath    = path.join(buildPath, 'verification_key.json');

  if (!fs.existsSync(r1csPath)) {
    throw new Error(`R1CS not found: ${relativeFromRoot(r1csPath)}. Compile with circom first.`);
  }

  const resolved = resolveOptionsWithEnv(circuitName, options);

  try {
    // 1) ptau
    const ptauPath = await getPtauFile(buildPath, resolved);
    console.log(`  📁 Using ptau: ${relativeFromRoot(ptauPath)}`);

    // 2) zkey
    console.log('  🔑 Generating zkey...');
    execSync(`snarkjs g16s ${r1csPath} ${ptauPath} ${zkeyPath}`, { stdio: 'inherit', cwd: buildPath });
    console.log(`  ✅ zkey: ${relativeFromRoot(zkeyPath)}`);

    // 2b) verify zkey (optional)
    if (resolved.verifyZkey) {
      console.log('  🔍 Verifying zkey...');
      execSync(`snarkjs zkey verify ${r1csPath} ${ptauPath} ${zkeyPath}`, { stdio: 'inherit', cwd: buildPath });
      console.log('  ✅ zkey verified');
    }

    // 3) export vkey
    console.log('  📋 Exporting verification key...');
    execSync(`snarkjs zkev ${zkeyPath} ${vkPath}`, { stdio: 'inherit', cwd: buildPath });
    console.log(`  ✅ vkey: ${relativeFromRoot(vkPath)}`);

    // 4) vkey checks
    const vk = readJson(vkPath);
    console.log(`  📊 VK: nPublic=${vk.nPublic}, IC=${vk.IC?.length}, protocol=${vk.protocol}, curve=${vk.curve}`);

    assertExpectedPublics(vk, resolved.expectedPublics, circuitName);
    if (resolved.requireNonInfinityIC) assertNonInfinityIC(vk);

    // 5) convenience copy
    const testVkPath = path.join(buildPath, `verifier-${circuitName}.json`);
    fs.copyFileSync(vkPath, testVkPath);
    console.log(`  📄 Copied vkey → ${relativeFromRoot(testVkPath)}`);

    return { zkeyPath, vkPath, testVkPath, info: { nPublic: vk.nPublic, IC: vk.IC?.length, protocol: vk.protocol, curve: vk.curve } };
  } catch (e) {
    console.error(`  ❌ Error generating zkey/vk for ${circuitName}:`, e.message);
    throw e;
  }
}

async function generateAllZkeys(options = {}) {
  console.log('🔧 Generating zkeys & vkeys for all circuits...');
  const circuits = ['transfer', 'withdraw', 'deposit'];
  const results = {};
  for (const c of circuits) {
    console.log(`\n📦 ${c} ...`);
    try {
      results[c] = await generateZkeyAndVk(c, options);
      console.log(`  ✅ ${c} done`);
    } catch (e) {
      console.error(`  ❌ ${c} failed: ${e.message}`);
      if (options.stopOnError) throw e;
    }
  }
  console.log('\n🎉 All done');
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const circuitName = args[0];

  const options = {
    autoGeneratePtau: true,
    ptauSize: 14,
    stopOnError: false,
    verifyZkey: true,
    requireNonInfinityIC: true,
  };

  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === '--no-auto-ptau') options.autoGeneratePtau = false;
    else if (a === '--ptau-size' && args[i+1]) options.ptauSize = parseInt(args[++i], 10);
    else if (a === '--stop-on-error') options.stopOnError = true;
    else if (a === '--skip-verify') options.verifyZkey = false;
    else if (a === '--allow-infinity-ic') options.requireNonInfinityIC = false;
    else if (a === '--expected-publics' && args[i+1]) options.expectedPublics = parseInt(args[++i], 10);
  }

  try {
    if (circuitName) {
      await generateZkeyAndVk(circuitName, options);
      console.log(`\n✅ Successfully generated zkey/vk for ${circuitName}`);
    } else {
      await generateAllZkeys(options);
    }
  } catch (e) {
    console.error('❌ Generation failed:', e.message);
    process.exit(1);
  }
}

module.exports = {
  generateZkeyAndVk,
  generateAllZkeys,
  getVerificationKeyInfo: (vkPath) => readJson(vkPath),
  createPtauFile,
};

if (require.main === module) {
  main();
}
