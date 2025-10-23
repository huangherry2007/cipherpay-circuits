// scripts/recipient-owner.js
"use strict";

/**
 * Utilities to convert a Solana pubkey (base58 / hex / bytes) into two
 * 128-bit little-endian limbs suitable for Circom public inputs:
 *
 *   recipientOwner_lo, recipientOwner_hi  (decimal strings)
 *
 * The on-chain program can reconstruct the Pubkey as:
 *   [lo(16 bytes LE) | hi(16 bytes LE)]  => 32 bytes
 */

function ensureUint8Array(x) {
  if (x instanceof Uint8Array) return x;
  if (Array.isArray(x)) return new Uint8Array(x);
  throw new Error("bytes must be Uint8Array or number[]");
}

function bs58decodeMaybe() {
  try {
    const mod = require("bs58");
    if (mod && typeof mod.decode === "function") return mod.decode;
    if (mod && mod.default && typeof mod.default.decode === "function") return mod.default.decode;
  } catch (_) {}
  throw new Error("bs58 is required to decode base58 public keys. npm i bs58");
}

function decodeBase58To32(b58) {
  const decode = bs58decodeMaybe();
  const raw = decode(String(b58).trim());
  if (!(raw instanceof Uint8Array) || raw.length !== 32) {
    throw new Error("base58 pubkey must decode to 32 bytes");
  }
  return raw;
}

function decodeHexTo32(hex) {
  const s = String(hex).trim();
  const h = s.startsWith("0x") ? s.slice(2) : s;
  if (!/^[0-9a-fA-F]{64}$/.test(h)) {
    throw new Error("hex pubkey must be 32 bytes (64 hex chars)");
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Little-endian bytes -> BigInt */
function leBytesToBig(bytes) {
  let x = 0n;
  for (let i = 0; i < bytes.length; i++) {
    x += BigInt(bytes[i]) << (8n * BigInt(i));
  }
  return x;
}

/** Two 16-byte LE limbs from a 32-byte pubkey (Uint8Array) */
function limbsFromBytes32(bytes32) {
  const b = ensureUint8Array(bytes32);
  if (b.length !== 32) throw new Error("bytes32 must be 32 bytes");
  const lo = leBytesToBig(b.slice(0, 16));
  const hi = leBytesToBig(b.slice(16, 32));
  return { lo, hi };
}

/** From base58 pubkey */
function limbsFromBase58(b58) {
  const raw = decodeBase58To32(b58);
  return limbsFromBytes32(raw);
}

/** From hex (32 bytes) pubkey */
function limbsFromHex32(hex) {
  const raw = decodeHexTo32(hex);
  return limbsFromBytes32(raw);
}

/**
 * Flexible: accept base58 (preferred), hex(64), or a 32-byte Uint8Array.
 * Returns decimal strings { lo, hi } for Circom JSON inputs.
 */
function toLimbsFromAny(input) {
  if (input == null || input === "") {
    throw new Error("recipientOwner input is empty");
  }
  let limbs;
  if (typeof input === "string") {
    const s = input.trim();
    if (/^[1-9A-HJ-NP-Za-km-z]+$/.test(s)) {
      // base58
      limbs = limbsFromBase58(s);
    } else if (/^(0x)?[0-9a-fA-F]{64}$/.test(s)) {
      // hex
      limbs = limbsFromHex32(s);
    } else {
      throw new Error("recipientOwner must be base58 or 32-byte hex");
    }
  } else if (input instanceof Uint8Array || Array.isArray(input)) {
    limbs = limbsFromBytes32(input);
  } else {
    throw new Error("Unsupported recipientOwner input type");
  }
  return { lo: limbs.lo.toString(10), hi: limbs.hi.toString(10) };
}

/** Optional: reconstruct 32 bytes back from limbs for testing/debug */
function limbsToBytes32(loDec, hiDec) {
  const lo = BigInt(loDec);
  const hi = BigInt(hiDec);
  const out = new Uint8Array(32);
  for (let i = 0; i < 16; i++) out[i] = Number((lo >> (8n * BigInt(i))) & 0xffn);
  for (let i = 0; i < 16; i++) out[16 + i] = Number((hi >> (8n * BigInt(i))) & 0xffn);
  return out;
}

/** Convenience: mutate an inputs object to include the two limbs */
function injectRecipientOwnerLimbs(inputs, ownerAny) {
  const { lo, hi } = toLimbsFromAny(ownerAny);
  inputs.recipientOwner_lo = lo;
  inputs.recipientOwner_hi = hi;
  return inputs;
}

module.exports = {
  toLimbsFromAny,
  limbsFromBase58,
  limbsFromHex32,
  limbsFromBytes32,
  limbsToBytes32,
  injectRecipientOwnerLimbs,
};
