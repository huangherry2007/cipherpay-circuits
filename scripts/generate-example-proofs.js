#!/usr/bin/env node
/* eslint-disable no-console */

"use strict";

const fs = require("fs");
const path = require("path");
const { groth16 } = require("snarkjs");
const circomlib = require("circomlibjs");

/* ---------------- BN254 prime (for bounds/byte helpers) ----------------- */
const FQ =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/* ---------------- Robust base58 (decode) -------------------------------- */
let bs58decode;
try {
  const mod = require("bs58");
  const m = (mod && mod.decode) ? mod : (mod && mod.default) ? mod.default : mod;
  if (m && typeof m.decode === "function") bs58decode = m.decode;
} catch (_) {}
if (!bs58decode) {
  const ALPH = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const MAP = new Map([...ALPH].map((c, i) => [c, i]));
  bs58decode = function (s) {
    if (typeof s !== "string") throw new Error("base58 string required");
    let num = 0n;
    for (const ch of s) {
      const v = MAP.get(ch);
      if (v === undefined) throw new Error(`invalid base58 char '${ch}'`);
      num = num * 58n + BigInt(v);
    }
    const arr = [];
    while (num > 0n) { arr.push(Number(num & 0xffn)); num >>= 8n; }
    arr.reverse();
    let z = 0; for (const ch of s) { if (ch === "1") z++; else break; }
    const out = new Uint8Array(z + arr.length);
    out.set(arr, z);
    return out;
  };
}

/* ---------------- small io helpers ------------------------------------- */
function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }
function readJSON(file, fallback = null) { if (!fs.existsSync(file)) return fallback; return JSON.parse(fs.readFileSync(file, "utf8")); }
function writeJSON(file, obj) { ensureDir(path.dirname(file)); fs.writeFileSync(file, JSON.stringify(obj, null, 2)); }
function mustExist(file, hint) { if (!fs.existsSync(file)) throw new Error(`${hint} not found at ${file}. Please compile circuits first.`); }

/* ---------------- bigint helpers --------------------------------------- */
function toBig(x) { if (typeof x === "bigint") return x; if (typeof x === "number") return BigInt(x); if (typeof x === "string") return BigInt(x.trim()); throw new Error(`Cannot convert to BigInt: ${x}`); }
const bigToDec = (x) => x.toString(10);

