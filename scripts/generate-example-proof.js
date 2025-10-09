#!/usr/bin/env node
/* eslint-disable no-console */

// JSON-only proof generation for: deposit -> transfer -> withdraw(out2)
// and a second pipeline: deposit1 -> transfer1 -> withdraw1(out2)

const fs = require("fs");
const path = require("path");
const { groth16 } = require("snarkjs");
const circomlib = require("circomlibjs");

/* ---------------- example inputs ---------------- */
const exampleInputs = {
  // -------- Pipeline A --------
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
    // input (the deposit note)
    inAmount: "100",
    inSenderWalletPubKey: "0",
    inSenderWalletPrivKey: "0",
    inRandomness: "0",
    inTokenId: "0",
    inMemo: "0",

    // outputs (we later spend out2)
    out1Amount: "60",
    out1RecipientCipherPayPubKey:
      "5555555555555555555555555555555555555555555555555555555555555555",
    out1Randomness:
      "4444444444444444444444444444444444444444444444444444444444444444",
    out1TokenId: "0",
    out1Memo: "0",

    out2Amount: "40",
    out2RecipientCipherPayPubKey:
      "19671880629798928171529795066366940826437446602236033626838552573503527465966",
    out2Randomness:
      "7777777777777777777777777777777777777777777777777777777777777777",
    out2TokenId: "0",
    out2Memo: "0",
  },

  withdraw: {
    recipientWalletPubKey:
      "1234567890123456789012345678901234567890123456789012345678901234",
    recipientWalletPrivKey:
      "1111111111111111111111111111111111111111111111111111111111111111",
    amount: "40",
    tokenId: "0",
    randomness:
      "7777777777777777777777777777777777777777777777777777777777777777",
    memo: "0",
    pathElements: Array(16).fill("0"),
    pathIndices: Array(16).fill(0),
  },

  // -------- Pipeline B (second run on same tree) --------
  deposit1: {
    ownerWalletPubKey: "0",
    ownerWalletPrivKey: "0",
    randomness: "1",
    tokenId: "0",
    memo: "0",
    inPathElements: Array(16).fill("0"),
    inPathIndices: Array(16).fill(0),
    nextLeafIndex: "3", // FYI: we still overwrite with tree.nextIndex
    nonce: "1",
    amount: "200",
  },

  transfer1: {
    inAmount: "200",
    inSenderWalletPubKey: "0",
    inSenderWalletPrivKey: "0",
    inRandomness: "1",
    inTokenId: "0",
    inMemo: "0",

    out1Amount: "120",
    out1RecipientCipherPayPubKey:
      "5555555555555555555555555555555555555555555555555555555555555555",
    out1Randomness:
      "8888888888888888888888888888888888888888888888888888888888888888",
    out1TokenId: "0",
    out1Memo: "0",

    out2Amount: "80",
    out2RecipientCipherPayPubKey:
      "19671880629798928171529795066366940826437446602236033626838552573503527465966",
    out2Randomness:
      "9999999999999999999999999999999999999999999999999999999999999999",
    out2TokenId: "0",
    out2Memo: "0",
  },

  withdraw1: {
    recipientWalletPubKey:
      "1234567890123456789012345678901234567890123456789012345678901234",
    recipientWalletPrivKey:
      "1111111111111111111111111111111111111111111111111111111111111111",
    amount: "80",
    tokenId: "0",
    randomness:
      "9999999999999999999999999999999999999999999999999999999999999999",
    memo: "0",
    pathElements: Array(16).fill("0"),
    pathIndices: Array(16).fill(0),
  },
    // -------- Pipeline C (third run on same tree) --------
    deposit2: {
      ownerWalletPubKey: "0",
      ownerWalletPrivKey: "0",
      randomness: "2",
      tokenId: "0",
      memo: "0",
      inPathElements: Array(16).fill("0"),
      inPathIndices: Array(16).fill(0),
      nextLeafIndex: "3", // FYI: we still overwrite with tree.nextIndex
      nonce: "1",
      amount: "300",
    },
  
    transfer2: {
      inAmount: "300",
      inSenderWalletPubKey: "0",
      inSenderWalletPrivKey: "0",
      inRandomness: "2",
      inTokenId: "0",
      inMemo: "0",
  
      out1Amount: "180",
      out1RecipientCipherPayPubKey:
        "5555555555555555555555555555555555555555555555555555555555555555",
      out1Randomness:
        "0000000000000000000000000000000000000000000000000000000000000000",
      out1TokenId: "0",
      out1Memo: "0",
  
      out2Amount: "120",
      out2RecipientCipherPayPubKey:
        "19671880629798928171529795066366940826437446602236033626838552573503527465966",
      out2Randomness:
        "11111111111111111111111111111111111111111111111111111111111111111",
      out2TokenId: "0",
      out2Memo: "0",
    },
  
    withdraw2: {
      recipientWalletPubKey:
        "1234567890123456789012345678901234567890123456789012345678901234",
      recipientWalletPrivKey:
        "1111111111111111111111111111111111111111111111111111111111111111",
      amount: "120",
      tokenId: "0",
      randomness:
        "11111111111111111111111111111111111111111111111111111111111111111",
      memo: "0",
      pathElements: Array(16).fill("0"),
      pathIndices: Array(16).fill(0),
    },
        // -------- Pipeline D (fourth run on same tree) --------
        deposit3: {
          ownerWalletPubKey: "0",
          ownerWalletPrivKey: "0",
          randomness: "3",
          tokenId: "0",
          memo: "0",
          inPathElements: Array(16).fill("0"),
          inPathIndices: Array(16).fill(0),
          nextLeafIndex: "3", // FYI: we still overwrite with tree.nextIndex
          nonce: "1",
          amount: "400",
        },
      
        transfer3: {
          inAmount: "400",
          inSenderWalletPubKey: "0",
          inSenderWalletPrivKey: "0",
          inRandomness: "3",
          inTokenId: "0",
          inMemo: "0",
      
          out1Amount: "240",
          out1RecipientCipherPayPubKey:
            "5555555555555555555555555555555555555555555555555555555555555555",
          out1Randomness:
            "2222222222222222222222222222222222222222222222222222222222222222",
          out1TokenId: "0",
          out1Memo: "0",
      
          out2Amount: "160",
          out2RecipientCipherPayPubKey:
            "19671880629798928171529795066366940826437446602236033626838552573503527465966",
          out2Randomness:
            "33333333333333333333333333333333333333333333333333333333333333333",
          out2TokenId: "0",
          out2Memo: "0",
        },
      
        withdraw3: {
          recipientWalletPubKey:
            "1234567890123456789012345678901234567890123456789012345678901234",
          recipientWalletPrivKey:
            "1111111111111111111111111111111111111111111111111111111111111111",
          amount: "160",
          tokenId: "0",
          randomness:
            "33333333333333333333333333333333333333333333333333333333333333333",
          memo: "0",
          pathElements: Array(16).fill("0"),
          pathIndices: Array(16).fill(0),
        },
};

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

