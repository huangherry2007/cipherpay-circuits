#!/usr/bin/env node
/* eslint-disable no-console */

// JSON-only proof generation for: deposit -> transfer -> withdraw(out2)

const fs = require("fs");
const path = require("path");
const { groth16 } = require("snarkjs");
const circomlib = require("circomlibjs");

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
    // depositHash & oldMerkleRoot auto-filled
  },

  transfer: {
    // input (the deposit note)
    inAmount: "100",
    inSenderWalletPubKey: "0",
    inSenderWalletPrivKey: "0",
    inRandomness: "0",
    inTokenId: "0",
    inMemo: "0",
    // inPathElements/Indices auto-filled from tree
    // nextLeafIndex/out1PathElements/out2PathElements auto-filled

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

    // encNote1Hash/encNote2Hash auto-filled (public inputs)
  },

  // Withdraw spends OUT2
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
    // commitment auto-filled = out2 commitment
  },
};

/* ---------------- labels (publicSignals order) ---------------- */
// Transfer outputs are public by default in Circom 2; then we add two public inputs.
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

/* ============================== Config ================================== */
const DEFAULT_DEPTH =
  Number(process.env.CP_TREE_DEPTH || process.env.TREE_DEPTH || 16);

const BUILD = path.resolve(__dirname, "../build");
const CIRCUITS = {
  deposit: {
    wasm: path.join(BUILD, "deposit/deposit_js/deposit.wasm"),
    zkey: path.join(BUILD, "deposit/deposit_final.zkey"),
    outDir: path.join(BUILD, "deposit"),
    inputFile: path.join(BUILD, "deposit/input.json"),
  },
  transfer: {
    wasm: path.join(BUILD, "transfer/transfer_js/transfer.wasm"),
    zkey: path.join(BUILD, "transfer/transfer_final.zkey"),
    outDir: path.join(BUILD, "transfer"),
    inputFile: path.join(BUILD, "transfer/input.json"),
  },
  withdraw: {
    wasm: path.join(BUILD, "withdraw/withdraw_js/withdraw.wasm"),
    zkey: path.join(BUILD, "withdraw/withdraw_final.zkey"),
    outDir: path.join(BUILD, "withdraw"),
    inputFile: path.join(BUILD, "withdraw/input.json"),
  },
};

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
    // input note preimage
    "inAmount",
    "inSenderWalletPubKey",
    "inSenderWalletPrivKey",
    "inRandomness",
    "inTokenId",
    "inMemo",
    // membership path for the input note
    "inPathElements",
    "inPathIndices",
    // insertion for two outputs
    "nextLeafIndex",
    "out1PathElements",
    "out2PathElements",
    // outputs (note preimages)
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
    // public inputs
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
    "commitment", // ✅ required by circuit
  ]),
};

function sanitizeInputs(circuit, obj) {
  const allow = ALLOWED_INPUTS[circuit];
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
  const labels = LABELS[friendlyName];
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

/* ===== recompute newRoot1/newRoot2 exactly like the transfer circuit ==== */
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

  // Step 8: insertion #2 (out2) at index = nextLeafIndex + 1 (use updated left-subtree)
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
    const sibk = cur1[k]; // post-out1 node on opposite side
    const b = bits2[k] ? 1n : 0n;
    const left  = b ? sibk : cur2[k];
    const right = b ? cur2[k] : sibk;
    cur2[k + 1] = F.toObject(P([left, right]));
  }
  const newRoot2 = cur2[depth];
  return { newRoot1, newRoot2, midSiblings: [sib0, ...cur1.slice(1, depth)] };
}

/* ============================ Drivers ================================== */
function loadInputsOrExample(circuit) {
  const cfg = CIRCUITS[circuit];
  ensureDir(cfg.outDir);
  if (fs.existsSync(cfg.inputFile)) return readJSON(cfg.inputFile, {});
  return JSON.parse(JSON.stringify(exampleInputs[circuit] || {}));
}