/* ---------------- example inputs (your originals) ----------------------- */
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
    inAmount: "100",
    inSenderWalletPubKey: "0",
    inSenderWalletPrivKey: "0",
    inRandomness: "0",
    inTokenId: "0",
    inMemo: "0",

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
    // stays as base58 here; we convert to LO/HI limbs below
    recipientOwnerSol: "8VMCHPzwug9rYYudXkLNYTtAGN96ht4mXaqrxHrTijRg",
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

  // -------- Pipeline B --------
  deposit1: {
    ownerWalletPubKey: "0",
    ownerWalletPrivKey: "0",
    randomness: "1",
    tokenId: "0",
    memo: "0",
    inPathElements: Array(16).fill("0"),
    inPathIndices: Array(16).fill(0),
    nextLeafIndex: "3",
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
    recipientOwnerSol: "8VMCHPzwug9rYYudXkLNYTtAGN96ht4mXaqrxHrTijRg",
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

  // -------- Pipeline C --------
  deposit2: {
    ownerWalletPubKey: "0",
    ownerWalletPrivKey: "0",
    randomness: "2",
    tokenId: "0",
    memo: "0",
    inPathElements: Array(16).fill("0"),
    inPathIndices: Array(16).fill("0"),
    nextLeafIndex: "6",
    nonce: "2",
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
    recipientOwnerSol: "8VMCHPzwug9rYYudXkLNYTtAGN96ht4mXaqrxHrTijRg",
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

  // -------- Pipeline D --------
  deposit3: {
    ownerWalletPubKey: "0",
    ownerWalletPrivKey: "0",
    randomness: "3",
    tokenId: "0",
    memo: "0",
    inPathElements: Array(16).fill("0"),
    inPathIndices: Array(16).fill(0),
    nextLeafIndex: "9",
    nonce: "3",
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
    recipientOwnerSol: "8VMCHPzwug9rYYudXkLNYTtAGN96ht4mXaqrxHrTijRg",
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

/* ---------------- labels (publicSignals order) -------------------------- */
/* Transfer unchanged. Withdraw now has 7 items w/ LO/HI limbs */
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
  // withdraw publics (7):
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
const labelKey = (name) => (LABELS[name] ? name : name.replace(/\d+$/, ""));

/* ============================== Config ================================== */
const DEFAULT_DEPTH =
  Number(process.env.CP_TREE_DEPTH || process.env.TREE_DEPTH || 16);

const BUILD = path.resolve(__dirname, "../build");
const SUFFIXES = ["", "1", "2", "3"]; // A..D

const CIRCUITS = {};
for (const base of ["deposit", "transfer", "withdraw"]) {
  for (const sfx of SUFFIXES) {
    const name = base + sfx;
    CIRCUITS[name] = {
      wasm: path.join(BUILD, `${base}/${base}_js/${base}.wasm`),
      zkey: path.join(BUILD, `${base}/${base}_final.zkey`),
      outDir: path.join(BUILD, name),
      inputFile: path.join(BUILD, name, "input.json"),
    };
  }
}

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
  // UPDATED: accept limbs instead of single scalar
  withdraw: new Set([
    "recipientOwner_lo",
    "recipientOwner_hi",
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

/* ===================== Utilities (sanitizers etc.) ====================== */
const baseCircuit = (c) => c.replace(/\d+$/, "");
function sanitizeInputs(circuit, obj) {
  const allow = ALLOWED_INPUTS[baseCircuit(circuit)];
  const out = {};
  for (const k of Object.keys(obj || {})) if (allow.has(k)) out[k] = obj[k];
  return out;
}
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

/* -------- recipientOwner binding: to two 128-bit LE limbs --------------- */
function envRecipientOwnerAny() {
  // Prefer base58; allow 32-byte hex too (RECIPIENT_OWNER_SOL_HEX)
  return process.env.RECIPIENT_OWNER_SOL_B58 ||
         process.env.RECIPIENT_OWNER_SOL ||
         process.env.RECIPIENT_OWNER_SOL_HEX ||
         undefined;
}
/** split 32 bytes into two 16-byte little-endian limbs -> decimal strings */
function limbsLEFromBytes32(bytes32) {
  if (!(bytes32 instanceof Uint8Array) || bytes32.length !== 32) {
    throw new Error("recipient owner must be 32 bytes");
  }
  const leToBig = (bytes) => {
    let x = 0n;
    for (let i = 0; i < bytes.length; i++) x += BigInt(bytes[i]) << (8n * BigInt(i));
    return x;
  };
  const lo = leToBig(bytes32.slice(0, 16));
  const hi = leToBig(bytes32.slice(16, 32));
  // 2^128 < FQ so each limb fits; no need to mod F
  return { lo: lo.toString(10), hi: hi.toString(10) };
}
function toBytes32FromAny(ownerAny) {
  const s = String(ownerAny || "").trim();
  if (!s) throw new Error("recipient owner not provided (env or example JSON)");
  if (/^(0x)?[0-9a-fA-F]{64}$/.test(s)) {
    const h = s.startsWith("0x") ? s.slice(2) : s;
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  // otherwise assume base58
  const raw = bs58decode(s);
  if (raw.length !== 32) throw new Error("recipientOwner (base58) must decode to 32 bytes");
  return raw;
}
function withWithdrawDefaults(inp = {}) {
  const z = "0";
  const ownerAny = inp.recipientOwnerSol ?? envRecipientOwnerAny();
  const raw = toBytes32FromAny(ownerAny);
  const { lo, hi } = limbsLEFromBytes32(raw);
  console.log("• (withdraw) recipientOwner (base58/hex) provided");
  console.log("• (withdraw) limb lo =", lo);
  console.log("• (withdraw) limb hi =", hi);
  return {
    recipientOwner_lo:        lo,
    recipientOwner_hi:        hi,
    recipientWalletPubKey:    inp.recipientWalletPubKey   ?? z,
    recipientWalletPrivKey:   inp.recipientWalletPrivKey  ?? z,
    amount:                   inp.amount                  ?? z,
    tokenId:                  inp.tokenId                 ?? z,
    randomness:               inp.randomness              ?? z,
    memo:                     inp.memo                    ?? z,
  };
}

/* ---- defaults for deposit/transfer (unchanged) ------------------------- */
function withDepositDefaults(inp = {}) {
  return {
    ownerWalletPubKey:   inp.ownerWalletPubKey   ?? "0",
    ownerWalletPrivKey:  inp.ownerWalletPrivKey  ?? "0",
    randomness:          inp.randomness          ?? "0",
    tokenId:             inp.tokenId             ?? "0",
    memo:                inp.memo                ?? "0",
  };
}
function withTransferDefaults(inp = {}) {
  const z = "0";
  return {
    inAmount:                 inp.inAmount                 ?? z,
    inSenderWalletPubKey:     inp.inSenderWalletPubKey     ?? z,
    inSenderWalletPrivKey:    inp.inSenderWalletPrivKey    ?? z,
    inRandomness:             inp.inRandomness             ?? z,
    inTokenId:                inp.inTokenId                ?? z,
    inMemo:                   inp.inMemo                   ?? z,
    out1Amount:               inp.out1Amount               ?? z,
    out1RecipientCipherPayPubKey: inp.out1RecipientCipherPayPubKey ?? z,
    out1Randomness:           inp.out1Randomness           ?? z,
    out1TokenId:              inp.out1TokenId              ?? z,
    out1Memo:                 inp.out1Memo                 ?? z,
    out2Amount:               inp.out2Amount               ?? z,
    out2RecipientCipherPayPubKey: inp.out2RecipientCipherPayPubKey ?? z,
    out2Randomness:           inp.out2Randomness           ?? z,
    out2TokenId:              inp.out2TokenId              ?? z,
    out2Memo:                 inp.out2Memo                 ?? z,
  };
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

/* ===== recompute newRoot1/newRoot2 like patched Transfer circuit ======= */
function lsbBitsArray(n, len) { return lsbBits(n, len); }
function computeNewRootsForTransfer({
  poseidon, depth, nextLeafIndex,
  out1PathElements, out2PathElements,
  outCommitment1, outCommitment2,
}) {
  const P = poseidon, F = P.F;

  const bits1 = lsbBitsArray(nextLeafIndex, depth);
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

  const nextIdx1 = nextLeafIndex + 1;
  const bits2 = lsbBitsArray(nextIdx1, depth);

  const cur2 = new Array(depth + 1);
  cur2[0] = toBig(outCommitment2);

  const b1 = bits1[0] ? 1n : 0n;
  const t0 = toBig(out2PathElements[0]) - toBig(outCommitment1);
  const sib0 = toBig(outCommitment1) + b1 * t0;

  const b0_2 = bits2[0] ? 1n : 0n;
  const left0  = b0_2 ? sib0 : cur2[0];
  const right0 = b0_2 ? cur2[0] : sib0;
  cur2[1] = F.toObject(P([left0, right0]));

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

/* ========================= Circuit entry points ======================== */
function cfgFor(circuit) { return CIRCUITS[circuit]; }
function loadInputsOrExample(circuit) {
  const cfg = cfgFor(circuit);
  ensureDir(cfg.outDir);
  if (fs.existsSync(cfg.inputFile)) return readJSON(cfg.inputFile, {});
  // clone example to avoid mutation across runs
  return JSON.parse(JSON.stringify(exampleInputs[circuit] ?? exampleInputs[baseCircuit(circuit)] ?? {}));
}

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

/* ============================ Drivers ================================== */
async function runDeposit(poseidon, depth, sharedTree, variant = "deposit") {
  console.log(`Generating proof for ${variant} circuit...`);
  const cfg = cfgFor(variant);
  const P = poseidon;
  const inputsRaw = loadInputsOrExample(variant);
  const inputs = { ...withDepositDefaults(inputsRaw), ...inputsRaw };

  const tree = sharedTree ?? new PoseidonTree(depth, P);
  const oldRoot = tree.root();
  const nextIdx = tree.nextIndex;

  const pathElems = tree.insertionSiblings(nextIdx);
  const pathIdxs  = lsbBits(nextIdx, depth);

  const amount = inputs.amount ?? "0";
  const nonce  = inputs.nonce  ?? "0";

  const ownerCipherPayPubKey = poseidon2(P.F, P, inputs.ownerWalletPubKey, inputs.ownerWalletPrivKey);
  const depositHash          = poseidon3(P.F, P, ownerCipherPayPubKey, amount, nonce);

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
  const raw = loadInputsOrExample(variant);
  let inputs = { ...withTransferDefaults(raw), ...raw };
  const P = poseidon;

  const { siblings: inSiblings, indices: inIndices } = tree.path(depIdx);

  const nextIdx = tree.nextIndex;
  const out1Siblings = tree.insertionSiblings(nextIdx);
  const out2Siblings = tree.insertionSiblings(nextIdx + 1);

  const out1Commitment = poseidon5(
    P.F, P,
    inputs.out1Amount, inputs.out1RecipientCipherPayPubKey,
    inputs.out1Randomness, inputs.out1TokenId, inputs.out1Memo
  );
  const out2Commitment = poseidon5(
    P.F, P,
    inputs.out2Amount, inputs.out2RecipientCipherPayPubKey,
    inputs.out2Randomness, inputs.out2TokenId, inputs.out2Memo
  );
  const encNote1Hash = poseidon2(P.F, P, out1Commitment, inputs.out1RecipientCipherPayPubKey);
  const encNote2Hash = poseidon2(P.F, P, out2Commitment, inputs.out2RecipientCipherPayPubKey);

  inputs = overrideTransferInputs(inputs, {
    inSiblings, inIndices,
    nextLeafIndex: nextIdx,
    out1Siblings,
    out2Siblings,
    encNote1Hash,
    encNote2Hash,
  });
  inputs = sanitizeInputs(variant, inputs);

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

  const j1 = tree.append(out1);
  const j2 = tree.append(out2);

  console.log("• (transfer) newMerkleRoot1 (computed) =", compRoot1.toString(10));
  console.log("• (transfer) newMerkleRoot1 (pubs)     =", newRoot1.toString(10));
  console.log("• (transfer) newMerkleRoot2 (pre-state computed) =", compRoot2.toString(10));
  console.log("• (transfer) newMerkleRoot2 (MID)               =", tree.root().toString(10));
  console.log("• (transfer) newMerkleRoot2 (pubs)              =", newRoot2.toString(10));
  console.log("• (transfer) out1 index =", j1, "out2 index =", j2);

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
  const raw = loadInputsOrExample(variant);
  let inputs = withWithdrawDefaults(raw);

  const { siblings, indices } = tree.path(j2);

  console.log("• (withdraw) spending output: out2");
  console.log("• (withdraw) j2 (leaf index) =", j2);
  console.log("• (withdraw) pathIndices[0..8]  =", indices.slice(0, 9).join(", "), "…");
  console.log("• (withdraw) pathElements[0..4] =", siblings.slice(0, 5).map(bigToDec).join(", "), "…");

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

  inputs = overrideWithdrawPathInputs(inputs, { siblings, indices });
  inputs.commitment = bigToDec(out2Commitment);
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

/* ========== Rebuild tree from prior publics for single withdrawX ======= */
function ensurePublicsPresent(name) {
  const f = path.join(CIRCUITS[name].outDir, "public_signals.json");
  const j = readJSON(f);
  if (!j) throw new Error(`Missing ${f} — run 'all' first to generate pipeline outputs.`);
  return j;
}
function rebuildTreeUpToSuffix(depth, poseidon, maxSuffix = 0) {
  const tree = new PoseidonTree(depth, poseidon);
  let lastOut2 = null;
  let lastJ2 = -1;
  let lastNewRoot2 = null;

  for (let s = 0; s <= maxSuffix; s++) {
    const suf = s === 0 ? "" : String(s);
    const depPubs = ensurePublicsPresent("deposit" + suf);
    const xferPubs = ensurePublicsPresent("transfer" + suf);

    const depCommitment = getDepositCommitmentFromPublics(depPubs);
    const { out1, out2, newRoot2 } = getTransferOutputsFromPublics(xferPubs);

    tree.append(depCommitment);
    tree.append(out1);
    lastJ2 = tree.append(out2);
    lastOut2 = out2;
    lastNewRoot2 = newRoot2;
  }

  return { tree, j2: lastJ2, out2: lastOut2, newRoot2: lastNewRoot2 };
}

/* ============================== All / Single =========================== */
async function runAll(depth = DEFAULT_DEPTH) {
  console.log("Generating proofs for pipelines A–D: A(deposit->transfer->withdraw) then B, C, D on SAME tree...");
  const poseidon = await circomlib.buildPoseidon();
  const tree = new PoseidonTree(depth, poseidon);

  console.log("• (tree) genesis root =", tree.root().toString(10));

  for (const suf of SUFFIXES) {
    await runPipeline(poseidon, depth, tree, suf);
  }

  console.log("\n✅ Pipelines A–D completed.");
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

    if (/^deposit\d*$/.test(cmd)) {
      const tree = new PoseidonTree(depth, poseidon);
      await runDeposit(poseidon, depth, tree, cmd);
      console.log(`\n✅ ${cmd} completed (JSON written to build/${cmd}/)`);
      process.exit(0);
    }

    if (/^transfer\d*$/.test(cmd)) {
      const depName = cmd.replace(/^transfer/, "deposit");
      const depPubs = ensurePublicsPresent(depName);
      const depCommitment = getDepositCommitmentFromPublics(depPubs);
      const tree = new PoseidonTree(depth, poseidon);
      const depIdx = tree.append(depCommitment);
      await runTransfer(poseidon, depth, tree, depIdx, cmd);
      console.log(`\n✅ ${cmd} completed (JSON written to build/${cmd}/)`);
      process.exit(0);
    }

    if (/^withdraw\d*$/.test(cmd)) {
      const sfx = cmd.replace("withdraw", "");
      const maxSuffix = sfx === "" ? 0 : Number(sfx);
      const { tree, j2, out2, newRoot2 } = rebuildTreeUpToSuffix(depth, poseidon, maxSuffix);
      await runWithdraw_spendOut2(poseidon, depth, tree, j2, newRoot2, out2, cmd);
      console.log(`\n✅ ${cmd} completed (JSON written to build/${cmd}/)`);
      process.exit(0);
    }

    // Help
    console.log("Usage:");
    console.log("  node scripts/generate-example-proof.js all [--depth=16]");
    console.log("  node scripts/generate-example-proof.js deposit|transfer|withdraw");
    console.log("  node scripts/generate-example-proof.js deposit1|transfer1|withdraw1");
    console.log("  node scripts/generate-example-proof.js deposit2|transfer2|withdraw2");
    console.log("  node scripts/generate-example-proof.js deposit3|transfer3|withdraw3");
    console.log("\nEnv for withdraw recipient binding (base58 or 32-byte hex):");
    console.log("  RECIPIENT_OWNER_SOL_B58=<base58 pubkey>  # preferred");
    console.log("  or RECIPIENT_OWNER_SOL=<base58 pubkey>   # alias");
    console.log("  or RECIPIENT_OWNER_SOL_HEX=<64-hex-bytes>");
    process.exit(1);
  } catch (err) {
    console.error("❌ Proof generation failed:", err.message || err);
    console.error(
      "   Hints:\n" +
        "    • Ensure WASM/ZKEY exist under build/*/*_js and build/*/*_final.zkey.\n" +
        "    • Withdraw(out2) uses the FINAL tree path; we pass `commitment` privately.\n" +
        "    • Unknown keys are stripped to avoid `Signal not found`.\n" +
        "    • Provide recipient owner via RECIPIENT_OWNER_SOL_B58 (or HEX) or keep it in example JSON.\n"
    );
    if (process.env.DEBUG) console.error(err);
    process.exit(1);
  }
})();