// treat "deposit1" / "transfer1" / "withdraw1" like their base labels
const labelKey = (name) => (LABELS[name] ? name : name.replace(/\d+$/, ""));

/* ============================== Config ================================== */
const DEFAULT_DEPTH =
  Number(process.env.CP_TREE_DEPTH || process.env.TREE_DEPTH || 16);

const BUILD = path.resolve(__dirname, "../build");

// Reuse the same wasm/zkey but write to separate subdirs for *1 variants
const CIRCUITS = {};
for (const base of ["deposit", "transfer", "withdraw"]) {
  // base paths
  CIRCUITS[base] = {
    wasm: path.join(BUILD, `${base}/${base}_js/${base}.wasm`),
    zkey: path.join(BUILD, `${base}/${base}_final.zkey`),
    outDir: path.join(BUILD, base),
    inputFile: path.join(BUILD, base, "input.json"),
  };
  // *1 variant paths
  CIRCUITS[base + "1"] = {
    wasm: CIRCUITS[base].wasm,
    zkey: CIRCUITS[base].zkey,
    outDir: path.join(BUILD, base + "1"),
    inputFile: path.join(BUILD, base + "1", "input.json"),
  };
}

// parse indices from LABELS
const IDX = {
  deposit: { COMMITMENT: LABELS.deposit.indexOf("newCommitment") },
  transfer: {
    OUT1: LABELS.transfer.indexOf("outCommitment1"),
    OUT2: LABELS.transfer.indexOf("outCommitment2"),
    NEW_ROOT1: LABELS.transfer.indexOf("newMerkleRoot1"),
    NEW_ROOT2: LABELS.transfer.indexOf("newMerkleRoot2"),
    NEXT_LEAF_INDEX: LABELS.transfer.indexOf("newNextLeafIndex"),
  },
};

