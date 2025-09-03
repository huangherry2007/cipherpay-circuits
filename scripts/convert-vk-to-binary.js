#!/usr/bin/env node

/* eslint-disable no-console */
"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Convert Circom/zkSNARK Groth16 verifying key JSON (bn128/BN254)
 * to a flat binary format expected by groth16-solana:
 *
 * Layout (concatenated):
 *   vk_alpha_1       :  64 bytes (G1)
 *   vk_beta_2        : 128 bytes (G2)
 *   vk_gamma_2       : 128 bytes (G2)
 *   vk_delta_2       : 128 bytes (G2)
 *   vk_alphabeta_12  : variable (commonly 12 * 64 bytes if present)
 *   IC               : (nPublic + 1) * 64 bytes (G1)
 *
 * Notes:
 * - All field elements serialized as 32-byte little-endian.
 * - We accept hex ("0x...") and decimal strings.
 * - We accept G1/G2 points as arrays or objects, and nested arrays for vk_alphabeta_12.
 */

// BN254 (a.k.a. bn128) prime
const FQ_PRIME = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

// ------------------------- parsing helpers -------------------------

function asBigInt(x) {
  if (typeof x === "bigint") return x;
  if (typeof x === "number") return BigInt(x);
  if (typeof x === "string") {
    const s = x.trim();
    if (s.startsWith("0x") || s.startsWith("0X")) return BigInt(s);
    return BigInt(s);
  }
  // Some snarkjs JSONs use { "0": "...", "1": "..." } for arrays via JSON.stringify
  if (x && typeof x === "object" && "toString" in x) return BigInt(x.toString());
  throw new Error(`Cannot parse bigint from value of type ${typeof x}: ${JSON.stringify(x)}`);
}

function normFq(x) {
  // Normalize into [0, p-1]
  let n = asBigInt(x) % FQ_PRIME;
  if (n < 0n) n += FQ_PRIME;
  return n;
}