async function runDeposit(poseidon, depth, sharedTree) {
  console.log("Generating proof for deposit circuit...");
  const cfg = CIRCUITS.deposit;
  const P = poseidon, F = P.F;
  const inputs = loadInputsOrExample("deposit");
  const tree = sharedTree ?? new PoseidonTree(depth, P);

  const oldRoot = tree.root();
  const nextIdx = tree.nextIndex;
  const pathElems = Array.from({ length: depth }, (_, i) => tree.zeros[i]);
  const pathIdxs  = lsbBits(nextIdx, depth);

  const ownerWalletPubKey  = inputs.ownerWalletPubKey  ?? "0";
  const ownerWalletPrivKey = inputs.ownerWalletPrivKey ?? "0";
  const amount             = inputs.amount             ?? "0";
  const nonce              = inputs.nonce              ?? "0";

  const ownerCipherPayPubKey = poseidon2(F, P, ownerWalletPubKey, ownerWalletPrivKey);
  const depositHash          = poseidon3(F, P, ownerCipherPayPubKey, amount, nonce);

  const filled = sanitizeInputs("deposit", {
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
    cfg.wasm, cfg.zkey, filled, cfg.outDir, "deposit"
  );
  const depCommitment = getDepositCommitmentFromPublics(publicSignals);
  return { depCommitment };
}

async function runTransfer(poseidon, depth, tree, depIdx) {
  console.log("Generating proof for transfer circuit...");
  const cfg = CIRCUITS.transfer;
  let inputs = loadInputsOrExample("transfer");
  const P = poseidon, F = P.F;

  // Input membership (deposit commitment)
  const { siblings: inSiblings, indices: inIndices } = tree.path(depIdx);

  // Next insertion positions for out1/out2 on the current tree
  const nextIdx = tree.nextIndex;
  const out1Siblings = tree.insertionSiblings(nextIdx);
  const out2Siblings = tree.insertionSiblings(nextIdx + 1);

  // Compute out1/out2 commitments so we can supply encNote{1,2}Hash (public inputs)
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
  inputs = sanitizeInputs("transfer", inputs);

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
    cfg.wasm, cfg.zkey, inputs, cfg.outDir, "transfer"
  );

  const { out1, out2, newRoot1, newRoot2, nextLeafIndex } = getTransferOutputsFromPublics(publicSignals);

  // Append to actual tree to get FINAL root (after out2)
  const j1 = tree.append(out1);
  const j2 = tree.append(out2);

  console.log("• (transfer) newMerkleRoot1 (computed) =", compRoot1.toString(10));
  console.log("• (transfer) newMerkleRoot1 (pubs)     =", newRoot1.toString(10));
  console.log("• (transfer) newMerkleRoot2 (pre-state computed) =", compRoot2.toString(10));
  console.log("• (transfer) newMerkleRoot2 (MID)               =", tree.root().toString(10)); // after out2 append, this is final (== pubs)
  console.log("• (transfer) newMerkleRoot2 (pubs)              =", newRoot2.toString(10));
  console.log("• (transfer) out1 index =", j1, "out2 index =", j2);

  // Persist the exact out2 path variants we expect withdraw to use
  const pre = { siblings: out2Siblings.map(bigToDec) }; // pre-out1
  const mid = { // after out1 inserted
    siblings: (() => {
      const { siblings } = tree.path(j2); // this is FINAL tree; reconstruct mid L0.. with logic below
      // But we also dump what withdraw will actually use (computed below in runWithdraw)
      return siblings.map(bigToDec);
    })(),
  };
  writeJSON(path.join(cfg.outDir, "out2_paths.json"), {
    pre_siblings_dec: pre.siblings,
    // mid/fin will be logged from withdraw step
  });

  return { out1, out2, j1, j2, newRoot1, newRoot2 };
}

async function runWithdraw_spendOut2(poseidon, depth, tree, j2, newRoot2FromTransfer, out2Commitment) {
  console.log("Generating proof for withdraw circuit...");
  const cfg = CIRCUITS.withdraw;
  let inputs = loadInputsOrExample("withdraw");

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
  inputs.commitment = bigToDec(out2Commitment); // ✅ circuit expects private 'commitment'
  inputs = sanitizeInputs("withdraw", inputs);

  await fullProveToJson(cfg.wasm, cfg.zkey, inputs, cfg.outDir, "withdraw");
}

