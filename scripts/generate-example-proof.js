/* eslint-disable no-console */
const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

/* ---------------- tiny helpers ---------------- */
const toBig = (x, d = 0n) => {
  if (x === undefined || x === null) return d;
  if (typeof x === "bigint") return x;
  if (typeof x === "number") return BigInt(x);
  if (typeof x === "string") {
    const s = x.trim();
    return s ? (s.startsWith("0x") || s.startsWith("0X") ? BigInt(s) : BigInt(s)) : d;
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

/* ---------------- Poseidon + Merkle helpers ---------------- */
async function getPoseidonClassic() {
  // Works in CJS/ESM and under Jest without flags
  try {
    const { buildPoseidon } = await import("circomlibjs");
    const poseidon = await buildPoseidon();
    const F = poseidon.F || poseidon["F"];
    const H = (...xs) => F.toObject(poseidon(xs));
    return { poseidon, F, H };
  } catch (e) {
    const poseidonLib = require("circomlibjs");
    const buildPoseidon =
      poseidonLib.buildPoseidon || (poseidonLib.default && poseidonLib.default.buildPoseidon);
    if (!buildPoseidon) throw e;
    const poseidon = await buildPoseidon();
    const F = poseidon.F || poseidon["F"];
    const H = (...xs) => F.toObject(poseidon(xs));
    return { poseidon, F, H };
  }
}
async function computeZeros(depth) {
  const { H } = await getPoseidonClassic();
  const z = [0n];
  for (let i = 1; i <= depth; i++) z[i] = H(z[i - 1], z[i - 1]);
  return z;
}
function indicesFromIndex(nextLeafIndex, depth) {
  const n = Number(nextLeafIndex) >>> 0;
  return Array.from({ length: depth }, (_, i) => (n >> i) & 1);
}
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

/* ----- subtree + sibling derivation (used by deposit/transfer) ----- */
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

/* ----- robust layer-by-layer builder (used by withdraw final root) ----- */
function buildLayersFromLeaves(H, zeros, leavesMap, depth) {
  const N = 1 << depth;
  const layers = new Array(depth + 1);

  // layer 0: leaves
  layers[0] = new Array(N);
  for (let i = 0; i < N; i++) {
    layers[0][i] = leavesMap.has(i) ? toBig(leavesMap.get(i)) : zeros[0];
  }

  // parent layers
  for (let lvl = 1; lvl <= depth; lvl++) {
    const prev = layers[lvl - 1];
    const M = N >> lvl;
    const cur = new Array(M);
    for (let k = 0; k < M; k++) {
      cur[k] = H(prev[2 * k], prev[2 * k + 1]);
    }
    layers[lvl] = cur;
  }
  return layers;
}
function pathFromLayers(layers, j, depth) {
  const path = new Array(depth);
  for (let lvl = 0; lvl < depth; lvl++) {
    const nodeIdx = j >> lvl;
    const sibIdx = nodeIdx ^ 1;
    path[lvl] = layers[lvl][sibIdx];
  }
  return path;
}

/* ---------------- read BIN publics ---------------- */
const DEFAULT_PROOFS_DIR = process.env.PROOFS_DIR
  ? path.resolve(process.env.PROOFS_DIR)
  : path.resolve(__dirname, "..", "..", "cipherpay-anchor", "proofs");

function fromLeBytes32(buf) {
  let x = 0n;
  for (let i = 31; i >= 0; i--) x = (x << 8n) + BigInt(buf[i]);
  return x;
}
function readPublicsFromBin(circuit) {
  const p = path.join(DEFAULT_PROOFS_DIR, `${circuit}_public_signals.bin`);
  if (!fs.existsSync(p)) throw new Error(`Missing ${circuit} BIN publics at ${p}`);
  const b = fs.readFileSync(p);
  if (b.length % 32 !== 0) throw new Error(`Bad ${circuit} publics length: ${b.length}`);
  const n = b.length / 32;
  const arr = [];
  for (let i = 0; i < n; i++) {
    arr.push(fromLeBytes32(b.subarray(i * 32, (i + 1) * 32)));
  }
  return arr;
}

/* ---------------- derive withdraw path from deposit+transfer BINs ---------------- */
const DEP_IDX = { NEW_COMMITMENT: 0 };
const XFER_IDX = { OUT1: 0, OUT2: 1, NEW_ROOT2: 5, NEW_NEXT_IDX: 6 };

async function deriveWithdrawInputsFromTransfer(src, DEPTH) {
  const dep = readPublicsFromBin("deposit");
  const xfer = readPublicsFromBin("transfer");
  const { H } = await getPoseidonClassic();

  // Leaves present after transfer:
  //   index 0  -> deposit.newCommitment  (append-only tree; spent note remains)
  //   index j1 -> transfer.outCommitment1
  //   index j2 -> transfer.outCommitment2
  const depositLeaf = dep[DEP_IDX.NEW_COMMITMENT];
  const out1 = xfer[XFER_IDX.OUT1];
  const out2 = xfer[XFER_IDX.OUT2];
  const newNext = Number(xfer[XFER_IDX.NEW_NEXT_IDX]); // e.g., 3 after inserting two leaves
  const reportedNewRoot2 = xfer[XFER_IDX.NEW_ROOT2];

  const j1 = newNext - 2;
  const j2 = newNext - 1;

  const zeros = await computeZeros(DEPTH);
  const leaves = new Map();
  leaves.set(0, depositLeaf);
  leaves.set(j1, out1);
  leaves.set(j2, out2);

  // which output will withdraw spend?
  const spendWhich = Number(src.spendWhich || 1) === 2 ? 2 : 1;
  const spendIdx = spendWhich === 1 ? j1 : j2;
  const targetOut = spendWhich === 1 ? out1 : out2;

  // sanity: commitment reconstructed from withdraw preimage
  const { H: H2 } = await getPoseidonClassic();
  const rPub = toBig(src.recipientWalletPubKey);
  const rPriv = toBig(src.recipientWalletPrivKey);
  const cpk = H2(rPub, rPriv);
  const amount = toBig(src.amount);
  const tokenId = toBig(src.tokenId);
  const randomness = toBig(src.randomness);
  const memo = toBig(src.memo);
  const recomputedCommitment = H2(amount, cpk, randomness, tokenId, memo);
  if (recomputedCommitment !== targetOut) {
    console.warn("⚠️ withdraw: commitment mismatch vs selected transfer output");
    console.warn("   recomputed =", recomputedCommitment.toString());
    console.warn("   expected   =", targetOut.toString());
  }

  // Build the final root (after both inserts) strictly layer-by-layer.
  const layers = buildLayersFromLeaves(H, zeros, leaves, DEPTH);
  const finalRoot = layers[DEPTH][0];

  // Siblings and direction bits for the selected output leaf.
  const pathElementsBig = pathFromLayers(layers, spendIdx, DEPTH);
  const pathIndices = indicesFromIndex(spendIdx, DEPTH);

  // Optional: compare to transfer.newMerkleRoot2 (circuits may report a non-sequential variant)
  if (finalRoot !== reportedNewRoot2) {
    console.warn("⚠️ withdraw: reconstructed final root != transfer.newMerkleRoot2");
    console.warn("   reconstructed =", finalRoot.toString());
    console.warn("   expected      =", reportedNewRoot2.toString());
  } else {
    console.log("• (withdraw) derived merkleRoot =", finalRoot.toString());
  }

  return {
    pathElements: pathElementsBig.map(dec),
    pathIndices,
    commitment: dec(recomputedCommitment),
  };
}

/* ---------------- preprocess per circuit ---------------- */
async function preprocessInput(circuitName, input) {
  const { H } = await getPoseidonClassic();
  const src = JSON.parse(JSON.stringify(input || {}));

  if (circuitName === "deposit") {
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

    const DEPTH = Number(src.depth || process.env.CP_TREE_DEPTH || 16);
    const z = await computeZeros(DEPTH);

    const nextLeafIndex = toBig(src.nextLeafIndex);
    const inPathIndices = indicesFromIndex(nextLeafIndex, DEPTH);

    const userElems = ensureArray(src.inPathElements, DEPTH, "0");
    const useZeros = isAllZeroish(userElems);
    const pathElements = useZeros
      ? Array.from({ length: DEPTH }, (_, i) => z[i])
      : userElems.map(toBig);

    const derivedOldRoot = computeRoot(H, 0n, pathElements, inPathIndices);
    if (!src.oldMerkleRoot || toBig(src.oldMerkleRoot) !== derivedOldRoot) {
      console.log("• Setting oldMerkleRoot ->", derivedOldRoot.toString());
      src.oldMerkleRoot = dec(derivedOldRoot);
    }

    return {
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
  }

  if (circuitName === "transfer") {
    const DEPTH = Number(src.depth || process.env.CP_TREE_DEPTH || 16);
    const z = await computeZeros(DEPTH);

    // input note
    const inAmount = toBig(src.inAmount);
    const inPub = toBig(src.inSenderWalletPubKey);
    const inPriv = toBig(src.inSenderWalletPrivKey);
    const inRand = toBig(src.inRandomness);
    const inTokenId = toBig(src.inTokenId);
    const inMemo = toBig(src.inMemo);

    const inCPPK = H(inPub, inPriv);
    const inCommitment = H(inAmount, inCPPK, inRand, inTokenId, inMemo);

    const inIndex = Number(src.inIndex ?? 0);
    const preLeaves = new Map();
    preLeaves.set(inIndex, inCommitment);

    const inPathIndices = indicesFromIndex(inIndex, DEPTH);
    const inPathElements = derivePathSiblings(H, z, preLeaves, inIndex, DEPTH);

    // outputs — REQUIRE CipherPay pubkeys; do not accept raw wallet keys here
    const out1CPK = toBig(src.out1RecipientCipherPayPubKey);
    if (src.out1RecipientCipherPayPubKey === undefined) {
      throw new Error(
        "transfer: out1RecipientCipherPayPubKey is required. " +
        "Do not pass recipientWalletPubKey/PrivKey to transfer."
      );
    }
    const out2CPK = toBig(src.out2RecipientCipherPayPubKey);

    const mkNote = (amount, cpk, rand, tokenId, memo) =>
      H(toBig(amount), toBig(cpk), toBig(rand), toBig(tokenId), toBig(memo));

    const outCommitment1 = mkNote(
      src.out1Amount, out1CPK, src.out1Randomness, src.out1TokenId, src.out1Memo
    );
    const outCommitment2 = mkNote(
      src.out2Amount, out2CPK, src.out2Randomness, src.out2TokenId, src.out2Memo
    );

    const encNote1Hash = H(outCommitment1, out1CPK);
    const encNote2Hash = H(outCommitment2, out2CPK);

    const nextLeafIndex = Number(src.nextLeafIndex ?? 1);
    const j1 = nextLeafIndex;
    const j2 = j1 + 1;

    const out1PathElements = derivePathSiblings(H, z, preLeaves, j1, DEPTH);
    const out2PathElements = derivePathSiblings(H, z, preLeaves, j2, DEPTH);

    const merkleRootBefore = computeRoot(H, inCommitment, inPathElements, inPathIndices);
    const newRoot1 = computeRoot(H, outCommitment1, out1PathElements, indicesFromIndex(j1, DEPTH));
    const newRoot2 = computeRoot(H, outCommitment2, out2PathElements, indicesFromIndex(j2, DEPTH));

    console.log("• (transfer) expected merkleRoot     =", merkleRootBefore.toString());
    console.log("• (transfer) expected newMerkleRoot1 =", newRoot1.toString());
    console.log("• (transfer) expected newMerkleRoot2 =", newRoot2.toString());
    console.log("• (transfer) expected newNextLeafIndex =", String(nextLeafIndex + 2));

    return {
      inAmount: dec(inAmount),
      inSenderWalletPubKey: dec(inPub),
      inSenderWalletPrivKey: dec(inPriv),
      inRandomness: dec(inRand),
      inTokenId: dec(inTokenId),
      inMemo: dec(inMemo),

      inPathElements: inPathElements.map(dec),
      inPathIndices,

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

      nextLeafIndex: String(nextLeafIndex),
      out1PathElements: out1PathElements.map(dec),
      out2PathElements: out2PathElements.map(dec),

      encNote1Hash: dec(encNote1Hash),
      encNote2Hash: dec(encNote2Hash),
    };
  }

  if (circuitName === "withdraw") {
    const DEPTH = Number(src.depth || process.env.CP_TREE_DEPTH || 16);

    // If explicit non-zero path was provided, use it; otherwise derive from BINs.
    const userElems = ensureArray(src.pathElements, DEPTH, "0");
    const userAllZero = isAllZeroish(userElems);

    let pathElements = userElems.map(String);
    let pathIndices = booleanize(src.pathIndices, DEPTH);
    let commitmentOverride = null;

    if (userAllZero || src.autoFromTransfer === true || src.autoFromTransfer === undefined) {
      const derived = await deriveWithdrawInputsFromTransfer(src, DEPTH);
      pathElements = derived.pathElements;
      pathIndices = derived.pathIndices;
      commitmentOverride = derived.commitment;
    }

    // final prepared input
    const { H: H2 } = await getPoseidonClassic();
    const rPub = toBig(src.recipientWalletPubKey);
    const rPriv = toBig(src.recipientWalletPrivKey);
    const amount = toBig(src.amount);
    const tokenId = toBig(src.tokenId);
    const randomness = toBig(src.randomness);
    const memo = toBig(src.memo);

    return {
      recipientWalletPrivKey: dec(rPriv),
      randomness: dec(randomness),
      memo: dec(memo),
      pathElements,
      pathIndices,
      recipientWalletPubKey: dec(rPub),
      amount: dec(amount),
      tokenId: dec(tokenId),
      commitment: commitmentOverride
        ? commitmentOverride
        : dec(H2(amount, H2(rPub, rPriv), randomness, tokenId, memo)),
    };
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

  fs.mkdirSync(buildPath, { recursive: true });
  fs.writeFileSync(path.join(buildPath, "proof.json"), JSON.stringify(proof, null, 2));
  fs.writeFileSync(path.join(buildPath, "public_signals.json"), JSON.stringify(publicSignals, null, 2));

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

  console.log(`Proof generated and saved to ${path.join(buildPath, "proof.json")}`);
  return { proof, publicSignals };
}

/* ---------------- example inputs ---------------- */
const exampleInputs = {
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
  },

  transfer: {
    inAmount: "100",
    inSenderWalletPubKey: "0",
    inSenderWalletPrivKey: "0",
    inRandomness: "0",
    inTokenId: "0",
    inMemo: "0",
    inIndex: "0",

    // out1 uses the recipient's CipherPay pubkey (Poseidon(pub,priv)), NOT the raw keys
    out1Amount: "60",
    out1RecipientCipherPayPubKey:
      "19671880629798928171529795066366940826437446602236033626838552573503527465966",
    out1Randomness:
      "4444444444444444444444444444444444444444444444444444444444444444",
    out1TokenId: "0",
    out1Memo: "0",

    // out2 stays as a CipherPay pubkey as before
    out2Amount: "40",
    out2RecipientCipherPayPubKey:
      "5555555555555555555555555555555555555555555555555555555555555555",
    out2Randomness:
      "7777777777777777777777777777777777777777777777777777777777777777",
    out2TokenId: "0",
    out2Memo: "0",

    nextLeafIndex: "1",
    out1PathElements: Array(16).fill("0"),
    out2PathElements: Array(16).fill("0"),
  },

  // Default withdraw spends out1 (auto-derives from BINs)
  withdraw: {
    spendWhich: 1, // 1 or 2
    recipientWalletPubKey:
      "1234567890123456789012345678901234567890123456789012345678901234",
    recipientWalletPrivKey:
      "1111111111111111111111111111111111111111111111111111111111111111",
    amount: "60",
    tokenId: "0",
    randomness:
      "4444444444444444444444444444444444444444444444444444444444444444",
    memo: "0",
    pathElements: Array(16).fill("0"),
    pathIndices: Array(16).fill(0),
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
        "    • Run deposit → transfer first so withdraw can auto-derive from BINs.\n" +
        "    • If you run circuits individually, ensure proofs/*.bin exist for source steps.\n"
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
