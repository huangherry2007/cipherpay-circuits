#!/usr/bin/env node

/**
 * Power of Tau generator for Groth16 (snarkjs)
 * -------------------------------------------------
 * Creates a Phase 1 transcript and prepares Phase 2.
 * Defaults: curve=bn128, power=14, one dev contribution, outputs to build/.
 *
 * Examples:
 *   node scripts/generate-ptau.js
 *   node scripts/generate-ptau.js --power 16 --contrib 3
 *   node scripts/generate-ptau.js --out artifacts
 *   node scripts/generate-ptau.js --r1cs build/deposit/deposit.r1cs
 *   node scripts/generate-ptau.js --entropy "my secret"
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', ...opts });
}
function shWithInput(cmd, input) {
  // Feed stdin (so it works with snarkjs that prompts for entropy)
  const res = spawnSync(cmd, {
    shell: true,
    stdio: ['pipe', 'inherit', 'inherit'],
    input: input, // string or Buffer
  });
  if (res.status !== 0) {
    const msg = res.error ? res.error.message : `exit code ${res.status}`;
    throw new Error(`command failed: ${cmd} (${msg})`);
  }
}

function parseArgs(argv) {
  const args = {
    curve: 'bn128',
    power: 14,
    out: path.join(__dirname, '../build'),
    contrib: 1,
    dev: true,
    entropy: undefined,
    r1cs: undefined,
    force: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--curve' && argv[i+1]) args.curve = argv[++i];
    else if (a === '--power' && argv[i+1]) args.power = parseInt(argv[++i], 10);
    else if (a === '--out' && argv[i+1]) args.out = argv[++i];
    else if (a === '--contrib' && argv[i+1]) args.contrib = parseInt(argv[++i], 10);
    else if (a === '--no-dev') args.dev = false;
    else if (a === '--entropy' && argv[i+1]) args.entropy = argv[++i];
    else if (a === '--r1cs' && argv[i+1]) args.r1cs = argv[++i];
    else if (a === '--force') args.force = true;
  }
  return args;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function suggestPowerFromR1cs(r1csPath) {
  try {
    const out = execSync(`snarkjs r1cs info ${r1csPath} -j`, { encoding: 'utf8' });
    const json = JSON.parse(out);
    const n = json.nConstraints || 0;
    const margin = Math.max(1024, Math.ceil(n * 0.05));
    const need = Math.max(1, n + margin);
    let p = 8;
    while ((1 << p) <= need && p < 28) p++;
    return Math.max(14, p);
  } catch {
    console.warn('⚠️  Could not read R1CS info; falling back to provided --power.');
    return null;
  }
}

function randEntropy() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${process.pid}`;
}
function fileIfExists(p) { return fs.existsSync(p) ? p : null; }
function findLastPot(dir, base) {
  const files = fs.readdirSync(dir).filter(f => f.startsWith(base + '_') && f.endsWith('.ptau'));
  if (!files.length) return null;
  files.sort();
  return path.join(dir, files[files.length - 1]);
}
function q(s) { return `'${String(s).replace(/'/g, "'\\''")}'`; }
function rel(p) { return path.relative(path.join(__dirname, '..'), p); }

function main() {
  const args = parseArgs(process.argv);

  if (args.r1cs) {
    const suggested = suggestPowerFromR1cs(args.r1cs);
    if (suggested && suggested > args.power) {
      console.log(`🔎 R1CS suggests power ${suggested} (constraints need margin). Using it.`);
      args.power = suggested;
    }
  }

  ensureDir(args.out);
  const base = `pot${args.power}`;
  const pot0     = path.join(args.out, `${base}_0000.ptau`);
  const potFinal = path.join(args.out, `${base}_final.ptau`);

  if (!args.force && fileIfExists(potFinal)) {
    console.log(`✅ Found existing ${rel(potFinal)} — nothing to do. Use --force to re-generate.`);
    process.exit(0);
  }

  console.log(`⚙️  Phase 1: powersoftau new — curve=${args.curve}, power=${args.power}`);
  sh(`snarkjs powersoftau new ${args.curve} ${args.power} ${q(pot0)} -v`);

  // Contributions
  let prev = pot0;
  const numContrib = Math.max(0, args.dev ? Math.max(args.contrib, 1) : args.contrib);
  for (let i = 1; i <= numContrib; i++) {
    const out = path.join(args.out, `${base}_${String(i).padStart(4, '0')}.ptau`);
    const name = `contrib-${i}`;
    const entropy = (i === 1 && args.entropy) ? args.entropy : randEntropy();
    console.log(`🔐 Contribution #${i} (${name})`);

    // snarkjs@0.7.x often prompts ONLY for entropy (no flags). Feed it via stdin.
    // (If your version also asks for a name, it accepts empty; entropy is what matters.)
    const cmd = `snarkjs powersoftau contribute ${q(prev)} ${q(out)} -v`;
    shWithInput(cmd, `${entropy}\n`);

    prev = out;
  }

  console.log('🧪 Verifying transcript...');
  sh(`snarkjs powersoftau verify ${q(prev)}`);

  console.log('📦 Preparing Phase 2...');
  sh(`snarkjs powersoftau prepare phase2 ${q(prev)} ${q(potFinal)} -v`);

  console.log(`\n🎉 Done! Phase 2 ptau → ${rel(potFinal)}`);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('❌ Failed:', e.message); process.exit(1); }
}

module.exports = {};
