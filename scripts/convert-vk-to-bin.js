#!/usr/bin/env node
/* eslint-disable no-console */
"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Convert a snarkjs Groth16 verification_key.json (BN254) into a flat
 * binary blob accepted by groth16-solana.
 *
 * Layout (concatenated):
 *   vk_alpha_1       :  64 bytes (G1)
 *   vk_beta_2        : 128 bytes (G2)
 *   vk_gamma_2       : 128 bytes (G2)
 *   vk_delta_2       : 128 bytes (G2)
 *   [vk_alphabeta_12]: optional (sequence of G1s; typically 12 * 64)
 *   IC               : (nPublic + 1) * 64 bytes (G1)
 *
 * Defaults:
 *   - Endianness: little-endian (LE) per groth16-solana expectations.
 *   - `vk_alphabeta_12` is EXCLUDED unless you pass --include-alphabeta.
 *   - IC length must equal (nPublic + 1) unless --force or --ic=N is given.
 */

const FQ = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

const CLI = {
  in: null,
  out: null,
  batch: false,
  includeAlphaBeta: false,
  endianness: "le",   // "le" | "be"
  icOverride: null,   // number | null  (forces expected IC length = icOverride+1)
  force: false,       // bypass hard checks (still warns)
};

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

// ------------------------- parsing helpers -------------------------

function asBigInt(x) {
  if (typeof x === "bigint") return x;
  if (typeof x === "number") return BigInt(x);
  if (typeof x === "string") {
    const s = x.trim();
    if (s.startsWith("0x") || s.startsWith("0X")) return BigInt(s);
    return BigInt(s); // decimal
  }
  if (x && typeof x === "object" && "toString" in x) return BigInt(x.toString());
  throw new Error(`Cannot parse BigInt from: ${JSON.stringify(x)}`);
}

function normFq(x) {
  let n = asBigInt(x) % FQ;
  if (n < 0n) n += FQ;
  return n;
}

function toBytes32(fe, endianness = "le") {
  let v = normFq(fe);
  const out = Buffer.alloc(32);
  if (endianness === "le") {
    for (let i = 0; i < 32; i++) { out[i] = Number(v & 0xffn); v >>= 8n; }
  } else {
    for (let i = 31; i >= 0; i--) { out[i] = Number(v & 0xffn); v >>= 8n; }
  }
  return out;
}

// ------------------------- point parsers -------------------------

function parseG1(p) {
  // Accept [x,y], {x,y}, {"0":x,"1":y}, or nested like [[x,y,z]] -> drop z
  if (Array.isArray(p)) {
    if (p.length >= 2) return [asBigInt(p[0]), asBigInt(p[1])];
    if (p.length === 1 && Array.isArray(p[0]) && p[0].length >= 2) {
      return [asBigInt(p[0][0]), asBigInt(p[0][1])];
    }
  } else if (p && typeof p === "object") {
    if ("x" in p && "y" in p) return [asBigInt(p.x), asBigInt(p.y)];
    if ("0" in p && "1" in p) return [asBigInt(p["0"]), asBigInt(p["1"])];
  }
  throw new Error(`Unrecognized G1 shape: ${JSON.stringify(p)}`);
}

function _extFq2(q) {
  // Accept [c0,c1], {c0,c1}, {"0":..,"1":..}
  if (Array.isArray(q)) {
    if (q.length < 2) throw new Error(`Fq2 too short: ${JSON.stringify(q)}`);
    return [q[0], q[1]];
  }
  if (q && typeof q === "object") {
    if ("c0" in q && "c1" in q) return [q.c0, q.c1];
    if ("0" in q && "1" in q) return [q["0"], q["1"]];
  }
  throw new Error(`Unrecognized Fq2 shape: ${JSON.stringify(q)}`);
}

function parseG2(p) {
  // Accept [[x0,x1],[y0,y1]] (affine), or with z ignored, or flat [x0,x1,y0,y1], or {x:{}, y:{}}
  if (Array.isArray(p)) {
    if (p.length >= 2 && Array.isArray(p[0]) && Array.isArray(p[1])) {
      const [x0, x1] = _extFq2(p[0]);
      const [y0, y1] = _extFq2(p[1]);
      return [asBigInt(x0), asBigInt(x1), asBigInt(y0), asBigInt(y1)];
    }
    if (p.length === 4 && !Array.isArray(p[0]) && !Array.isArray(p[1])) {
      return [asBigInt(p[0]), asBigInt(p[1]), asBigInt(p[2]), asBigInt(p[3])];
    }
  } else if (p && typeof p === "object" && "x" in p && "y" in p) {
    const [x0, x1] = _extFq2(p.x);
    const [y0, y1] = _extFq2(p.y);
    return [asBigInt(x0), asBigInt(x1), asBigInt(y0), asBigInt(y1)];
  }
  throw new Error(`Unrecognized G2 shape: ${JSON.stringify(p)}`);
}

// ------------------------- encoders -------------------------

