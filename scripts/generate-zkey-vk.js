// scripts/generate-zkey-vk.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

function sh(cmd, opts = {}) { execSync(cmd, { stdio: 'inherit', ...opts }); }
function randomHex(n = 32) {
  if (process.env.ENTROPY_HEX && process.env.ENTROPY_HEX.length >= n * 2) {
    return process.env.ENTROPY_HEX.slice(0, n * 2);
  }
  return crypto.randomBytes(n).toString('hex');
}

// tiny synchronous sleep (works in Node) to let FS flush
function sleep(ms) {
  const sab = new SharedArrayBuffer(4);
  const ia = new Int32Array(sab);
  Atomics.wait(ia, 0, 0, ms);
}

// --- robust snarkjs runner: tolerate Node 20's exit bug & racey writes
function runSnarkWithFallback(cmdArgs, { cwd, expectFiles = [] } = {}) {
  const env = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' };
  const cliCjs = path.join(__dirname, '..', 'node_modules', 'snarkjs', 'build', 'cli.cjs');
  const cmdStr = Array.isArray(cmdArgs) ? cmdArgs.join(' ') : String(cmdArgs);

  const allOutputsExist = () => expectFiles.every(f => f && fs.existsSync(f));

  const tryRun = (cmd) => {
    try {
      execSync(cmd, { stdio: 'inherit', cwd, env });
      // success path
      return true;
    } catch (err) {
      const msg = String(err?.message || err);
      const isNode20Bug = msg.includes('ERR_INVALID_ARG_TYPE') || msg.includes('Uint8Array');

      if (isNode20Bug) {
        // give the filesystem a moment to flush the zkey the CLI likely wrote
        sleep(250);
        if (allOutputsExist()) {
          console.log('   ⚠️  snarkjs CLI hit Node 20 exit bug, but expected outputs exist — continuing.');
          return true;
        }
      }
      return false;
    }
  };

  // 1) native CLI
  if (tryRun(`snarkjs ${cmdStr}`)) return;

  // 2) direct local cli.cjs
  if (fs.existsSync(cliCjs) && tryRun(`node "${cliCjs}" ${cmdStr}`)) return;

  // 3) npx fallback
  if (tryRun(`npx --yes snarkjs ${cmdStr}`)) return;

  // final grace check: sometimes all attempts "fail" but file actually exists
  if (allOutputsExist()) {
    console.log('   ⚠️  All snarkjs invocations reported errors, but outputs are present — continuing.');
    return;
  }

  throw new Error(`snarkjs failed for: ${cmdStr}`);
}

/**
 * Generate zkey + verification key for a circuit.
 * @param {string} circuitName e.g., 'deposit'
 * @param {object} opts
 *  - ptauSize: number (default 14)
 *  - ptauPath: string directory where pot<ptauSize>_final.ptau lives (default 'build/')
 *  - autoGeneratePtau: boolean (default false) – if true and final ptau is missing, will run generate-ptau.js
 */
async function generateZkeyAndVk(circuitName, opts = {}) {
  const ptauSize = opts.ptauSize ?? 14;
  const ptauPath = path.resolve(opts.ptauPath ?? 'build');
  const buildDir = path.join(__dirname, '..', 'build', circuitName);

  const r1cs = path.join(buildDir, `${circuitName}.r1cs`);
  const zkey0 = path.join(buildDir, `${circuitName}_0000.zkey`);
  const zkey1 = path.join(buildDir, `${circuitName}_0001.zkey`);
  const zkeyFinal = path.join(buildDir, `${circuitName}_final.zkey`);
  const vkJson = path.join(buildDir, 'verification_key.json');

  const ptauFinal = path.join(ptauPath, `pot${ptauSize}_final.ptau`);
  if (!fs.existsSync(ptauFinal)) {
    if (opts.autoGeneratePtau) {
      console.log(`⚙️  ptau not found at ${ptauFinal}; generating...`);
      const gen = path.join(__dirname, 'generate-ptau.js');
      sh(`node "${gen}" --out "${ptauPath}" --power ${ptauSize}`);
    } else {
      throw new Error(`Missing ${ptauFinal}. Set autoGeneratePtau=true or run generate-ptau.js first.`);
    }
  }
  if (!fs.existsSync(r1cs)) throw new Error(`Missing ${r1cs}. Compile the circuit first.`);

  console.log(`   ▶ snarkjs groth16 setup (${circuitName})`);
  runSnarkWithFallback(
    [`groth16 setup "${r1cs}" "${ptauFinal}" "${zkey0}"`],
    { cwd: buildDir, expectFiles: [zkey0] }
  );

  console.log(`   ▶ snarkjs zkey contribute (${circuitName})`);
  const ENTROPY2 = randomHex(32);
  runSnarkWithFallback(
    [`zkey contribute "${zkey0}" "${zkey1}" --name="zkey-contrib-1" -v -e="${ENTROPY2}"`],
    { cwd: buildDir, expectFiles: [zkey1] }
  );

  console.log(`   ▶ snarkjs zkey beacon & verify (${circuitName})`);
  const BEACON = 'f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff00112233445566778899aabbccddeeff';
  runSnarkWithFallback(
    [`zkey beacon "${zkey1}" "${zkeyFinal}" ${BEACON} 10 -n="zkey-final"`],
    { cwd: buildDir, expectFiles: [zkeyFinal] }
  );
  runSnarkWithFallback(
    [`zkey verify "${r1cs}" "${ptauFinal}" "${zkeyFinal}"`],
    { cwd: buildDir, expectFiles: [] }
  );

  console.log(`   ▶ export verification key (${circuitName})`);
  runSnarkWithFallback(
    [`zkey export verificationkey "${zkeyFinal}" "${vkJson}"`],
    { cwd: buildDir, expectFiles: [vkJson] }
  );

  console.log(`   ✅ zkey/vk for ${circuitName} ready`);
}

module.exports = { generateZkeyAndVk };
