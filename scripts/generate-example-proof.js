/* eslint-disable no-console */
// scripts/generate-example-proofs.js
const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

/* ---------------- small helpers ---------------- */
const toBig = (x, d = 0n) => {
  if (x === undefined || x === null) return d;
  if (typeof x === "bigint") return x;
  if (typeof x === "number") return BigInt(x);
  if (typeof x === "string") {
    const s = x.trim();
    if (!s) return d;
    return s.startsWith("0x") || s.startsWith("0X") ? BigInt(s) : BigInt(s);
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

const isAllZeroish = (arr) =>
  Array.isArray(arr) &&
  arr.every((v) => (typeof v === "string" ? v.trim() === "0" : Number(v) === 0));

/* ---------------- labels (publicSignals order) ---------------- */
const LABELS = {
  // deposit: outputs first then public inputs
  deposit: [
    "newCommitment",
    "ownerCipherPayPubKey",
    "newMerkleRoot",
    "newNextLeafIndex",
    "amount",
    "depositHash",
    "oldMerkleRoot",
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
  // withdraw: outputs first (2), then public inputs (3)
  withdraw: ["nullifier", "merkleRoot", "recipientWalletPubKey", "amount", "tokenId"],
};

/* ---------------- Poseidon + Merkle helpers ---------------- */
async function getPoseidonClassic() {
  // dynamic import so we can stay in CommonJS
  const { buildPoseidon } = await import("circomlibjs");
  const poseidon = await buildPoseidon(); // classic Poseidon (matches poseidon.circom)
  const F = poseidon.F;
  const H = (...xs) => F.toObject(poseidon(xs));
  return { poseidon, F, H };
}

/** Compute per-level zeros z[0..depth], where z0 = 0, zi = H(zi-1, zi-1). */
async function computeZeros(depth) {
  const { H } = await getPoseidonClassic();
  const z = [0n];
  for (let i = 1; i <= depth; i++) z[i] = H(z[i - 1], z[i - 1]);
  return z;
}

/** Build path indices from nextLeafIndex (bottom→top). */
function indicesFromIndex(nextLeafIndex, depth) {
  const n = Number(nextLeafIndex) >>> 0;
  return Array.from({ length: depth }, (_, i) => (n >> i) & 1);
}

/** Compute Merkle root from a leaf + (siblings, indices), using H(left,right). */
function computeRoot(H, leaf, pathElements, pathIndices) {
  let cur = toBig(leaf);
  const depth = pathElements.length;
  for (let i = 0; i < depth; i++) {
    const sib = toBig(pathElements[i]);
    const bit = Number(pathIndices[i]) ? 1 : 0;
    cur = bit === 0 ? H(cur, sib) : H(sib, cur);
  }
  return cur;
}

/** Compute the subtree root for a range of leaves [start, start+width). */
function buildSubtreeRoot(H, zeros, leavesMap, start, width) {
  if (width === 1) {
    const leaf = leavesMap.has(start) ? leavesMap.get(start) : zeros[0];
    return toBig(leaf);
  }
  const half = width >>> 1;
  const left = buildSubtreeRoot(H, zeros, leavesMap, start, half);
  const right = buildSubtreeRoot(H, zeros, leavesMap, start + half, half);
  return H(left, right);
}

/** Derive siblings for (membership or insertion) at index j, from a tree defined by `leavesMap`. */
function derivePathSiblings(H, zeros, leavesMap, j, depth) {
  const siblings = [];
  for (let i = 0; i < depth; i++) {
    const width = 1 << i;
    const siblingStart = (((j >> i) ^ 1) << i);
    const sibRoot = buildSubtreeRoot(H, zeros, leavesMap, siblingStart, width);
    siblings.push(sibRoot);
  }
  return siblings;
}

/** Pick only whitelisted keys for a circuit (avoid "Signal not found"). */
function pick(obj, keys) {
  const out = {};
  for (const k of keys) out[k] = obj[k];
  return out;
}

/* ---------------- preprocess per circuit ---------------- */
async function preprocessInput(circuitName, input) {
  const { H } = await getPoseidonClassic();

  // deep clone so we don’t mutate the caller’s object
  const src = JSON.parse(JSON.stringify(input || {}));

  if (circuitName === "deposit") {
    // ---- 1) Derive ownerCipherPayPubKey & depositHash ----
    const ownerWalletPubKey = toBig(src.ownerWalletPubKey);
    const ownerWalletPrivKey = toBig(src.ownerWalletPrivKey);
    const amount = toBig(src.amount);
    const nonce = toBig(src.nonce);

    const ownerCipherPayPubKey = H(ownerWalletPubKey, ownerWalletPrivKey);
    const expectedDepositHash = H(ownerCipherPayPubKey, amount, nonce);

    if (!src.depositHash || toBig(src.depositHash) !== expectedDepositHash) {
      console.log("• Overriding depositHash ->", expectedDepositHash.toString());
      src.depositHash = dec(expectedDepositHash);
    }

    // ---- 2) Normalize Merkle path using per-level zeros ----
    const DEPTH = Number(src.depth || process.env.CP_TREE_DEPTH || 16);
    const z = await computeZeros(DEPTH);

    // Always derive indices from nextLeafIndex (safe even when 0)
    const nextLeafIndex = toBig(src.nextLeafIndex);
    const inPathIndices = indicesFromIndex(nextLeafIndex, DEPTH);

    const userElems = ensureArray(src.inPathElements, DEPTH, "0");
    const useZeros = isAllZeroish(userElems);
    const pathElements = useZeros ? Array.from({ length: DEPTH }, (_, i) => z[i]) : userElems.map(toBig);

    // ---- 3) Derive oldMerkleRoot for that empty path ----
    const derivedOldRoot = computeRoot(H, 0n, pathElements, inPathIndices);
    if (!src.oldMerkleRoot || toBig(src.oldMerkleRoot) !== derivedOldRoot) {
      console.log("• Setting oldMerkleRoot ->", derivedOldRoot.toString());
      src.oldMerkleRoot = dec(derivedOldRoot);
    }

    // Return ONLY the circuit inputs
    const prepared = {
      ownerWalletPubKey: dec(ownerWalletPubKey),
      ownerWalletPrivKey: dec(ownerWalletPrivKey),
      randomness: dec(toBig(src.randomness)),
      tokenId: dec(toBig(src.tokenId)),
      memo: dec(toBig(src.memo)),

      inPathElements: pathElements.map(dec),
      inPathIndices,

      nextLeafIndex: dec(nextLeafIndex),

      nonce: dec(nonce),
      amount: dec(amount),

      depositHash: dec(expectedDepositHash),
      oldMerkleRoot: dec(derivedOldRoot),
    };

    if (process.env.DEBUG_ZEROS === "1") {
      console.log("🔍 derived inPathIndices =", prepared.inPathIndices);
      console.log("🔍 derived inPathElements[0..3] =", prepared.inPathElements.slice(0, 4));
    }

    return prepared;
  }

  if (circuitName === "transfer") {
    const DEPTH = Number(src.depth || process.env.CP_TREE_DEPTH || 16);
    const z = await computeZeros(DEPTH);

    // --- Input note (preimage -> commitment) ---
    const inAmount = toBig(src.inAmount);
    const inPub = toBig(src.inSenderWalletPubKey);
    const inPriv = toBig(src.inSenderWalletPrivKey);
    const inRand = toBig(src.inRandomness);
    const inTokenId = toBig(src.inTokenId);
    const inMemo = toBig(src.inMemo);

    const inCPPK = H(inPub, inPriv);
    const inCommitment = H(inAmount, inCPPK, inRand, inTokenId, inMemo);

    // Which leaf are we spending? (helper; NOT a circuit input)
    const inIndex = Number(src.inIndex ?? 0);

    // Build pre-insertion tree: ONLY the spent leaf exists
    const preLeaves = new Map();
    preLeaves.set(inIndex, inCommitment);

    // Membership (current tree): siblings & indices for inCommitment
    const inPathIndices = indicesFromIndex(inIndex, DEPTH);
    const inPathElements = derivePathSiblings(H, z, preLeaves, inIndex, DEPTH);

    // --- Output notes (commitments) ---
    const nc = (amount, cpk, rand, tokenId, memo) =>
      H(toBig(amount), toBig(cpk), toBig(rand), toBig(tokenId), toBig(memo));

    const out1CPK = toBig(src.out1RecipientCipherPayPubKey);
    const out2CPK = toBig(src.out2RecipientCipherPayPubKey);

    const outCommitment1 = nc(
      src.out1Amount,
      out1CPK,
      src.out1Randomness,
      src.out1TokenId,
      src.out1Memo
    );
    const outCommitment2 = nc(
      src.out2Amount,
      out2CPK,
      src.out2Randomness,
      src.out2TokenId,
      src.out2Memo
    );

    // --- Public tags (ciphertext binders) ---
    const encNote1Hash = H(outCommitment1, out1CPK);
    const encNote2Hash = H(outCommitment2, out2CPK);
    if (!src.encNote1Hash || toBig(src.encNote1Hash) !== encNote1Hash) {
      console.log("• Deriving encNote1Hash ->", encNote1Hash.toString());
    }
    if (!src.encNote2Hash || toBig(src.encNote2Hash) !== encNote2Hash) {
      console.log("• Deriving encNote2Hash ->", encNote2Hash.toString());
    }

    // --- Append positions ---
    const nextLeafIndex = Number(src.nextLeafIndex ?? 1); // after one deposit, index 1
    const j1 = nextLeafIndex;
    const j2 = j1 + 1;

    // out1PathElements: siblings for inserting at j1 on the **pre-insertion** tree (which only has the spent leaf).
    const out1PathElements = derivePathSiblings(H, z, preLeaves, j1, DEPTH);

    // out2PathElements: siblings for inserting at j2 on the **pre-insertion** tree (NOT after out1 is inserted).
    const out2PathElements = derivePathSiblings(H, z, preLeaves, j2, DEPTH);

    // Optional sanity/debug (not returned):
    const merkleRootBefore = computeRoot(H, inCommitment, inPathElements, inPathIndices);
    const newRoot1 = computeRoot(H, outCommitment1, out1PathElements, indicesFromIndex(j1, DEPTH));
    const newRoot2 = computeRoot(H, outCommitment2, out2PathElements, indicesFromIndex(j2, DEPTH));
    console.log("• (transfer) expected merkleRoot     =", merkleRootBefore.toString());
    console.log("• (transfer) expected newMerkleRoot1 =", newRoot1.toString());
    console.log("• (transfer) expected newMerkleRoot2 =", newRoot2.toString());
    console.log("• (transfer) expected newNextLeafIndex =", String(nextLeafIndex + 2));

    // Return ONLY the circuit inputs
    const prepared = {
      // input note
      inAmount: dec(inAmount),
      inSenderWalletPubKey: dec(inPub),
      inSenderWalletPrivKey: dec(inPriv),
      inRandomness: dec(inRand),
      inTokenId: dec(inTokenId),
      inMemo: dec(inMemo),

      inPathElements: inPathElements.map(dec),
      inPathIndices,

      // outputs
      out1Amount: dec(toBig(src.out1Amount)),
      out1RecipientCipherPayPubKey: dec(out1CPK),
      out1Randomness: dec(toBig(src.out1Randomness)),
      out1TokenId: dec(toBig(src.out1TokenId)),
      out1Memo: dec(toBig(src.out1Memo)),

      out2Amount: dec(toBig(src.out2Amount)),
      out2RecipientCipherPayPubKey: dec(out2CPK),
      out2Randomness: dec(toBig(src.out2Randomness)),
      out2TokenId: dec(toBig(src.out2TokenId)),
      out2Memo: dec(toBig(src.out2Memo)),

      // append-2
      nextLeafIndex: String(nextLeafIndex),
      out1PathElements: out1PathElements.map(dec),
      out2PathElements: out2PathElements.map(dec),

      // public inputs
      encNote1Hash: dec(encNote1Hash),
      encNote2Hash: dec(encNote2Hash),
    };

    return prepared;
  }

  if (circuitName === "withdraw") {
    const DEPTH = Number(src.depth || process.env.CP_TREE_DEPTH || 16);

    // normalize path arrays
    const pathElements = ensureArray(src.pathElements, DEPTH, "0").map(String);
    const pathIndices = booleanize(src.pathIndices, DEPTH);

    // Reconstruct recipientCipherPayPubKey the same way as the circuit:
    const { H: H2 } = await getPoseidonClassic();
    const rPub = toBig(src.recipientWalletPubKey);
    const rPriv = toBig(src.recipientWalletPrivKey);
    const recipientCipherPayPubKey = H2(rPub, rPriv);

    // NoteCommitment preimage: (amount, cipherPayPubKey, randomness, tokenId, memo)
    const amount = toBig(src.amount);
    const tokenId = toBig(src.tokenId);
    const randomness = toBig(src.randomness);
    const memo = toBig(src.memo);

    const expectedCommitment = H2(amount, recipientCipherPayPubKey, randomness, tokenId, memo);

    // Some variants of withdraw take `commitment` as a private witness; keep it if your circuit expects it.
    const prepared = {
      recipientWalletPrivKey: dec(rPriv),
      randomness: dec(randomness),
      memo: dec(memo),

      pathElements,
      pathIndices,

      recipientWalletPubKey: dec(rPub),
      amount: dec(amount),
      tokenId: dec(tokenId),
    };

    if ("commitment" in src) {
      prepared.commitment =
        !src.commitment || toBig(src.commitment) !== expectedCommitment
          ? dec(expectedCommitment)
          : dec(toBig(src.commitment));
    }

    return prepared;
  }

  return src;
}

/* ---------------- main proof function ---------------- */
async function generateProof(circuitName, input) {
  console.log(`Generating proof for ${circuitName} circuit...`);

  const buildPath = path.join(__dirname, `../build/${circuitName}`);
  const wasmPath = path.join(buildPath, `${circuitName}_js/${circuitName}.wasm`);
  const zkeyPath = path.join(buildPath, `${circuitName}_final.zkey`);

  if (!fs.existsSync(wasmPath)) {
    throw new Error(`WASM file not found at ${wasmPath}. Please run setup.js first.`);
  }
  if (!fs.existsSync(zkeyPath)) {
    throw new Error(`ZKey file not found at ${zkeyPath}. Please run setup.js first.`);
  }

  const prepared = await preprocessInput(circuitName, input);

  console.log("Generating proof...");
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(prepared, wasmPath, zkeyPath);

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
    for (let i = 0; i < labels.length; i++) console.log(`  ${labels[i]} = ${publicSignals[i]}`);
  } else {
    console.log(`Public signals (${publicSignals.length}): ${publicSignals.join(", ")}`);
  }

  console.log(`Proof generated and saved to ${proofPath}`);
  return { proof, publicSignals };
}

/* ---------------- example inputs (fallbacks) ---------------- */
const exampleInputs = {
  deposit: {
    ownerWalletPubKey: "0",
    ownerWalletPrivKey: "0",
    randomness: "0",
    tokenId: "0",
    memo: "0",

    inPathElements: Array(16).fill("0"), // replaced with z[i]
    inPathIndices: Array(16).fill(0),    // derived from nextLeafIndex
    nextLeafIndex: "0",

    nonce: "0",
    amount: "100",
    // oldMerkleRoot / depositHash auto-derived
  },

  transfer: {
    // Spend the note you minted in the very first deposit
    inAmount: "100",
    inSenderWalletPubKey: "0",
    inSenderWalletPrivKey: "0",
    inRandomness: "0",
    inTokenId: "0",
    inMemo: "0",

    // Helper only (NOT a circuit input). We remove it before proving.
    inIndex: "0",

    // Membership path for the input commitment (auto-derived)
    inPathElements: Array(16).fill("0"),
    inPathIndices: Array(16).fill(0),

    // Output note 1 (recipient)
    out1Amount: "60",
    out1RecipientCipherPayPubKey:
      "2222222222222222222222222222222222222222222222222222222222222222",
    out1Randomness:
      "4444444444444444444444444444444444444444444444444444444444444444",
    out1TokenId: "0",
    out1Memo: "0",

    // Output note 2
    out2Amount: "40",
    out2RecipientCipherPayPubKey:
      "5555555555555555555555555555555555555555555555555555555555555555",
    out2Randomness:
      "7777777777777777777777777777777777777777777777777777777777777777",
    out2TokenId: "0",
    out2Memo: "0",

    // Append two leaves at consecutive indices; after one deposit, this is 1
    nextLeafIndex: "1",
    out1PathElements: Array(16).fill("0"), // auto-derived
    out2PathElements: Array(16).fill("0"), // auto-derived

    // Public inputs (auto-derived)
    // encNote1Hash, encNote2Hash
  },

  withdraw: {
    recipientWalletPrivKey:
      "1111111111111111111111111111111111111111111111111111111111111111",
    randomness: "9876543210987654321098765432109876543210987654321098765432109876",
    memo: "0",
    pathElements: Array(16).fill("0"),
    pathIndices: Array(16).fill(0),

    // Public inputs
    recipientWalletPubKey:
      "1234567890123456789012345678901234567890123456789012345678901234",
    amount: "100",
    tokenId: "1",

    // Private input (optional; included only if circuit expects it)
    // commitment: "...",
  },
};

/* ---------------- CLI ---------------- */
async function main() {
  const args = process.argv.slice(2);
  const circuitName = args[0];

  if (!circuitName) {
    console.log("Usage: node generate-example-proof.js <circuit-name> [-i input.json]");
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
        "    • transfer: out1PathElements/out2PathElements are derived from the PRE-insertion tree.\n" +
        "    • transfer: inPathElements/Indices prove membership of the input note.\n" +
        "    • deposit: inPathElements must be per-level zeros z[i] and indices from nextLeafIndex.\n" +
        "    • withdraw: commitment is optional (depends on circuit), arrays must match depth.\n"
    );
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  generateProof,
  preprocessInput,
  exampleInputs,
  computeZeros,
  indicesFromIndex,
};
