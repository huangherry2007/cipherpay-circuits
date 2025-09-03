pragma circom 2.1.4;

include "circomlib/circuits/poseidon.circom";

/*
 * CipherPay Nullifier family
 *
 * Base (kept compatible with your existing circuits):
 *   ownerCPPK = Poseidon(ownerWalletPubKey, ownerWalletPrivKey)
 *   nullifier = Poseidon(ownerCPPK, randomness, tokenId)
 *
 * Variants:
 *  - NullifierFromCipherKey():
 *      nullifier = Poseidon(cipherPayPubKey, randomness, tokenId)
 *
 *  - NullifierTagged(tag):
 *      ownerCPPK = Poseidon(ownerWalletPubKey, ownerWalletPrivKey)
 *      nullifier = Poseidon(tag, ownerCPPK, randomness, tokenId)
 *    (compile-time tag for domain separation; prevents cross-protocol reuse)
 *
 *  - NullifierFromCipherKeyTagged(tag):
 *      nullifier = Poseidon(tag, cipherPayPubKey, randomness, tokenId)
 *
 * Notes:
 *  - Changing the nullifier formula (e.g., adding a tag) is a breaking change
 *    for previously created notes. Do it at a clear version boundary.
 */

// -----------------------------------------------------------------------------
// 1) Backward-compatible base component
// -----------------------------------------------------------------------------
template Nullifier() {
    // === Private inputs ===
    signal input ownerWalletPubKey;     // L1 public key
    signal input ownerWalletPrivKey;    // L1 private key
    signal input randomness;            // same as in commitment
    signal input tokenId;               // same as in commitment

    // === Public output ===
    signal output nullifier;

    // ownerCPPK = Poseidon(pub, priv)
    component ID = Poseidon(2);
    ID.inputs[0] <== ownerWalletPubKey;
    ID.inputs[1] <== ownerWalletPrivKey;

    // nullifier = Poseidon(ownerCPPK, randomness, tokenId)
    component H = Poseidon(3);
    H.inputs[0] <== ID.out;
    H.inputs[1] <== randomness;
    H.inputs[2] <== tokenId;

    nullifier <== H.out;
}

// -----------------------------------------------------------------------------
// 2) If caller already computed cipherPayPubKey off-circuit/in a parent
// -----------------------------------------------------------------------------
template NullifierFromCipherKey() {
    // === Private inputs ===
    signal input cipherPayPubKey;       // Poseidon(walletPubKey, walletPrivKey)
    signal input randomness;
    signal input tokenId;

    // === Public output ===
    signal output nullifier;

    component H = Poseidon(3);
    H.inputs[0] <== cipherPayPubKey;
    H.inputs[1] <== randomness;
    H.inputs[2] <== tokenId;

    nullifier <== H.out;
}

// -----------------------------------------------------------------------------
// 3) Tagged (domain-separated) variants
//    Choose a small constant tag per circuit, e.g.:
//      1 = withdraw, 2 = transfer, 3 = deposit-refund, etc.
// -----------------------------------------------------------------------------
template NullifierTagged(tag) {
    // === Private inputs ===
    signal input ownerWalletPubKey;
    signal input ownerWalletPrivKey;
    signal input randomness;
    signal input tokenId;

    // === Public output ===
    signal output nullifier;

    component ID = Poseidon(2);
    ID.inputs[0] <== ownerWalletPubKey;
    ID.inputs[1] <== ownerWalletPrivKey;

    component H = Poseidon(4);
    H.inputs[0] <== tag;         // compile-time constant
    H.inputs[1] <== ID.out;
    H.inputs[2] <== randomness;
    H.inputs[3] <== tokenId;

    nullifier <== H.out;
}

template NullifierFromCipherKeyTagged(tag) {
    // === Private inputs ===
    signal input cipherPayPubKey;
    signal input randomness;
    signal input tokenId;

    // === Public output ===
    signal output nullifier;

    component H = Poseidon(4);
    H.inputs[0] <== tag;         // compile-time constant
    H.inputs[1] <== cipherPayPubKey;
    H.inputs[2] <== randomness;
    H.inputs[3] <== tokenId;

    nullifier <== H.out;
}