function encG1(p, endianness) {
  const [x, y] = parseG1(p);
  return Buffer.concat([toBytes32(x, endianness), toBytes32(y, endianness)]); // 64
}

function encG2(p, endianness) {
  const [x0, x1, y0, y1] = parseG2(p);
  return Buffer.concat([
    toBytes32(x0, endianness), toBytes32(x1, endianness),
    toBytes32(y0, endianness), toBytes32(y1, endianness),
  ]); // 128
}

function encG1Array(arr, endianness) {
  const parts = [];
  for (const p of arr) parts.push(encG1(p, endianness));
  return Buffer.concat(parts);
}

function collectG1PointsDeep(val, out = []) {
  if (!val) return out;
  if (Array.isArray(val)) {
    // If this looks like a flat G1 [x,y], encode it; else descend.
    const looksG1 = val.length >= 2 && !Array.isArray(val[0]) && !Array.isArray(val[1]);
    if (looksG1) { out.push(val); return out; }
    for (const el of val) collectG1PointsDeep(el, out);
    return out;
  }
  if (typeof val === "object") {
    if ("x" in val && "y" in val) { out.push(val); return out; }
    for (const k of Object.keys(val)) collectG1PointsDeep(val[k], out);
  }
  return out;
}

// ------------------------- conversion core -------------------------

function convertVerificationKey(jsonPath, outputPath, opts) {
  const vk = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

  const proto = String(vk.protocol || "").toLowerCase();
  if (proto !== "groth16") die(`Unsupported protocol: ${vk.protocol}`);

  const curve = String(vk.curve || "").toLowerCase();
  if (curve !== "bn128" && curve !== "bn254") die(`Unsupported curve: ${vk.curve}`);

  const alpha1 = vk.vk_alpha_1;
  const beta2  = vk.vk_beta_2;
  const gamma2 = vk.vk_gamma_2;
  const delta2 = vk.vk_delta_2;
  const icArr  = Array.isArray(vk.IC) ? vk.IC : Array.isArray(vk.ic) ? vk.ic : null;

  if (!alpha1 || !beta2 || !gamma2 || !delta2 || !icArr) {
    die("Missing one or more required fields: vk_alpha_1, vk_beta_2, vk_gamma_2, vk_delta_2, IC");
  }

  // nPublic: prefer the explicit field; otherwise infer from IC length - 1.
  const nPublicFromVk = vk.nPublic != null ? Number(vk.nPublic) : (icArr.length - 1);
  const nPublic = opts.icOverride != null ? Number(opts.icOverride) : nPublicFromVk;

  // Encode fixed sections
  let alphaBuf, betaBuf, gammaBuf, deltaBuf;
  try {
    alphaBuf = encG1(alpha1, opts.endianness);
    betaBuf  = encG2(beta2,  opts.endianness);
    gammaBuf = encG2(gamma2, opts.endianness);
    deltaBuf = encG2(delta2, opts.endianness);
  } catch (e) {
    die(`Point encoding failed: ${e.message}`);
  }

  // Optional alphabeta_12 (EXCLUDED unless explicitly requested)
  let alphabetaBuf = Buffer.alloc(0);
  if (opts.includeAlphaBeta && vk.vk_alphabeta_12 !== undefined) {
    const points = collectG1PointsDeep(vk.vk_alphabeta_12, []);
    if (points.length === 0) {
      console.warn("• vk_alphabeta_12 present but empty/unrecognized; encoding as empty.");
    } else {
      alphabetaBuf = Buffer.concat(points.map(p => encG1(p, opts.endianness)));
    }
  }

  // IC (must be exactly nPublic+1 unless --force)
  const expectedIcLen = nPublic + 1;
  if (icArr.length !== expectedIcLen) {
    const msg = `IC length (${icArr.length}) != nPublic + 1 (${expectedIcLen}).`;
    if (opts.force) {
      console.warn("• WARNING (forced):", msg);
    } else {
      die(`${msg}\nPass --ic=<nPublic> or --force if you know what you're doing.`);
    }
  }
  const icBuf = encG1Array(icArr, opts.endianness);

  // Concatenate in the order groth16-solana expects
  const out = Buffer.concat([alphaBuf, betaBuf, gammaBuf, deltaBuf, alphabetaBuf, icBuf]);

  // Write
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, out);

  // Logs
  console.log(`Converted ${path.basename(jsonPath)} ➜ ${outputPath}`);
  console.log(`  Curve              : ${vk.curve}`);
  console.log(`  Public inputs      : ${nPublic}`);
  console.log(`  Endianness         : ${opts.endianness.toUpperCase()}`);
  console.log(`  Sections:`);
  console.log(`    vk_alpha_1       : ${alphaBuf.length} bytes`);
  console.log(`    vk_beta_2        : ${betaBuf.length} bytes`);
  console.log(`    vk_gamma_2       : ${gammaBuf.length} bytes`);
  console.log(`    vk_delta_2       : ${deltaBuf.length} bytes`);
  console.log(`    vk_alphabeta_12  : ${alphabetaBuf.length} bytes ${opts.includeAlphaBeta ? "(included)" : "(excluded)"}`);
  console.log(`    IC               : ${icBuf.length} bytes (${icArr.length} G1 points)`);
  console.log(`  TOTAL              : ${out.length} bytes\n`);

  return out.length;
}