/* ================== Whitelist the inputs per circuit ==================== */
const ALLOWED_INPUTS = {
  deposit: new Set([
    "ownerWalletPubKey",
    "ownerWalletPrivKey",
    "randomness",
    "tokenId",
    "memo",
    "inPathElements",
    "inPathIndices",
    "nextLeafIndex",
    "nonce",
    "amount",
    "depositHash",
    "oldMerkleRoot",
  ]),
  transfer: new Set([
    "inAmount",
    "inSenderWalletPubKey",
    "inSenderWalletPrivKey",
    "inRandomness",
    "inTokenId",
    "inMemo",
    "inPathElements",
    "inPathIndices",
    "nextLeafIndex",
    "out1PathElements",
    "out2PathElements",
    "out1Amount",
    "out1RecipientCipherPayPubKey",
    "out1Randomness",
    "out1TokenId",
    "out1Memo",
    "out2Amount",
    "out2RecipientCipherPayPubKey",
    "out2Randomness",
    "out2TokenId",
    "out2Memo",
    "encNote1Hash",
    "encNote2Hash",
  ]),
  withdraw: new Set([
    "recipientWalletPubKey",
    "recipientWalletPrivKey",
    "amount",
    "tokenId",
    "randomness",
    "memo",
    "pathElements",
    "pathIndices",
    "commitment",
  ]),
};

const baseCircuit = (c) => c.replace(/\d+$/, "");
function sanitizeInputs(circuit, obj) {
  const allow = ALLOWED_INPUTS[baseCircuit(circuit)];
  const out = {};
  for (const k of Object.keys(obj || {})) if (allow.has(k)) out[k] = obj[k];
  return out;
}

/* ============================== IO Helpers ============================== */
function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }
function readJSON(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function writeJSON(file, obj) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}
function mustExist(file, hint) {
  if (!fs.existsSync(file)) throw new Error(`${hint} not found at ${file}. Please compile circuits first.`);
}

/* ========================= BigInt & field utils ======================== */
function toBig(x) {
  if (typeof x === "bigint") return x;
  if (typeof x === "number") return BigInt(x);
  if (typeof x === "string") return BigInt(x.trim());
  throw new Error(`Cannot convert to BigInt: ${x}`);
}
const bigToDec = (x) => x.toString(10);
function lsbBits(n, len) {
  const out = new Array(len);
  for (let i = 0; i < len; i++) out[i] = (n >> i) & 1 ? 1 : 0;
  return out;
}
function poseidon2(F, P, a, b) {
  return F.toObject(P([toBig(a), toBig(b)]));
}
function poseidon3(F, P, a, b, c) {
  return F.toObject(P([toBig(a), toBig(b), toBig(c)]));
}
function poseidon5(F, P, a, b, c, d, e) {
  return F.toObject(P([toBig(a), toBig(b), toBig(c), toBig(d), toBig(e)]));
}

