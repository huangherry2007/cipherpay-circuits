pragma circom 2.1.4;

include "circomlib/circuits/poseidon.circom";

// CipherPay Nullifier Component
// Generates nullifiers using ownerCipherPayPubKey for cryptographic binding
// Nullifier = Poseidon(ownerCipherPayPubKey, randomness, tokenId)
// Where ownerCipherPayPubKey = Poseidon(ownerWalletPubKey, ownerWalletPrivKey)

template Nullifier() {
    // === Private Inputs === 
    signal input ownerWalletPubKey;     // Public key from MetaMask or Phantom
    signal input ownerWalletPrivKey;    // Matching private key (kept secret)
    signal input randomness;                // Same randomness used in commitment
    signal input tokenId;                   // Same tokenId used in commitment
    
    // === Public Output === 
    signal output nullifier;
    
    // === Owner Ownership Binding === 
    // Compute ownerCipherPayPubKey for cryptographic binding
    component ownerCipherPayPubKey = Poseidon(2);
    ownerCipherPayPubKey.inputs[0] <== ownerWalletPubKey;
    ownerCipherPayPubKey.inputs[1] <== ownerWalletPrivKey;
    
    // === Nullifier Generation === 
    // Generate nullifier using ownerCipherPayPubKey
    component nullifierHash = Poseidon(3);
    nullifierHash.inputs[0] <== ownerCipherPayPubKey.out;
    nullifierHash.inputs[1] <== randomness;
    nullifierHash.inputs[2] <== tokenId;
    
    nullifier <== nullifierHash.out;
}