/** 32-byte little-endian */
function toLe32(fe) {
  let v = normFq(fe);
  const out = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

// ------------------------- point normalizers -------------------------

/** Parse a G1 point into [x, y] as BigInt */
function parseG1(p) {
  // Accept: [x, y], {x, y}, {"0": x, "1": y}, [[x, y, z]] (we’ll drop z if present)
  if (Array.isArray(p)) {
    if (p.length >= 2) return [asBigInt(p[0]), asBigInt(p[1])];
    if (p.length === 1 && Array.isArray(p[0]) && p[0].length >= 2) {
      return [asBigInt(p[0][0]), asBigInt(p[0][1])];
    }
  } else if (typeof p === "object" && p) {
    if ("x" in p && "y" in p) return [asBigInt(p.x), asBigInt(p.y)];
    if ("0" in p && "1" in p) return [asBigInt(p["0"]), asBigInt(p["1"])];
  }
  throw new Error(`Unrecognized G1 point shape: ${JSON.stringify(p)}`);
}

// Accepts affine [[x0,x1],[y0,y1]] or jacobian [[x0,x1],[y0,y1],[z0,z1]]
// Also accepts object shapes like { x:[c0,c1], y:[c0,c1] } or { x:{c0,..,c1..}, y:{...} }
function parseG2(p) {
    // helper: normalize "Fq2" container into [c0, c1]
    const ext = (q) => {
      if (Array.isArray(q)) {
        if (q.length < 2) throw new Error(`G2 coord too short: ${JSON.stringify(q)}`);
        return [q[0], q[1]];
      }
      if (q && typeof q === "object") {
        if ("c0" in q && "c1" in q) return [q.c0, q.c1];
        if ("0" in q && "1" in q) return [q["0"], q["1"]];
      }
      throw new Error(`Unrecognized Fq2 shape: ${JSON.stringify(q)}`);
    };
  
    // Array forms
    if (Array.isArray(p)) {
      // Affine or Jacobian (length >= 2). We ignore z if present.
      if (p.length >= 2 && Array.isArray(p[0]) && Array.isArray(p[1])) {
        const [x0, x1] = ext(p[0]);
        const [y0, y1] = ext(p[1]);
        return [asBigInt(x0), asBigInt(x1), asBigInt(y0), asBigInt(y1)];
      }
      // Flat affine [x0, x1, y0, y1]
      if (p.length === 4 && !Array.isArray(p[0]) && !Array.isArray(p[1])) {
        return [asBigInt(p[0]), asBigInt(p[1]), asBigInt(p[2]), asBigInt(p[3])];
      }
    }
  
    // Object forms
    if (p && typeof p === "object") {
      if ("x" in p && "y" in p) {
        const [x0, x1] = ext(p.x);
        const [y0, y1] = ext(p.y);
        return [asBigInt(x0), asBigInt(x1), asBigInt(y0), asBigInt(y1)];
      }
    }
  
    throw new Error(`Unrecognized G2 point shape: ${JSON.stringify(p)}`);
  }

// ------------------------- encoders -------------------------

function encG1(p) {
  const [x, y] = parseG1(p);
  return Buffer.concat([toLe32(x), toLe32(y)]); // 64 bytes
}

function encG2(p) {
  const [x0, x1, y0, y1] = parseG2(p);
  return Buffer.concat([toLe32(x0), toLe32(x1), toLe32(y0), toLe32(y1)]); // 128 bytes
}

function encG1Array(arr) {
  const bufs = [];
  for (const p of arr) bufs.push(encG1(p));
  return Buffer.concat(bufs);
}

/**
 * Flatten nested arrays/objects to a list of G1 points.
 * vk_alphabeta_12 can appear as deeply nested arrays in different snarkjs versions.
 */
function collectG1PointsDeep(val, out = []) {
  if (!val) return out;
  if (Array.isArray(val)) {
    // If this level looks like a G1 point, encode it; else descend
    const looksG1Array = val.length >= 2 && !Array.isArray(val[0]) && !Array.isArray(val[1]);
    if (looksG1Array) {
      out.push(val);
      return out;
    }
    for (const el of val) collectG1PointsDeep(el, out);
    return out;
  }
  if (typeof val === "object") {
    if ("x" in val && "y" in val) {
      out.push(val);
      return out;
    }
    // generic descent
    for (const k of Object.keys(val)) collectG1PointsDeep(val[k], out);
  }
  return out;
}

// ------------------------- conversion core -------------------------

function convertVerificationKey(jsonPath, outputPath) {
  console.log(`Converting ${jsonPath}`);
  const vk = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

  if ((vk.protocol || "").toLowerCase() !== "groth16") {
    throw new Error(`Unsupported protocol: ${vk.protocol}`);
  }
  const curve = (vk.curve || "").toLowerCase();
  if (curve !== "bn128" && curve !== "bn254") {
    throw new Error(`Unsupported curve: ${vk.curve}`);
  }

  const nPublic = Number(vk.nPublic ?? vk.ic?.length - 1 ?? 0);

  // Required sections
  const haveAlpha1 = !!vk.vk_alpha_1;
  const haveBeta2 = !!vk.vk_beta_2;
  const haveGamma2 = !!vk.vk_gamma_2;
  const haveDelta2 = !!vk.vk_delta_2;
  const haveIC = !!vk.IC || !!vk.ic;

  if (!haveAlpha1 || !haveBeta2 || !haveGamma2 || !haveDelta2 || !haveIC) {
    throw new Error(
      "Missing one or more required fields: vk_alpha_1, vk_beta_2, vk_gamma_2, vk_delta_2, IC"
    );
  }

  // Encode
  const alpha1 = encG1(vk.vk_alpha_1);
  const beta2 = encG2(vk.vk_beta_2);
  const gamma2 = encG2(vk.vk_gamma_2);
  const delta2 = encG2(vk.vk_delta_2);

  // alphabeta_12 (optional in some JSONs; often present in snarkjs vk)
  let alphabeta = Buffer.alloc(0);
  if (vk.vk_alphabeta_12 !== undefined) {
    const pts = collectG1PointsDeep(vk.vk_alphabeta_12, []);
    if (pts.length === 0) {
      console.warn("  • vk_alphabeta_12 present but empty/unrecognized; encoding as empty.");
    } else {
      const bufs = pts.map(encG1);
      alphabeta = Buffer.concat(bufs);
    }
  }

  // IC (G1 array)
  const ICarr = Array.isArray(vk.IC) ? vk.IC : Array.isArray(vk.ic) ? vk.ic : null;
  if (!ICarr) throw new Error("IC field not found as array.");
  const icBuf = encG1Array(ICarr);

  // Sanity: nPublic match
  const expectedIcLen = nPublic + 1;
  if (ICarr.length !== expectedIcLen) {
    console.warn(
      `  • Warning: IC length (${ICarr.length}) != nPublic + 1 (${expectedIcLen}).`
    );
  }

  // Concatenate in expected order
  const out = Buffer.concat([alpha1, beta2, gamma2, delta2, alphabeta, icBuf]);

  // Write
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, out);

  // Logs
  console.log(`  Curve: ${vk.curve} | Public inputs: ${nPublic}`);
  console.log(`  Sections:`);
  console.log(`    vk_alpha_1      : ${alpha1.length} bytes`);
  console.log(`    vk_beta_2       : ${beta2.length} bytes`);
  console.log(`    vk_gamma_2      : ${gamma2.length} bytes`);
  console.log(`    vk_delta_2      : ${delta2.length} bytes`);
  console.log(`    vk_alphabeta_12 : ${alphabeta.length} bytes`);
  console.log(`    IC              : ${icBuf.length} bytes (${ICarr.length} G1 pts)`);
  console.log(`  Total             : ${out.length} bytes`);
  console.log(`  → Wrote ${outputPath}\n`);

  return out.length;
}