/* ======================= Poseidon Merkle Tree ========================== */
class PoseidonTree {
  constructor(depth, poseidon) {
    this.depth = depth;
    this.poseidon = poseidon;
    this.F = poseidon.F;
    this.zeros = [0n];
    for (let i = 1; i <= depth; i++) {
      this.zeros[i] = this.hash2(this.zeros[i - 1], this.zeros[i - 1]);
    }
    this.levels = Array.from({ length: depth + 1 }, (_, level) => {
      const width = level === 0 ? 0 : 2 ** (depth - level);
      return Array(width).fill(this.zeros[level]);
    });
    this.nextIndex = 0;
  }
  hash2(a, b) { return this.F.toObject(this.poseidon([toBig(a), toBig(b)])); }
  root() { return (this.levels[this.depth]?.[0]) ?? this.zeros[this.depth]; }
  append(leafBig) {
    if (this.nextIndex >= 2 ** this.depth) throw new Error("Merkle tree full");
    if (!this.levels[0]) this.levels[0] = [];
    this.levels[0][this.nextIndex] = toBig(leafBig);
    let idx = this.nextIndex;
    for (let lvl = 1; lvl <= this.depth; lvl++) {
      const parent = Math.floor(idx / 2);
      const left  = this.levels[lvl - 1][parent * 2] ?? this.zeros[lvl - 1];
      const right = this.levels[lvl - 1][parent * 2 + 1] ?? this.zeros[lvl - 1];
      this.levels[lvl][parent] = this.hash2(left, right);
      idx = parent;
    }
    return this.nextIndex++;
  }
  path(index) {
    if (index >= this.nextIndex) throw new Error("Path for unfilled index");
    const siblings = [], indices = [];
    let idx = index;
    for (let lvl = 0; lvl < this.depth; lvl++) {
      const sibIdx = idx ^ 1;
      siblings.push(this.levels[lvl][sibIdx] ?? this.zeros[lvl]);
      indices.push(idx & 1 ? 1 : 0);
      idx >>= 1;
    }
    return { siblings, indices };
  }
  insertionSiblings(index) {
    const siblings = [];
    let idx = index;
    for (let lvl = 0; lvl < this.depth; lvl++) {
      const sibIdx = idx ^ 1;
      siblings.push(this.levels[lvl][sibIdx] ?? this.zeros[lvl]);
      idx >>= 1;
    }
    return siblings;
  }
  static computeRootFromPath(poseidon, leaf, siblings, indices) {
    const P = poseidon, F = P.F;
    let cur = toBig(leaf);
    for (let lvl = 0; lvl < indices.length; lvl++) {
      const b = indices[lvl] ? 1n : 0n;
      const sib = toBig(siblings[lvl]);
      const left  = b ? sib : cur;
      const right = b ? cur : sib;
      cur = F.toObject(P([left, right]));
    }
    return cur;
  }
}

/* ========================= Circuit entry points ======================== */
async function fullProveToJson(wasm, zkey, inputs, outDir, friendlyName) {
  mustExist(wasm, `${friendlyName} WASM`);
  mustExist(zkey, `${friendlyName} ZKEY`);
  const { proof, publicSignals } = await groth16.fullProve(inputs, wasm, zkey);
  writeJSON(path.join(outDir, "proof.json"), proof);
  writeJSON(path.join(outDir, "public_signals.json"), publicSignals);
  const labels = LABELS[labelKey(friendlyName)];
  if (Array.isArray(labels)) {
    const labeled = {};
    for (let i = 0; i < Math.min(labels.length, publicSignals.length); i++) {
      labeled[labels[i]] = publicSignals[i];
    }
    writeJSON(path.join(outDir, "public_signals_labeled.json"), labeled);
  }
  return { proof, publicSignals };
}

function getDepositCommitmentFromPublics(publicSignals) {
  return toBig(publicSignals[IDX.deposit.COMMITMENT]);
}
function getTransferOutputsFromPublics(publicSignals) {
  return {
    out1: toBig(publicSignals[IDX.transfer.OUT1]),
    out2: toBig(publicSignals[IDX.transfer.OUT2]),
    newRoot1: toBig(publicSignals[IDX.transfer.NEW_ROOT1]),
    newRoot2: toBig(publicSignals[IDX.transfer.NEW_ROOT2]),
    nextLeafIndex: Number(publicSignals[IDX.transfer.NEXT_LEAF_INDEX]),
  };
}

/* ===================== Input preparation (overrides) =================== */
function overrideTransferInputs(input, {
  inSiblings, inIndices, nextLeafIndex, out1Siblings, out2Siblings,
  encNote1Hash, encNote2Hash,
}) {
  return {
    ...input,
    inPathElements: inSiblings.map(bigToDec),
    inPathIndices: inIndices.map(Number),
    nextLeafIndex: String(nextLeafIndex),
    out1PathElements: out1Siblings.map(bigToDec),
    out2PathElements: out2Siblings.map(bigToDec),
    encNote1Hash: bigToDec(encNote1Hash),
    encNote2Hash: bigToDec(encNote2Hash),
  };
}

function overrideWithdrawPathInputs(input, { siblings, indices }) {
  const out = { ...input };
  out.pathElements = siblings.map(bigToDec);
  out.pathIndices  = indices.map(Number);
  return out;
}

