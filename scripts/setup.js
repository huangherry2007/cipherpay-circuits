// scripts/setup.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { generateZkeyAndVk } = require('./generate-zkey-vk.js');

function sh(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', ...opts });
}

/* ---- MINIMAL ADD: resolve a Circom v2 binary (prefer global over node_modules) ---- */
function resolveCircomBin() {
  // 1) honor explicit env override
  if (process.env.CIRCOM_BIN) return process.env.CIRCOM_BIN;

  const candidates = [];
  // 2) try shell’s circom (may be npm’s under npm run, we’ll version-check)
  try { candidates.push(execSync('command -v circom', { encoding: 'utf8' }).trim()); } catch {}
  // 3) common global locations
  ['/usr/local/bin/circom','/opt/homebrew/bin/circom','/usr/bin/circom'].forEach(p => {
    if (fs.existsSync(p)) candidates.push(p);
  });

  for (const bin of candidates) {
    try {
      const v = execSync(`"${bin}" --version`, { encoding: 'utf8' }).toLowerCase();
      if (v.includes('compiler 2.')) return bin; // Circom v2.x
    } catch {}
  }
  // fallback (may still work if the local one is v2)
  return 'circom';
}

async function setupCircuits() {
  // --- recommend Node 18 (or 22) to avoid snarkjs CLI exit issue on Node 20 ---
  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major !== 18 && major !== 22) {
    console.warn(`⚠️  Detected Node ${process.version}. For snarkjs CLI stability, use Node 18 (LTS) or 22 (LTS).`);
  }

  console.log('🔧 Setting up CipherPay Circuits...');

  const circuits = ['transfer', 'withdraw', 'deposit'];
  const repoRoot = path.join(__dirname, '..');
  const buildRoot = path.join(repoRoot, 'build');

  if (!fs.existsSync(buildRoot)) fs.mkdirSync(buildRoot, { recursive: true });

  // ---- ptau settings ----
  const ptauSize = 14;                 // adjust if your circuits need larger (2^14 >= 16384 constraints)
  const ptauPath = buildRoot;          // default requested
  const ptauFinal = path.join(ptauPath, `pot${ptauSize}_final.ptau`);

  // 1) Ensure ptau exists (skip generation if final file exists)
  if (fs.existsSync(ptauFinal)) {
    console.log(`✅ Using existing ptau: ${path.relative(repoRoot, ptauFinal)}`);
  } else {
    console.log('⚙️  Ensuring shared ptau exists via generate-ptau.js...');
    const gen = path.join(__dirname, 'generate-ptau.js');
    sh(`node "${gen}" --out "${ptauPath}" --power ${ptauSize}`, { cwd: repoRoot });
    console.log(`✅ ptau ready at ${path.relative(repoRoot, ptauFinal)}`);
  }

  // --- MINIMAL ADD: pick the compiler once and reuse ---
  const CIRCOM = resolveCircomBin();
  try {
    const v = execSync(`"${CIRCOM}" --version`, { encoding: 'utf8' }).trim();
    console.log(`🧭 Using circom: ${CIRCOM} (${v})`);
  } catch {
    console.log(`🧭 Using circom: ${CIRCOM}`);
  }

  // 2) Compile & build each circuit
  for (const circuitName of circuits) {
    console.log(`\n📦 Building ${circuitName} circuit...`);

    const circuitPath = path.join(repoRoot, 'circuits', circuitName, `${circuitName}.circom`);
    const circuitBuildDir = path.join(buildRoot, circuitName);
    if (!fs.existsSync(circuitBuildDir)) fs.mkdirSync(circuitBuildDir, { recursive: true });

    // 2a) circom compile -> r1cs + wasm
    console.log(`  🧱 Compiling ${circuitName}...`);
    // MINIMAL CHANGE: use the resolved binary instead of bare "circom"
    sh(`"${CIRCOM}" "${circuitPath}" --r1cs --wasm --output "${circuitBuildDir}" -l node_modules`, {
      cwd: repoRoot,
    });
    console.log(`  ✅ ${circuitName} compiled`);

    // 2b) zkey + verification key (reuse shared ptau)
    console.log(`  🔑 Generating zkey & vk for ${circuitName}...`);
    await generateZkeyAndVk(circuitName, {
      autoGeneratePtau: false,     // we handled ptau already
      ptauSize,
      ptauPath,                    // <-- NEW: default is build/, you can override
    });
    console.log(`  ✅ ${circuitName} zkey & vk ready`);
  }

  console.log('\n🎉 All circuits built successfully!');
  console.log('\n📁 Build artifacts:');
  for (const circuitName of circuits) {
    console.log(`  - ${circuitName}: build/${circuitName}/`);
  }
}

setupCircuits().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
