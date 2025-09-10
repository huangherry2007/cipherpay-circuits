// scripts/generate-proof.js
/* eslint-disable no-console */
const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

// ---------- small helpers ----------
const toBig = (x, d = 0n) => {
  if (x === undefined || x === null) return d;
  if (typeof x === "bigint") return x;
  if (typeof x === "number") return BigInt(x);
  if (typeof x === "string") {
    const s = x.trim();
    if (s.length === 0) return d;
    return s.startsWith("0x") ? BigInt(s) : BigInt(s);
  }
  return d;
};
const dec = (x) => x.toString();

const ensureArray = (val, len, fill = "0") => {
  const a = Array.isArray(val) ? val.slice() : [];
  while (a.length < len) a.push(fill);
  a.length = len;
  return a;
};

const booleanize = (arr, len) =>
  ensureArray(arr, len, 0).map((v) => (Number(v) ? 1 : 0));

// ---------- labels (publicSignals order) ----------
const LABELS = {
  // deposit: outputs first then public inputs (per your deposit.circom)
  deposit: [
    "newCommitment",
    "ownerCipherPayPubKey",
    "newMerkleRoot",
    "newNextLeafIndex",
    "amount",
    "depositHash",
  ],

  // transfer: outputs first (7), then public inputs (2)
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

  // withdraw (with commitment PRIVATE):
  // outputs first (2), then public inputs (3)
  withdraw: [
    "nullifier",
    "merkleRoot",
    "recipientWalletPubKey",
    "amount",
    "tokenId",
  ],
};

// ---------- preprocess per circuit ----------
async function preprocessInput(circuitName, input) {
  // dynamic import so we can stay in CommonJS
  const { buildPoseidon } = await import("circomlibjs");
  const poseidon = await buildPoseidon();
  const F = poseidon.F;
  const H = (...xs) => F.toObject(poseidon(xs));

  // deep clone so we don’t mutate the caller’s object
  const out = JSON.parse(JSON.stringify(input || {}));

  if (circuitName === "deposit") {
    // derive ownerCipherPayPubKey -> depositHash
    const ownerWalletPubKey = toBig(out.ownerWalletPubKey);
    const ownerWalletPrivKey = toBig(out.ownerWalletPrivKey);
    const amount = toBig(out.amount);
    const nonce = toBig(out.nonce);

    const ownerCipherPayPubKey = H(ownerWalletPubKey, ownerWalletPrivKey);
    const expectedDepositHash = H(ownerCipherPayPubKey, amount, nonce);

    if (!out.depositHash || toBig(out.depositHash) !== expectedDepositHash) {
      console.log("• Overriding depositHash to:", expectedDepositHash.toString());
      out.depositHash = dec(expectedDepositHash);
    }

    // normalize Merkle inputs (depth = 16)
    out.inPathElements = ensureArray(out.inPathElements, 16, "0").map(String);
    out.inPathIndices = booleanize(out.inPathIndices, 16);
    out.nextLeafIndex = dec(toBig(out.nextLeafIndex));
  }

  if (circuitName === "transfer") {
    // Back-compat rename if older field present
    if (out.out2SenderCipherPayPubKey && !out.out2RecipientCipherPayPubKey) {
      out.out2RecipientCipherPayPubKey = out.out2SenderCipherPayPubKey;
      delete out.out2SenderCipherPayPubKey;
    }

    // --- normalize arrays (depth = 16) ---
    out.inPathElements = ensureArray(out.inPathElements, 16, "0").map(String);
    out.inPathIndices = booleanize(out.inPathIndices, 16);

    out.out1PathElements = ensureArray(out.out1PathElements, 16, "0").map(String);
    out.out2PathElements = ensureArray(out.out2PathElements, 16, "0").map(String);

    out.nextLeafIndex = dec(toBig(out.nextLeafIndex));

    // --- derive outCommitment1/2 off-chain (mirror NoteCommitment preimage) ---
    // Assumed: Poseidon(amount, cipherPayPubKey, randomness, tokenId, memo)
    const nc = (amount, cpk, rand, tokenId, memo) =>
      H(toBig(amount), toBig(cpk), toBig(rand), toBig(tokenId), toBig(memo));

    const outCommitment1 = nc(
      out.out1Amount,
      out.out1RecipientCipherPayPubKey,
      out.out1Randomness,
      out.out1TokenId,
      out.out1Memo
    );
    const outCommitment2 = nc(
      out.out2Amount,
      out.out2RecipientCipherPayPubKey,
      out.out2Randomness,
      out.out2TokenId,
      out.out2Memo
    );

    // --- derive encNote tags (public inputs) if missing/wrong ---
    const expectedTag1 = H(outCommitment1, toBig(out.out1RecipientCipherPayPubKey));
    const expectedTag2 = H(outCommitment2, toBig(out.out2RecipientCipherPayPubKey));

    if (!out.encNote1Hash || toBig(out.encNote1Hash) !== expectedTag1) {
      console.log("• Deriving encNote1Hash ->", expectedTag1.toString());
      out.encNote1Hash = dec(expectedTag1);
    }
    if (!out.encNote2Hash || toBig(out.encNote2Hash) !== expectedTag2) {
      console.log("• Deriving encNote2Hash ->", expectedTag2.toString());
      out.encNote2Hash = dec(expectedTag2);
    }
  }

  if (circuitName === "withdraw") {
    // normalize path arrays (depth = 16)
    out.pathElements = ensureArray(out.pathElements, 16, "0").map(String);
    out.pathIndices = booleanize(out.pathIndices, 16);

    // Reconstruct recipientCipherPayPubKey the same way as the circuit:
    // Poseidon(recipientWalletPubKey, recipientWalletPrivKey)
    const rPub = toBig(out.recipientWalletPubKey);
    const rPriv = toBig(out.recipientWalletPrivKey);
    const recipientCipherPayPubKey = H(rPub, rPriv);

    // NoteCommitment preimage: (amount, cipherPayPubKey, randomness, tokenId, memo)
    const amount = toBig(out.amount);
    const tokenId = toBig(out.tokenId);
    const randomness = toBig(out.randomness);
    const memo = toBig(out.memo);

    const expectedCommitment = H(
      amount,
      recipientCipherPayPubKey,
      randomness,
      tokenId,
      memo
    );

    if (!out.commitment || toBig(out.commitment) !== expectedCommitment) {
      console.log("• (withdraw) Setting private commitment ->", expectedCommitment.toString());
      out.commitment = dec(expectedCommitment); // private witness field
    }
  }

  return out;
}

