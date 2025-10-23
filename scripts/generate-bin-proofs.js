#!/usr/bin/env node
/* eslint-disable no-console */
// scripts/generate-bin-proofs.js
"use strict";

const fs = require("fs");
const path = require("path");

// BN254 (bn128) field prime
const FQ =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/* ----------------------------- bigint helpers ---------------------------- */
const asBig = (v) => {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string") {
    const s = v.trim();
    return s.startsWith("0x") || s.startsWith("0X") ? BigInt(s) : BigInt(s);
  }
  if (Array.isArray(v) && v.length === 1) return asBig(v[0]);
  throw new Error(`Cannot parse BigInt from: ${JSON.stringify(v)}`);
};
const normFq = (x) => {
  let n = asBig(x) % FQ;
  if (n < 0n) n += FQ;
  return n;
};
/** little-endian 32B */
const le32 = (x) => {
  let v = normFq(x);
  const b = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    b[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return b;
};

/* -------------------------------- parsers -------------------------------- */
/** G1: accept [x,y], [x,y,z], {x,y}, {"0":x,"1":y}, or [[x,y]] */
function parseG1(p) {
  if (Array.isArray(p)) {
    if (p.length >= 2 && !Array.isArray(p[0])) return [asBig(p[0]), asBig(p[1])];
    if (p.length === 1 && Array.isArray(p[0]) && p[0].length >= 2) {
      return [asBig(p[0][0]), asBig(p[0][1])];
    }
  } else if (p && typeof p === "object") {
    if ("x" in p && "y" in p) return [asBig(p.x), asBig(p.y)];
    if ("0" in p && "1" in p) return [asBig(p["0"]), asBig(p["1"])];
  }
  throw new Error(`Unrecognized G1 shape: ${JSON.stringify(p)}`);
}

/** G2: accept [[x0,x1],[y0,y1]] or [[x0,x1],[y0,y1],[z0,z1]] or flat [x0,x1,y0,y1] or {x:[..],y:[..]} */
function parseG2(p) {
  const fq2 = (q) => {
    if (Array.isArray(q)) {
      if (q.length >= 2) return [asBig(q[0]), asBig(q[1])];
    } else if (q && typeof q === "object") {
      if ("c0" in q && "c1" in q) return [asBig(q.c0), asBig(q.c1)];
      if ("0" in q && "1" in q) return [asBig(q["0"]), asBig(q["1"])];
    }
    throw new Error(`Unrecognized Fq2 shape: ${JSON.stringify(q)}`);
  };

  if (Array.isArray(p)) {
    if (p.length === 4 && !Array.isArray(p[0])) {
      // flat affine
      return [asBig(p[0]), asBig(p[1]), asBig(p[2]), asBig(p[3])];
    }
    if (p.length >= 2 && Array.isArray(p[0]) && Array.isArray(p[1])) {
      // affine or jacobian (ignore z)
      const [x0, x1] = fq2(p[0]);
      const [y0, y1] = fq2(p[1]);
      return [x0, x1, y0, y1];
    }
  } else if (p && typeof p === "object") {
    if ("x" in p && "y" in p) {
      const [x0, x1] = fq2(p.x);
      const [y0, y1] = fq2(p.y);
      return [x0, x1, y0, y1];
    }
  }
  throw new Error(`Unrecognized G2 shape: ${JSON.stringify(p)}`);
}

/* -------------------------------- encoders ------------------------------- */
const encG1 = (p) => {
  const [x, y] = parseG1(p);
  return Buffer.concat([le32(x), le32(y)]); // 64 bytes
};
const encG2 = (p) => {
  const [x0, x1, y0, y1] = parseG2(p);
  return Buffer.concat([le32(x0), le32(x1), le32(y0), le32(y1)]); // 128 bytes
};

/* ------------------------------- converters ------------------------------ */
/** 256-byte Groth16 proof: pi_a(G1)||pi_b(G2)||pi_c(G1) */
function convertProofToBinary(proof) {
  if (!proof || !proof.pi_a || !proof.pi_b || !proof.pi_c) {
    throw new Error("Malformed proof: missing pi_a/pi_b/pi_c");
  }
  const a = encG1(proof.pi_a); // 64
  const b = encG2(proof.pi_b); // 128
  const c = encG1(proof.pi_c); // 64
  return Buffer.concat([a, b, c]);
}

/* ---------------------------- labels/printing --------------------------- */
const LABELS = {
  deposit: [
    "newCommitment",
    "ownerCipherPayPubKey",
    "newMerkleRoot",
    "newNextLeafIndex",
    "amount",
    "depositHash",
    "oldMerkleRoot",
  ],
  transfer: [
    "outCommitment1",
    "outCommitment2",
    "nullifier",
    "merkleRoot",
    "newMerkleRoot1",
    "newMerkleRoot2",
    "newNextLeafIndex",
    "encNote1Hash",
    "encNote2Hash",
  ],
  // UPDATED withdraw layout (7 items):
  // [ nullifier, merkleRoot, recipientOwner_lo, recipientOwner_hi, recipientWalletPubKey, amount, tokenId ]
  withdraw: [
    "nullifier",
    "merkleRoot",
    "recipientOwner_lo",
    "recipientOwner_hi",
    "recipientWalletPubKey",
    "amount",
    "tokenId",
  ],
};
const baseName = (c) => c.replace(/\d+$/, "");

/* --------------------------------- IO ----------------------------------- */
function readJSON(p) {
  if (!fs.existsSync(p)) throw new Error(`File not found: ${p}`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }

/* --------- public signals encoder (LE for all; limbs need no special) --- */
function convertPublicSignalsToBinary(publicSignals /* array */, circuit) {
  if (!Array.isArray(publicSignals)) throw new Error("publicSignals must be an array");

  // After the limbs refactor, EVERYTHING is encoded as 32-byte little-endian.
  // For withdraw, indices 2 and 3 are recipientOwner_lo/hi. Each is < 2^128,
  // so their LE-encoded 32B will have the 16 low bytes carry the limb, rest zero.
  return Buffer.concat(publicSignals.map((s) => le32(s)));
}

/* ------------------------------ path helpers ---------------------------- */
function resolveInPaths(buildRoot, circuit) {
  const dir = path.join(buildRoot, circuit);
  return {
    dir,
    proofJson: path.join(dir, "proof.json"),
    publicsJson: path.join(dir, "public_signals.json"),
  };
}
function resolveOutPaths(outRoot, circuit) {
  const dir = outRoot; // flat output; filenames include suffix if present
  ensureDir(dir);
  return {
    proofBin: path.join(dir, `${circuit}_proof.bin`),
    publicsBin: path.join(dir, `${circuit}_public_signals.bin`),
    payloadBin: path.join(dir, `${circuit}_payload.bin`),
  };
}

/* ------------------------------ converters ------------------------------ */
async function convertOne({ circuit, inDir, outDir }) {
  const buildRoot = path.resolve(inDir);
  const outRoot = path.resolve(outDir);

  console.log(`📦 Converting ${circuit} from JSON → binary …`);
  const IN = resolveInPaths(buildRoot, circuit);
  const OUT = resolveOutPaths(outRoot, circuit);

  // read JSON
  const proof = readJSON(IN.proofJson);
  const publicSignals = readJSON(IN.publicsJson);

  // convert
  const proofBin = convertProofToBinary(proof); // 256 bytes
  const pubsBin = convertPublicSignalsToBinary(publicSignals, circuit);
  const payloadBin = Buffer.concat([proofBin, pubsBin]);

  // write
  fs.writeFileSync(OUT.proofBin, proofBin);
  fs.writeFileSync(OUT.publicsBin, pubsBin);
  fs.writeFileSync(OUT.payloadBin, payloadBin);

  // logs
  console.log("✅ Converted!");
  console.log(`  • Proof (256B): ${OUT.proofBin}`);
  console.log(
    `  • Publics (${publicSignals.length} × 32B = ${pubsBin.length}B): ${OUT.publicsBin}`
  );
  console.log(
    `  • Payload (${payloadBin.length}B = 256 + 32×${publicSignals.length}): ${OUT.payloadBin}`
  );

  // pretty print when labels size matches
  const labels = LABELS[baseName(circuit)];
  if (labels && labels.length === publicSignals.length) {
    console.log("🔎 Public signals (labeled):");
    labels.forEach((k, i) => console.log(`  ${k} = ${publicSignals[i]}`));
  } else {
    console.log(`🔎 Public signals: ${publicSignals.join(", ")}`);
  }

  return {
    circuit,
    proofPath: OUT.proofBin,
    publicsPath: OUT.publicsBin,
    payloadPath: OUT.payloadBin,
    nPublic: publicSignals.length,
  };
}

async function convertMany({ circuits, inDir, outDir }) {
  const results = [];
  for (const circuit of circuits) {
    try {
      results.push(await convertOne({ circuit, inDir, outDir }));
    } catch (e) {
      console.error(`❌ ${circuit} failed: ${e.message || e}`);
    }
  }
  console.log("✅ Done.");
  return results;
}

/* ------------------------------- circuit sets --------------------------- */
const BASES = ["deposit", "transfer", "withdraw"];
const SUFFIXES = ["", "1", "2", "3"];
const circuitsForSuffix = (sfx) => BASES.map((b) => b + sfx);
const allPipelineCircuits = () => SUFFIXES.flatMap((sfx) => circuitsForSuffix(sfx));

/* ---------------------------------- CLI --------------------------------- */
if (require.main === module) {
  (async () => {
    try {
      const args = process.argv.slice(2);
      const isAll = args.includes("--all");
      const inArg = args.find((a) => a.startsWith("--in="));
      const outArg = args.find((a) => a.startsWith("--out="));
      const pipelineArg = args.find((a) => a.startsWith("--pipeline="));
      const repoRoot = path.join(__dirname, "..");

      const inDir = inArg ? inArg.split("=")[1] : path.join(repoRoot, "build");

      // Default out dir → ../../cipherpay-anchor/proofs (if exists), else <repo>/proofs
      let defaultOut = path.resolve(path.join(repoRoot, "..", "cipherpay-anchor", "proofs"));
      if (!fs.existsSync(path.join(repoRoot, "..", "cipherpay-anchor"))) {
        defaultOut = path.join(repoRoot, "proofs");
      }
      const outDir = outArg ? outArg.split("=")[1] : defaultOut;

      if (isAll) {
        await convertMany({ circuits: allPipelineCircuits(), inDir, outDir });
        process.exit(0);
      }

      if (pipelineArg) {
        const p = pipelineArg.split("=")[1].toUpperCase();
        const map = { A: "", B: "1", C: "2", D: "3" };
        if (!(p in map)) throw new Error("Invalid --pipeline value. Use A, B, C, or D.");
        const circuits = circuitsForSuffix(map[p]);
        await convertMany({ circuits, inDir, outDir });
        process.exit(0);
      }

      const names = args.filter((a) => !a.startsWith("--"));
      if (names.length === 0) {
        await convertOne({ circuit: "deposit", inDir, outDir });
        process.exit(0);
      }

      const validName = (n) => /^(deposit|transfer|withdraw)\d*$/.test(n);
      const bad = names.find((n) => !validName(n));
      if (bad) {
        throw new Error(
          `Unknown circuit '${bad}'. Use deposit|transfer|withdraw optionally with suffix 1|2|3, or --all / --pipeline=A|B|C|D.`
        );
      }

      await convertMany({ circuits: names, inDir, outDir });
      process.exit(0);
    } catch (e) {
      console.error("❌ Error:", e.message || e);
      console.error(
        "   Hints:\n" +
          "   • Ensure build/<circuit{,1,2,3}>/proof.json and public_signals.json exist (run your prover first).\n" +
          "   • Public signals are written in the exact Circom order (outputs first, then public inputs).\n" +
          "   • Withdraw now exports 7 publics (lo/hi limbs). Update on-chain length checks to 7*32.\n" +
          "   • Use --pipeline=A|B|C|D to convert a single pipeline, or --all for A..D."
      );
      process.exit(1);
    }
  })();
}

module.exports = {
  convertOne,
  convertMany,
  _internals: {
    parseG1,
    parseG2,
    le32,
    normFq,
  },
};