/* ===== recompute newRoot1/newRoot2 exactly like the (patched) circuit ==== */
function computeNewRootsForTransfer({
  poseidon, depth, nextLeafIndex,
  out1PathElements, out2PathElements,
  outCommitment1, outCommitment2,
}) {
  const P = poseidon, F = P.F;

  // Step 7: insertion #1 (out1) using out1PathElements at index = nextLeafIndex
  const bits1 = lsbBits(nextLeafIndex, depth);
  const cur1 = new Array(depth + 1);
  cur1[0] = toBig(outCommitment1);

  for (let j = 0; j < depth; j++) {
    const sib = toBig(out1PathElements[j]);
    const b = bits1[j] ? 1n : 0n;
    const left  = b ? sib : cur1[j];
    const right = b ? cur1[j] : sib;
    cur1[j + 1] = F.toObject(P([left, right]));
  }
  const newRoot1 = cur1[depth];

  // Step 8: insertion #2 (out2) at index = nextLeafIndex + 1
  const nextIdx1 = nextLeafIndex + 1;
  const bits2 = lsbBits(nextIdx1, depth);

  const cur2 = new Array(depth + 1);
  cur2[0] = toBig(outCommitment2);

  // Level 0 sibling selection per circuit:
  const b1 = bits1[0] ? 1n : 0n;
  const t0 = toBig(out2PathElements[0]) - toBig(outCommitment1);
  const sib0 = toBig(outCommitment1) + b1 * t0;

  const b0_2 = bits2[0] ? 1n : 0n;
  const left0  = b0_2 ? sib0 : cur2[0];
  const right0 = b0_2 ? cur2[0] : sib0;
  cur2[1] = F.toObject(P([left0, right0]));

  // Levels 1..depth-1 : use updated nodes from cur1[k] as siblings
  for (let k = 1; k < depth; k++) {
    const sibk = cur1[k];
    const b = bits2[k] ? 1n : 0n;
    const left  = b ? sibk : cur2[k];
    const right = b ? cur2[k] : sibk;
    cur2[k + 1] = F.toObject(P([left, right]));
  }
  const newRoot2 = cur2[depth];
  return { newRoot1, newRoot2, midSiblings: [sib0, ...cur1.slice(1, depth)] };
}

/* ============================ Drivers ================================== */
function cfgFor(circuit) { return CIRCUITS[circuit]; }

function loadInputsOrExample(circuit) {
  const cfg = cfgFor(circuit);
  ensureDir(cfg.outDir);
  if (fs.existsSync(cfg.inputFile)) return readJSON(cfg.inputFile, {});
  return JSON.parse(JSON.stringify(exampleInputs[circuit] || {}));
}

async function runDeposit(poseidon, depth, sharedTree, variant = "deposit") {
  console.log(`Generating proof for ${variant} circuit...`);
  const cfg = cfgFor(variant);
  const P = poseidon, F = P.F;
  const inputs = loadInputsOrExample(variant);
  const tree = sharedTree ?? new PoseidonTree(depth, P);

  const oldRoot = tree.root();
  const nextIdx = tree.nextIndex;

  const pathElems = tree.insertionSiblings(nextIdx);  // pre-insertion siblings for nextLeafIndex
  const pathIdxs  = lsbBits(nextIdx, depth);          // bits of nextLeafIndex (LSB-first)


  const ownerWalletPubKey  = inputs.ownerWalletPubKey  ?? "0";
  const ownerWalletPrivKey = inputs.ownerWalletPrivKey ?? "0";
  const amount             = inputs.amount             ?? "0";
  const nonce              = inputs.nonce              ?? "0";

  const ownerCipherPayPubKey = poseidon2(F, P, ownerWalletPubKey, ownerWalletPrivKey);
  const depositHash          = poseidon3(F, P, ownerCipherPayPubKey, amount, nonce);

  const filled = sanitizeInputs(variant, {
    ...inputs,
    amount: String(amount),
    nonce: String(nonce),
    oldMerkleRoot: oldRoot.toString(10),
    nextLeafIndex: String(nextIdx),
    inPathElements: pathElems.map((x) => x.toString(10)),
    inPathIndices: pathIdxs.map(Number),
    depositHash: depositHash.toString(10),
  });

  const { publicSignals } = await fullProveToJson(
    cfg.wasm, cfg.zkey, filled, cfg.outDir, variant
  );
  const depCommitment = getDepositCommitmentFromPublics(publicSignals);
  return { depCommitment };
}

