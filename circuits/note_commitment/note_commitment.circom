pragma circom 2.1.4;

include "circomlib/circuits/poseidon.circom";

/*
 * CipherPay Note Commitment family
 *
 * Base definition (kept identical to your original):
 *   commitment = Poseidon(amount, cipherPayPubKey, randomness, tokenId, memo)
 *
 * Variants:
 *  - NoteCommitmentTagged(tag):
 *      commitment = Poseidon(tag, amount, cipherPayPubKey, randomness, tokenId, memo)
 *    (adds a constant domain tag as the first input)
 *
 *  - NoteCommitmentFromWallet():
 *      cipherPayPubKey = Poseidon(walletPubKey, walletPrivKey)
 *      commitment      = Poseidon(amount, cipherPayPubKey, randomness, tokenId, memo)
 */

// -----------------------------------------------------------------------------
// 1) Backwards-compatible base component
// -----------------------------------------------------------------------------
template NoteCommitment() {
    // === Private inputs ===
    signal input amount;            // token amount
    signal input cipherPayPubKey;   // Poseidon(walletPubKey, walletPrivKey)
    signal input randomness;        // note randomness
    signal input tokenId;           // token type id
    signal input memo;              // optional memo

    // === Public output ===
    signal output commitment;

    // commitment = Poseidon( amount, cipherPayPubKey, randomness, tokenId, memo )
    component H = Poseidon(5);
    H.inputs[0] <== amount;
    H.inputs[1] <== cipherPayPubKey;
    H.inputs[2] <== randomness;
    H.inputs[3] <== tokenId;
    H.inputs[4] <== memo;

    commitment <== H.out;
}

// -----------------------------------------------------------------------------
// 2) Tagged variant (domain separation)
//    Use a small constant tag (e.g., 1 for deposit notes, 2 for transfer outputs, etc.)
// -----------------------------------------------------------------------------
template NoteCommitmentTagged(tag) {
    // === Private inputs ===
    signal input amount;
    signal input cipherPayPubKey;
    signal input randomness;
    signal input tokenId;
    signal input memo;

    // === Public output ===
    signal output commitment;

    // commitment = Poseidon( tag, amount, cipherPayPubKey, randomness, tokenId, memo )
    component H = Poseidon(6);
    H.inputs[0] <== tag;            // template parameter (constant at compile time)
    H.inputs[1] <== amount;
    H.inputs[2] <== cipherPayPubKey;
    H.inputs[3] <== randomness;
    H.inputs[4] <== tokenId;
    H.inputs[5] <== memo;

    commitment <== H.out;
}

// -----------------------------------------------------------------------------
// 3) Convenience variant: derive cipherPayPubKey from wallet keys inside
//    Useful when the caller has wallet keys and wants fewer moving parts.
// -----------------------------------------------------------------------------
template NoteCommitmentFromWallet() {
    // === Private inputs ===
    signal input amount;
    signal input walletPubKey;
    signal input walletPrivKey;
    signal input randomness;
    signal input tokenId;
    signal input memo;

    // === Public outputs ===
    signal output commitment;
    signal output derivedCipherPayPubKey;

    // derivedCipherPayPubKey = Poseidon(walletPubKey, walletPrivKey)
    component ID = Poseidon(2);
    ID.inputs[0] <== walletPubKey;
    ID.inputs[1] <== walletPrivKey;
    derivedCipherPayPubKey <== ID.out;

    // commitment = Poseidon(amount, derivedCipherPayPubKey, randomness, tokenId, memo)
    component H = Poseidon(5);
    H.inputs[0] <== amount;
    H.inputs[1] <== derivedCipherPayPubKey;
    H.inputs[2] <== randomness;
    H.inputs[3] <== tokenId;
    H.inputs[4] <== memo;

    commitment <== H.out;
}
