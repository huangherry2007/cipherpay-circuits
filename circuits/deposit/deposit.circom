pragma circom 2.1.4;

include "circomlib/circuits/poseidon.circom";
include "../note_commitment/note_commitment.circom";

// CipherPay Deposit Circuit
// Implements deposits with wallet-bound identity
// Uses recipientCipherPayPubKey for cryptographic binding and privacy
template Deposit() {
    // === Private inputs (note preimage) === 
    signal input ownerWalletPubKey;        // Owner's L1 wallet public key (e.g. MetaMask or Phantom)
    signal input ownerWalletPrivKey;       // Owner's private key (proves ownership)
    signal input randomness;               // Randomness for note commitment
    signal input tokenId;                  // Token type identifier
    signal input memo;                     // Optional memo field
    
    // === Public inputs === 
    signal input nonce;                    // Unique per-deposit to prevent hash collisions
    signal input amount;                   // Publicly visible deposit amount
    signal input depositHash;              // Poseidon(ownerCipherPayPubKey, amount, nonce), must match on-chain event
    
    // === Public outputs === 
    signal output newCommitment;           // Shielded note commitment
    signal output ownerCipherPayPubKey;    // Derived CipherPay identity
    
    // === Step 1: Derive CipherPay owner pubkey === 
    component id = Poseidon(2);
    id.inputs[0] <== ownerWalletPubKey;
    id.inputs[1] <== ownerWalletPrivKey;
    ownerCipherPayPubKey <== id.out;
    
    // === Step 2: Generate note commitment === 
    component noteCommit = NoteCommitment();
    noteCommit.amount <== amount;
    noteCommit.cipherPayPubKey <== ownerCipherPayPubKey;
    noteCommit.randomness <== randomness;
    noteCommit.tokenId <== tokenId;
    noteCommit.memo <== memo;
    newCommitment <== noteCommit.commitment;
    
    // === Step 3: Validate deposit hash === 
    // Use ownerCipherPayPubKey for privacy-enhanced deposit hash binding
    component hash = Poseidon(3);
    hash.inputs[0] <== ownerCipherPayPubKey;
    hash.inputs[1] <== amount;
    hash.inputs[2] <== nonce;
    hash.out === depositHash;
}

component main { public [amount, depositHash] } = Deposit();