async function runTransfer(poseidon, depth, tree, depIdx, variant = "transfer") {
  console.log(`Generating proof for ${variant} circuit...`);
  const cfg = cfgFor(variant);
  let inputs = loadInputsOrExample(variant);
  const P = poseidon, F = P.F;

  // Input membership (deposit commitment)
  const { siblings: inSiblings, indices: inIndices } = tree.path(depIdx);

  // Next insertion positions for out1/out2 on the current tree
  const nextIdx = tree.nextIndex;
  const out1Siblings = tree.insertionSiblings(nextIdx);
  const out2Siblings = tree.insertionSiblings(nextIdx + 1);

  // Compute out1/out2 commitments so we can supply encNote{1,2}Hash
  const out1Commitment = poseidon5(
    F, P,
    inputs.out1Amount, inputs.out1RecipientCipherPayPubKey,
    inputs.out1Randomness, inputs.out1TokenId, inputs.out1Memo
  );
  const out2Commitment = poseidon5(
    F, P,
    inputs.out2Amount, inputs.out2RecipientCipherPayPubKey,
    inputs.out2Randomness, inputs.out2TokenId, inputs.out2Memo
  );
  const encNote1Hash = poseidon2(F, P, out1Commitment, inputs.out1RecipientCipherPayPubKey);
  const encNote2Hash = poseidon2(F, P, out2Commitment, inputs.out2RecipientCipherPayPubKey);

  inputs = overrideTransferInputs(inputs, {
    inSiblings, inIndices,
    nextLeafIndex: nextIdx,
    out1Siblings,
    out2Siblings,
    encNote1Hash,
    encNote2Hash,
  });
  inputs = sanitizeInputs(variant, inputs);

  // Pre-compute roots exactly like the circuit (to cross-check pubs)
  const { newRoot1: compRoot1, newRoot2: compRoot2 } = computeNewRootsForTransfer({
    poseidon, depth,
    nextLeafIndex: nextIdx,
    out1PathElements: out1Siblings,
    out2PathElements: out2Siblings,
    outCommitment1: out1Commitment,
    outCommitment2: out2Commitment,
  });

  const { publicSignals } = await fullProveToJson(
    cfg.wasm, cfg.zkey, inputs, cfg.outDir, variant
  );

  const { out1, out2, newRoot1, newRoot2 } = getTransferOutputsFromPublics(publicSignals);

  // Append to actual tree to get FINAL root (after out2)
  const j1 = tree.append(out1);
  const j2 = tree.append(out2);

  console.log("• (transfer) newMerkleRoot1 (computed) =", compRoot1.toString(10));
  console.log("• (transfer) newMerkleRoot1 (pubs)     =", newRoot1.toString(10));
  console.log("• (transfer) newMerkleRoot2 (pre-state computed) =", compRoot2.toString(10));
  console.log("• (transfer) newMerkleRoot2 (MID)               =", tree.root().toString(10));
  console.log("• (transfer) newMerkleRoot2 (pubs)              =", newRoot2.toString(10));
  console.log("• (transfer) out1 index =", j1, "out2 index =", j2);

  // Persist out2 path snapshot (from FINAL tree)
  const mid = tree.path(j2);
  writeJSON(path.join(cfg.outDir, "out2_paths.json"), {
    pre_siblings_dec: out2Siblings.map(bigToDec),
    final_siblings_dec: mid.siblings.map(bigToDec),
  });

  return { out1, out2, j1, j2, newRoot1, newRoot2 };
}