/* ============================== Pipeline =============================== */
async function runAll(depth = DEFAULT_DEPTH) {
  console.log("Generating proof for pipeline: deposit -> transfer -> withdraw(out2) ...");
  const poseidon = await circomlib.buildPoseidon();
  const tree = new PoseidonTree(depth, poseidon);

  console.log("• (tree) genesis root =", tree.root().toString(10));

  const { depCommitment } = await runDeposit(poseidon, depth, tree);
  const depIdx = tree.append(depCommitment);
  console.log("• (deposit) commitment index =", depIdx);
  console.log("• (deposit) new root         =", tree.root().toString(10));

  const { out2, j2, newRoot2 } = await runTransfer(poseidon, depth, tree, depIdx);

  await runWithdraw_spendOut2(poseidon, depth, tree, j2, newRoot2, out2);

  console.log("\n✅ Pipeline completed: deposit → transfer → withdraw(out2)");
}

/* ============================== Single-step ============================ */
async function runSingle(circuit, depth = DEFAULT_DEPTH) {
  const poseidon = await circomlib.buildPoseidon();

  if (circuit === "deposit") {
    await runDeposit(poseidon, depth, undefined);
    console.log("\n✅ Deposit completed (JSON written to build/deposit/)");
    return;
  }

  if (circuit === "transfer") {
    const depPubs = readJSON(path.join(CIRCUITS.deposit.outDir, "public_signals.json"));
    if (!depPubs) throw new Error("Missing build/deposit/public_signals.json — run deposit or pipeline first.");
    const depCommitment = getDepositCommitmentFromPublics(depPubs);
    const tree = new PoseidonTree(depth, poseidon);
    const depIdx = tree.append(depCommitment);
    await runTransfer(poseidon, depth, tree, depIdx);
    console.log("\n✅ Transfer completed (JSON written to build/transfer/)");
    return;
  }

  if (circuit === "withdraw") {
    const xferPubs = readJSON(path.join(CIRCUITS.transfer.outDir, "public_signals.json"));
    const depPubs  = readJSON(path.join(CIRCUITS.deposit.outDir, "public_signals.json"));
    if (!xferPubs || !depPubs) throw new Error("Missing transfer/deposit publics — run pipeline (`all`) first.");
    const depCommitment = getDepositCommitmentFromPublics(depPubs);
    const { out1, out2, newRoot2, nextLeafIndex } = getTransferOutputsFromPublics(xferPubs);

    const tree = new PoseidonTree(depth, poseidon);
    const depIdx = tree.append(depCommitment);
    const j1 = tree.append(out1);
    const j2 = tree.append(out2);
    console.log("• (rebuild) out1 index =", j1, "(pubs next_leaf_index =", nextLeafIndex, ")");
    console.log("• (rebuild) tree root after out2 =", tree.root().toString(10));

    await runWithdraw_spendOut2(poseidon, depth, tree, j2, newRoot2, out2);
    console.log("\n✅ Withdraw completed (JSON written to build/withdraw/)");
    return;
  }

  throw new Error(`Unknown circuit: ${circuit}`);
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
    if (!cmd) {
      console.log("Usage:");
      console.log("  node scripts/generate-example-proof.js all [--depth=16]");
      console.log("  node scripts/generate-example-proof.js deposit");
      console.log("  node scripts/generate-example-proof.js transfer");
      console.log("  node scripts/generate-example-proof.js withdraw");
      process.exit(1);
    }
    await runSingle(cmd, depth);
    process.exit(0);
  } catch (err) {
    console.error("❌ Proof generation failed:", err.message || err);
    console.error(
      "   Hints:\n" +
        "    • Ensure WASM/ZKEY exist under build/*/*_js and build/*/*_final.zkey.\n" +
        "    • Withdraw(out2) uses the FINAL tree path; we pass 'commitment' privately.\n" +
        "    • We strip unknown keys to avoid `Signal not found`.\n" +
        "    • LABELS drives public-signal parsing — keep it synced with your Circom.\n"
    );
    if (process.env.DEBUG) console.error(err);
    process.exit(1);
  }
})();
