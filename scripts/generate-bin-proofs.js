#!/usr/bin/env node
/* eslint-disable no-console */
// scripts/generate-bin-proofs.js
"use strict";

const fs = require("fs");
const path = require("path");
const { generateProof, exampleInputs } = require("./generate-example-proof.js");

// BN254 (bn128) field prime
const FQ =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// ---------- bigint helpers ----------
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
const le32 = (x) => {
  let v = normFq(x);
  const b = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    b[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return b;
};

// ---------- point parsers ----------
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

// ---------- encoders ----------
const encG1 = (p) => {
  const [x, y] = parseG1(p);
  return Buffer.concat([le32(x), le32(y)]); // 64 bytes
};
const encG2 = (p) => {
  const [x0, x1, y0, y1] = parseG2(p);
  return Buffer.concat([le32(x0), le32(x1), le32(y0), le32(y1)]); // 128 bytes
};

// ---------- conversion ----------
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

/** Write ALL public signals in the exact order Circom produced them */
function convertPublicSignalsToBinary(publicSignals) {
  if (!Array.isArray(publicSignals)) throw new Error("publicSignals must be an array");
  const bufs = publicSignals.map((s) => le32(s));
  return Buffer.concat(bufs);
}

// ---------- pretty labels (optional sanity) ----------
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
  withdraw: ["nullifier", "merkleRoot", "recipientWalletPubKey", "amount", "tokenId"],
};

// ---------- main per-circuit ----------
async function generateBinaryProofs(circuit = "deposit", input = null) {
  console.log(`📦 Generating ${circuit} proof...`);

  const inObj = input || exampleInputs[circuit];
  if (!inObj) throw new Error(`No example inputs found for circuit '${circuit}'`);

  const { proof, publicSignals } = await generateProof(circuit, inObj);

  console.log("✅ Proof generated!");
  console.log(`📊 Public signals count: ${publicSignals.length}`);

  // Pretty labels if we know the exact order/length
  const labels = LABELS[circuit];
  if (labels && labels.length === publicSignals.length) {
    console.log("🔎 Public signals (labeled):");
    labels.forEach((k, i) => console.log(`  ${k} = ${publicSignals[i]}`));
  } else {
    console.log(`🔎 Public signals: ${publicSignals.join(", ")}`);
    if (labels) {
      console.warn(
        `⚠️  Expected ${labels.length} signals for '${circuit}', got ${publicSignals.length}. ` +
          "Double-check your circuit's public ordering."
      );
    }
  }

  // Convert
  const proofBin = convertProofToBinary(proof);                  // 256 bytes
  const pubBin = convertPublicSignalsToBinary(publicSignals);    // 32 * nPublic
  const payloadBin = Buffer.concat([proofBin, pubBin]);          // One-shot blob

  // Save alongside your on-chain program
  const outDir = path.join(__dirname, "..", "..", "cipherpay-anchor", "proofs");
  fs.mkdirSync(outDir, { recursive: true });

  const proofPath = path.join(outDir, `${circuit}_proof.bin`);
  const pubPath = path.join(outDir, `${circuit}_public_signals.bin`);
  const payloadPath = path.join(outDir, `${circuit}_payload.bin`);

  fs.writeFileSync(proofPath, proofBin);
  fs.writeFileSync(pubPath, pubBin);
  fs.writeFileSync(payloadPath, payloadBin);

  console.log("\n📁 Binary files saved:");
  console.log(`  • Proof           : ${proofPath} (${proofBin.length} bytes)`);
  console.log(`  • Public signals  : ${pubPath} (${pubBin.length} bytes)`);
  console.log(
    `  • Payload (concat) : ${payloadPath} (${payloadBin.length} bytes = 256 + 32 * ${publicSignals.length})\n`
  );

  return {
    proofPath,
    pubPath,
    payloadPath,
    proofBytes: proofBin.length,
    pubBytes: pubBin.length,
    payloadBytes: payloadBin.length,
    nPublic: publicSignals.length,
  };
}

// ---------- batch helper ----------
async function generateAll() {
  console.log("🔧 Generating binary proof files for Solana integration...\n");
  const circuits = ["deposit", "transfer", "withdraw"];
  const results = [];
  for (const c of circuits) {
    try {
      results.push(await generateBinaryProofs(c));
    } catch (e) {
      console.error(`❌ ${c} failed: ${e.message || e}`);
    }
  }
  console.log("✅ Done.");
  return results;
}

// ---------- CLI ----------
if (require.main === module) {
  (async () => {
    try {
      // usage:
      //   node scripts/generate-binary-proofs.js                  -> deposit with example input
      //   node scripts/generate-binary-proofs.js transfer         -> transfer with example input
      //   node scripts/generate-binary-proofs.js withdraw         -> withdraw with example input
      //   node scripts/generate-binary-proofs.js deposit -i in.json
      //   node scripts/generate-binary-proofs.js --all
      const args = process.argv.slice(2);
      const isAll = args.includes("--all");
      if (isAll) {
        await generateAll();
        process.exit(0);
      }

      const circuit = args[0] && !args[0].startsWith("-") ? args[0] : "deposit";

      let customInput = null;
      const iPos = args.indexOf("-i");
      if (iPos !== -1 && args[iPos + 1]) {
        const p = path.resolve(args[iPos + 1]);
        if (!fs.existsSync(p)) throw new Error(`Input file not found: ${p}`);
        customInput = JSON.parse(fs.readFileSync(p, "utf8"));
      }

      await generateBinaryProofs(circuit, customInput);
      process.exit(0);
    } catch (e) {
      console.error("❌ Error:", e.message || e);
      console.error(
        "   Hints:\n" +
          "   • Ensure circuits are built and zkey/wasm exist (run scripts/setup.js).\n" +
          "   • Public signals are written in exact Circom order (outputs first).\n" +
          "   • deposit: depositHash = Poseidon(ownerCPPK, amount, nonce)."
      );
      process.exit(1);
    }
  })();
}

module.exports = {
  generateBinaryProofs,
  generateAll,
  _internals: {
    convertProofToBinary,
    convertPublicSignalsToBinary,
    parseG1,
    parseG2,
    le32,
    normFq,
  },
};