// ---------- main proof function ----------
async function generateProof(circuitName, input) {
  console.log(`Generating proof for ${circuitName} circuit...`);

  const buildPath = path.join(__dirname, `../build/${circuitName}`);
  const wasmPath = path.join(buildPath, `${circuitName}_js/${circuitName}.wasm`);
  const zkeyPath = path.join(buildPath, `${circuitName}.zkey`);

  if (!fs.existsSync(wasmPath)) {
    throw new Error(`WASM file not found at ${wasmPath}. Please run setup.js first.`);
  }
  if (!fs.existsSync(zkeyPath)) {
    throw new Error(`ZKey file not found at ${zkeyPath}. Please run setup.js first.`);
  }

  const prepared = await preprocessInput(circuitName, input);

  console.log("Generating proof...");
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    prepared,
    wasmPath,
    zkeyPath
  );

  // save artifacts
  fs.mkdirSync(buildPath, { recursive: true });
  const proofPath = path.join(buildPath, "proof.json");
  const signalsPath = path.join(buildPath, "public_signals.json");
  fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2));
  fs.writeFileSync(signalsPath, JSON.stringify(publicSignals, null, 2));

  // pretty print (labeled if we know the order)
  const labels = LABELS[circuitName];
  if (labels && labels.length === publicSignals.length) {
    const labeled = {};
    for (let i = 0; i < labels.length; i++) labeled[labels[i]] = publicSignals[i];
    fs.writeFileSync(
      path.join(buildPath, "public_signals_labeled.json"),
      JSON.stringify(labeled, null, 2)
    );
    console.log("Public signals (labeled):");
    for (let i = 0; i < labels.length; i++) {
      console.log(`  ${labels[i]} = ${publicSignals[i]}`);
    }
  } else {
    console.log(`Public signals (${publicSignals.length}): ${publicSignals.join(", ")}`);
  }

  console.log(`Proof generated and saved to ${proofPath}`);
  return { proof, publicSignals };
}