async function runWithdraw_spendOut2(poseidon, depth, tree, j2, newRoot2FromTransfer, out2Commitment, variant = "withdraw") {
  console.log(`Generating proof for ${variant} circuit...`);
  const cfg = cfgFor(variant);
  let inputs = loadInputsOrExample(variant);

  // Path for out2 ON THE FINAL TREE (after out2 insertion)
  const { siblings, indices } = tree.path(j2);

  console.log("• (withdraw) spending output: out2");
  console.log("• (withdraw) j2 (leaf index) =", j2);
  console.log("• (withdraw) pathIndices[0..8]  =", indices.slice(0, 9).join(", "), "…");
  console.log("• (withdraw) pathElements[0..4] =", siblings.slice(0, 5).map(bigToDec).join(", "), "…");

  // Cross-check root from path equals transfer.newMerkleRoot2
  const rootFromPath = PoseidonTree.computeRootFromPath(poseidon, out2Commitment, siblings, indices);
  console.log("• (withdraw) merkleRoot (used)  =", rootFromPath.toString(10));
  console.log("• (transfer) newMerkleRoot2     =", newRoot2FromTransfer.toString(10));

  writeJSON(path.join(cfg.outDir, "path_used.json"), {
    j2,
    path_indices: indices,
    path_elements_dec: siblings.map(bigToDec),
    commitment_dec: bigToDec(out2Commitment),
    merkle_root_from_path_dec: bigToDec(rootFromPath),
    transfer_newMerkleRoot2_dec: bigToDec(newRoot2FromTransfer),
  });

  if (rootFromPath !== newRoot2FromTransfer) {
    throw new Error("withdraw: merkle root != transfer.newMerkleRoot2");
  }

  // Prepare witness inputs
  inputs = overrideWithdrawPathInputs(inputs, { siblings, indices });
  inputs.commitment = bigToDec(out2Commitment); // circuit expects private 'commitment'
  inputs = sanitizeInputs(variant, inputs);

  await fullProveToJson(cfg.wasm, cfg.zkey, inputs, cfg.outDir, variant);
}

/* ============================== Pipelines =============================== */
async function runPipeline(poseidon, depth, tree, suffix = "") {
  const depName = "deposit" + suffix;
  const xferName = "transfer" + suffix;
  const wdName = "withdraw" + suffix;

  const { depCommitment } = await runDeposit(poseidon, depth, tree, depName);
  const depIdx = tree.append(depCommitment);
  console.log(`• (${depName}) commitment index =`, depIdx);
  console.log(`• (${depName}) new root         =`, tree.root().toString(10));

  const { out2, j2, newRoot2 } = await runTransfer(poseidon, depth, tree, depIdx, xferName);
  await runWithdraw_spendOut2(poseidon, depth, tree, j2, newRoot2, out2, wdName);
}

/* ============================== All / Single =========================== */
async function runAll(depth = DEFAULT_DEPTH) {
  console.log("Generating proof for pipeline A (deposit -> transfer -> withdraw(out2)) and pipeline B (deposit1 -> transfer1 -> withdraw1) ...");
  const poseidon = await circomlib.buildPoseidon();
  const tree = new PoseidonTree(depth, poseidon);

  console.log("• (tree) genesis root =", tree.root().toString(10));

  // Pipeline A: indexes 0,1,2
  await runPipeline(poseidon, depth, tree, "");

  // Pipeline B: continues on same tree; deposit1 at index 3, then out1 at 4, out2 at 5
  await runPipeline(poseidon, depth, tree, "1");

  console.log("\n✅ Pipelines completed: A (out2 @ 2) and B (out2 @ 5)");
}

async function rebuildTreeForWithdraw1(depth, poseidon) {
  // Rebuild leaves in order: dep0 -> out1_0 -> out2_0 -> dep1 -> out1_1 -> out2_1
  const dep0 = readJSON(path.join(CIRCUITS.deposit.outDir, "public_signals.json"));
  const xfer0 = readJSON(path.join(CIRCUITS.transfer.outDir, "public_signals.json"));
  const dep1 = readJSON(path.join(CIRCUITS.deposit1.outDir, "public_signals.json"));
  const xfer1 = readJSON(path.join(CIRCUITS.transfer1.outDir, "public_signals.json"));
  if (!dep0 || !xfer0 || !dep1 || !xfer1) {
    throw new Error("Missing earlier publics. Run `all` first to build pipeline A and B.");
  }
  const tree = new PoseidonTree(depth, poseidon);
  const depCommitment0 = getDepositCommitmentFromPublics(dep0);
  const { out1: out1_0, out2: out2_0 } = getTransferOutputsFromPublics(xfer0);
  const depCommitment1 = getDepositCommitmentFromPublics(dep1);
  const { out1: out1_1, out2: out2_1, newRoot2 } = getTransferOutputsFromPublics(xfer1);

  tree.append(depCommitment0);
  tree.append(out1_0);
  const j2_0 = tree.append(out2_0);
  tree.append(depCommitment1);
  tree.append(out1_1);
  const j2_1 = tree.append(out2_1);

  return { tree, j2_0, j2_1, out2_1, newRoot2 };
}

