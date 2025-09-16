#!/usr/bin/env node
// scripts/generate-ptau.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

function sh(cmd, opts = {}) { execSync(cmd, { stdio: 'inherit', ...opts }); }
function randomHex(n = 32) {
  // Allow override via ENV if you want deterministic builds in CI:
  if (process.env.ENTROPY_HEX && process.env.ENTROPY_HEX.length >= n * 2) {
    return process.env.ENTROPY_HEX.slice(0, n * 2);
  }
  return crypto.randomBytes(n).toString('hex');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { out: 'build', power: 14, force: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--out') out.out = args[++i];
    else if (a === '--power') out.power = Number(args[++i] || '14');
    else if (a === '--force') out.force = true;
    else console.warn(`Unknown arg: ${a}`);
  }
  out.out = path.resolve(out.out);
  return out;
}

(async function main() {
  const { out, power, force } = parseArgs();
  if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });

  const ptau0   = path.join(out, `pot${power}_0000.ptau`);
  const ptau1   = path.join(out, `pot${power}_0001.ptau`);
  const beacon  = path.join(out, `pot${power}_beacon.ptau`);
  const ptauFin = path.join(out, `pot${power}_final.ptau`);

  if (fs.existsSync(ptauFin) && !force) {
    console.log(`✅ Skipping: ${path.relative(process.cwd(), ptauFin)} already exists.`);
    process.exit(0);
  }

  console.log(`🔧 Generating Powers of Tau (bn128, 2^${power}) into ${out}`);
  sh(`snarkjs powersoftau new bn128 ${power} "${ptau0}" -v`);

  // Use Node's crypto for entropy instead of xxd
  const ENTROPY1 = randomHex(32);
  sh(`snarkjs powersoftau contribute "${ptau0}" "${ptau1}" --name="contrib-1" -v -e="${ENTROPY1}"`);

  const BEACON = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
  sh(`snarkjs powersoftau beacon "${ptau1}" "${beacon}" ${BEACON} 10 -n="phase1-final-beacon"`);
  sh(`snarkjs powersoftau prepare phase2 "${beacon}" "${ptauFin}" -v`);
  sh(`snarkjs powersoftau verify "${ptauFin}"`);

  console.log(`✅ Wrote ${ptauFin}`);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