// ------------------------- CLI -------------------------

function printHelp() {
  console.log(`Usage:
  node scripts/convert-vk.js -i <verification_key.json> -o <output.bin>

Or batch-convert the default circuits (deposit/transfer/withdraw) laid out like:
  ./build/<circuit>/verification_key.json
  and write to ../cipherpay-anchor/src/zk_verifier/<circuit>_vk.bin

  node scripts/convert-vk.js --batch
`);
}

function main() {
  const args = process.argv.slice(2);
  const isBatch = args.includes("--batch");

  if (!isBatch) {
    const iPos = args.indexOf("-i");
    const oPos = args.indexOf("-o");
    if (iPos === -1 || oPos === -1 || !args[iPos + 1] || !args[oPos + 1]) {
      printHelp();
      process.exit(1);
    }
    const inPath = path.resolve(args[iPos + 1]);
    const outPath = path.resolve(args[oPos + 1]);

    if (!fs.existsSync(inPath)) {
      console.error(`Input not found: ${inPath}`);
      process.exit(1);
    }
    convertVerificationKey(inPath, outPath);
    return;
  }

  // Batch mode (keeps your original behavior)
  const circuits = ["deposit", "transfer", "withdraw"];
  const buildDir = path.join(__dirname, "..", "build");
  const outputDir = path.join(__dirname, "..", "..", "cipherpay-anchor", "src", "zk_verifier");

  console.log("Converting Circom verification keys to binary for groth16-solana...\n");
  fs.mkdirSync(outputDir, { recursive: true });

  let total = 0;
  for (const c of circuits) {
    const jsonPath = path.join(buildDir, c, "verification_key.json");
    const outPath = path.join(outputDir, `${c}_vk.bin`);
    if (!fs.existsSync(jsonPath)) {
      console.error(`  ✗ Missing: ${jsonPath}`);
      continue;
    }
    try {
      total += convertVerificationKey(jsonPath, outPath);
    } catch (e) {
      console.error(`  ✗ Error converting ${c}: ${e.message}\n`);
    }
  }

  console.log("=".repeat(60));
  console.log(`Total bytes written: ${total}`);
  console.log(`Output directory   : ${outputDir}`);
  console.log("\nNext steps:");
  console.log("  1) Ensure include_bytes!(..) paths match the output files.");
  console.log("  2) Rebuild the on-chain verifier (e.g., cargo check).");
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

module.exports = {
  convertVerificationKey,
  // exposed for tests
  _internals: {
    asBigInt,
    normFq,
    toLe32,
    parseG1,
    parseG2,
    encG1,
    encG2,
    collectG1PointsDeep,
  },
};