/* ================================= CLI ================================= */
(async function main() {
  const cmd = (process.argv[2] || "").trim().toLowerCase();
  const depthArg = process.argv.find((a) => a.startsWith("--depth="));
  const depth = depthArg ? Number(depthArg.split("=")[1]) : DEFAULT_DEPTH;

  try {
    if (cmd === "all" || cmd === "pipeline") {
      await runAll(depth);
      process.exit(0);
    }

    const poseidon = await circomlib.buildPoseidon();

    if (cmd === "deposit" || cmd === "deposit1") {
      const tree = new PoseidonTree(depth, poseidon);
      // If running deposit1 alone, this will still build it at index 0 in a fresh tree.
      await runDeposit(poseidon, depth, tree, cmd);
      console.log(`\n✅ ${cmd} completed (JSON written to build/${cmd}/)`);
      process.exit(0);
    }

    if (cmd === "transfer" || cmd === "transfer1") {
      // Rebuild minimal tree state expected by that transfer
      const depKey = cmd === "transfer1" ? "deposit1" : "deposit";
      const depPubs = readJSON(path.join(CIRCUITS[depKey].outDir, "public_signals.json"));
      if (!depPubs) throw new Error(`Missing build/${depKey}/public_signals.json — run 'all' first.`);
      const depCommitment = getDepositCommitmentFromPublics(depPubs);
      const tree = new PoseidonTree(depth, poseidon);
      const depIdx = tree.append(depCommitment);
      await runTransfer(poseidon, depth, tree, depIdx, cmd);
      console.log(`\n✅ ${cmd} completed (JSON written to build/${cmd}/)`);
      process.exit(0);
    }

    if (cmd === "withdraw") {
      // Rebuild tree from pipeline A
      const depPubs = readJSON(path.join(CIRCUITS.deposit.outDir, "public_signals.json"));
      const xferPubs = readJSON(path.join(CIRCUITS.transfer.outDir, "public_signals.json"));
      if (!depPubs || !xferPubs) throw new Error("Missing transfer/deposit publics — run 'all' first.");
      const depCommitment = getDepositCommitmentFromPublics(depPubs);
      const { out1, out2, newRoot2, nextLeafIndex } = getTransferOutputsFromPublics(xferPubs);
      const tree = new PoseidonTree(depth, poseidon);
      tree.append(depCommitment);
      tree.append(out1);
      const j2 = tree.append(out2);
      console.log("• (rebuild A) out2 index =", j2, "(pubs newNextLeafIndex =", nextLeafIndex, ")");
      await runWithdraw_spendOut2(poseidon, depth, tree, j2, newRoot2, out2, "withdraw");
      console.log("\n✅ withdraw completed (JSON written to build/withdraw/)");
      process.exit(0);
    }

    if (cmd === "withdraw1") {
      // Rebuild tree from pipelines A and B
      const { tree, j2_1, out2_1, newRoot2 } = await rebuildTreeForWithdraw1(depth, poseidon);
      await runWithdraw_spendOut2(poseidon, depth, tree, j2_1, newRoot2, out2_1, "withdraw1");
      console.log("\n✅ withdraw1 completed (JSON written to build/withdraw1/)");
      process.exit(0);
    }

    // Help
    console.log("Usage:");
    console.log("  node scripts/generate-example-proof.js all [--depth=16]");
    console.log("  node scripts/generate-example-proof.js deposit|transfer|withdraw");
    console.log("  node scripts/generate-example-proof.js deposit1|transfer1|withdraw1");
    process.exit(1);
  } catch (err) {
    console.error("❌ Proof generation failed:", err.message || err);
    console.error(
      "   Hints:\n" +
        "    • Ensure WASM/ZKEY exist under build/*/*_js and build/*/*_final.zkey.\n" +
        "    • Withdraw(out2) uses the FINAL tree path; we pass 'commitment' privately.\n" +
        "    • We strip unknown keys to avoid `Signal not found`.\n" +
        "    • LABELS are reused for *1 variants via name-stripping.\n"
    );
    if (process.env.DEBUG) console.error(err);
    process.exit(1);
  }
})();