// ---------- example inputs (fallbacks) ----------
const exampleInputs = {
  transfer: {
    // Input note (preimage)
    inAmount: "100",
    inSenderWalletPubKey:
      "1234567890123456789012345678901234567890123456789012345678901234",
    inSenderWalletPrivKey:
      "1111111111111111111111111111111111111111111111111111111111111111",
    inRandomness:
      "9876543210987654321098765432109876543210987654321098765432109876",
    inTokenId: "1",
    inMemo: "0",

    // Membership path for the input commitment
    inPathElements: Array(16).fill("0"),
    inPathIndices: Array(16).fill(0),

    // Output note 1 (recipient)
    out1Amount: "60",
    out1RecipientCipherPayPubKey:
      "2222222222222222222222222222222222222222222222222222222222222222",
    out1Randomness:
      "4444444444444444444444444444444444444444444444444444444444444444",
    out1TokenId: "1",
    out1Memo: "0",

    // Output note 2 (flexible recipient)
    out2Amount: "40",
    out2RecipientCipherPayPubKey:
      "5555555555555555555555555555555555555555555555555555555555555555",
    out2Randomness:
      "7777777777777777777777777777777777777777777777777777777777777777",
    out2TokenId: "1",
    out2Memo: "0",

    // Append two leaves at consecutive indices
    nextLeafIndex: "0",
    out1PathElements: Array(16).fill("0"),
    out2PathElements: Array(16).fill("0"),

    // Public inputs (auto-derived if omitted)
    // encNote1Hash: "...",
    // encNote2Hash: "...",
  },

  withdraw: {
    recipientWalletPrivKey:
      "1111111111111111111111111111111111111111111111111111111111111111",
    randomness:
      "9876543210987654321098765432109876543210987654321098765432109876",
    memo: "0",
    pathElements: Array(16).fill("0"),
    pathIndices: Array(16).fill(0),

    // Public inputs
    recipientWalletPubKey:
      "1234567890123456789012345678901234567890123456789012345678901234",
    amount: "100",
    tokenId: "1",

    // Private input (optional here; will be auto-derived if missing/mismatched)
    // commitment: "..."
  },

  deposit: {
    ownerWalletPubKey: "0",
    ownerWalletPrivKey: "0",
    randomness: "0",
    tokenId: "0",
    memo: "0",
    inPathElements: Array(16).fill("0"),
    inPathIndices: Array(16).fill(0),
    nextLeafIndex: "0",
    nonce: "0",
    amount: "100",
    // depositHash will be derived automatically
  },
};

// ---------- CLI ----------
async function main() {
  const args = process.argv.slice(2);
  const circuitName = args[0];

  if (!circuitName) {
    console.log("Usage: node generate-proof.js <circuit-name> [-i input.json]");
    console.log("Available circuits:", Object.keys(exampleInputs).join(", "));
    process.exit(1);
  }

  let input = exampleInputs[circuitName];
  const iPos = args.indexOf("-i");
  if (iPos !== -1 && args[iPos + 1]) {
    const inputPath = path.resolve(args[iPos + 1]);
    if (!fs.existsSync(inputPath)) {
      console.error("Input file not found:", inputPath);
      process.exit(1);
    }
    input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  }

  if (!input) {
    console.error(`Unknown circuit: ${circuitName}`);
    console.log("Available circuits:", Object.keys(exampleInputs).join(", "));
    process.exit(1);
  }

  try {
    const { proof, publicSignals } = await generateProof(circuitName, input);
    console.log("\n✅ Proof generation completed successfully!");
    console.log(`📊 Public signals: ${publicSignals.length}`);
    console.log(`🔐 Proof parts: ${Object.keys(proof).join(", ")}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Proof generation failed:", err.message || err);
    console.error(
      "   Hints:\n" +
        "    • transfer: encNote1/2 hashes are auto-derived; ensure arrays are length 16 and indices are 0/1.\n" +
        "    • deposit: depositHash must equal Poseidon(ownerCipherPayPubKey, amount, nonce).\n" +
        "    • withdraw: commitment is PRIVATE and auto-derived from (amount, recipient keys, randomness, tokenId, memo)."
    );
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { generateProof, preprocessInput, exampleInputs };
