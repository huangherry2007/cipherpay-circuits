// scripts/setup.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { generateZkeyAndVk } = require('./generate-zkey-vk.js');

function sh(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', ...opts });
}

async function setupCircuits() {
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

  // 2) Compile & build each circuit
  for (const circuitName of circuits) {
    console.log(`\n📦 Building ${circuitName} circuit...`);

    const circuitPath = path.join(repoRoot, 'circuits', circuitName, `${circuitName}.circom`);
    const circuitBuildDir = path.join(buildRoot, circuitName);
    if (!fs.existsSync(circuitBuildDir)) fs.mkdirSync(circuitBuildDir, { recursive: true });

    // 2a) circom compile -> r1cs + wasm
    console.log(`  🧱 Compiling ${circuitName}...`);
    sh(`circom "${circuitPath}" --r1cs --wasm --output "${circuitBuildDir}" -l node_modules`, {
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
