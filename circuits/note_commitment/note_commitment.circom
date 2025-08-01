pragma circom 2.1.4;

include "circomlib/circuits/poseidon.circom";

// CipherPay Note Commitment Component
// Computes a note commitment using:
// Poseidon(amount, cipherPayPubKey, randomness, tokenId, memo)
// Where cipherPayPubKey = Poseidon(walletPubKey, walletPrivKey)

template NoteCommitment() {
    // === Private Inputs === 
    signal input amount;                      // Token amount
    signal input cipherPayPubKey;             // Poseidon(pubKey, privKey)
    signal input randomness;                  // Random nonce (from sender)
    signal input tokenId;                     // Token type (e.g., SOL, ETH, USDC)
    signal input memo;                        // Optional user-defined field
    
    // === Public Output === 
    signal output commitment;
    
    // === Component === 
    component hasher = Poseidon(5);
    
    hasher.inputs[0] <== amount;
    hasher.inputs[1] <== cipherPayPubKey;
    hasher.inputs[2] <== randomness;
    hasher.inputs[3] <== tokenId;
    hasher.inputs[4] <== memo;
    
    commitment <== hasher.out;
}