// ------------------------- CLI -------------------------

function printHelp() {
  console.log(`Usage:
  node scripts/convert-vk-to-bin.js -i <verification_key.json> -o <output.bin> [options]

Options:
  --endianness=<le|be>     Field-element endianness (default: le)
  --include-alphabeta      Include vk_alphabeta_12 if present (default: off)
  --ic=<nPublic>           Override nPublic (IC must then be nPublic+1)
  --force                  Do not abort on IC length mismatch; print warning instead
  --batch                  Convert ./build/{deposit,transfer,withdraw}/verification_key.json
                           to ../cipherpay-anchor/src/zk_verifier/{circuit}_vk.bin
Examples:
  node scripts/convert-vk-to-bin.js -i build/deposit/verification_key.json -o ../cipherpay-anchor/src/zk_verifier/deposit_vk.bin
  node scripts/convert-vk-to-bin.js -i vk.json -o vk.bin --endianness=le --ic=6
  node scripts/convert-vk-to-bin.js --batch
`);
}

function parseArgs(argv) {
  const a = argv.slice(2);

  const get = (flag) => {
    const i = a.findIndex(s => s === flag || s.startsWith(`${flag}=`));
    if (i === -1) return null;
    const v = a[i].includes("=") ? a[i].split("=")[1] : a[i + 1];
    return v ?? null;
  };

  CLI.batch = a.includes("--batch");
  CLI.includeAlphaBeta = a.includes("--include-alphabeta");
  CLI.force = a.includes("--force");

  const e = get("--endianness");
  if (e) {
    if (!["le", "be"].includes(e)) die("endianness must be 'le' or 'be'");
    CLI.endianness = e;
  }

  const ic = get("--ic");
  if (ic != null) {
    const n = Number(ic);
    if (!Number.isInteger(n) || n < 0) die("--ic must be a non-negative integer");
    CLI.icOverride = n;
  }

  // -i and -o only in non-batch mode
  if (!CLI.batch) {
    const iPos = a.indexOf("-i");
    const oPos = a.indexOf("-o");
    const iVal = iPos !== -1 ? a[iPos + 1] : null;
    const oVal = oPos !== -1 ? a[oPos + 1] : null;
    CLI.in = iVal || get("-i");
    CLI.out = oVal || get("-o");
  }
}

function main() {
  parseArgs(process.argv);

  if (!CLI.batch) {
    if (!CLI.in || !CLI.out) {
      printHelp();
      process.exit(1);
    }
    const inPath = path.resolve(CLI.in);
    const outPath = path.resolve(CLI.out);
    if (!fs.existsSync(inPath)) die(`Input not found: ${inPath}`);
    convertVerificationKey(inPath, outPath, {
      includeAlphaBeta: CLI.includeAlphaBeta,
      endianness: CLI.endianness,
      icOverride: CLI.icOverride,
      force: CLI.force,
    });
    return;
  }

  // Batch mode (deposit/transfer/withdraw)
  const circuits = ["deposit", "transfer", "withdraw"];
  const buildDir = path.join(__dirname, "..", "build");
  const outDir = path.join(__dirname, "..", "..", "cipherpay-anchor", "src", "zk_verifier");

  console.log("Converting Circom verification keys to binary for groth16-solana...\n");
  fs.mkdirSync(outDir, { recursive: true });

  let total = 0;
  for (const c of circuits) {
    const jsonPath = path.join(buildDir, c, "verification_key.json");
    const outPath = path.join(outDir, `${c}_vk.bin`);
    if (!fs.existsSync(jsonPath)) {
      console.error(`  ✗ Missing: ${jsonPath}`);
      continue;
    }
    try {
      total += convertVerificationKey(jsonPath, outPath, {
        includeAlphaBeta: CLI.includeAlphaBeta,
        endianness: CLI.endianness,
        icOverride: CLI.icOverride,
        force: CLI.force,
      });
    } catch (e) {
      console.error(`  ✗ Error converting ${c}: ${e.message}\n`);
    }
  }

  console.log("=".repeat(60));
  console.log(`Total bytes written: ${total}`);
  console.log(`Output directory   : ${outDir}`);
  console.log("\nNext steps:");
  console.log("  1) Ensure your Rust includes match these paths (e.g., include_bytes!(...)).");
  console.log("  2) Rebuild + redeploy the on-chain verifier.");
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    die(e.stack || String(e));
  }
}

module.exports = {
  convertVerificationKey,
  _internals: {
    asBigInt, normFq, toBytes32, parseG1, parseG2, encG1, encG2, collectG1PointsDeep,
  },
};
