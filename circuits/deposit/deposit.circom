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
    
    signal input inPathElements[16];
    signal input inPathIndices[16];

    // === Public inputs === 
    signal input nonce;                    // Unique per-deposit to prevent hash collisions
    signal input amount;                   // Publicly visible deposit amount
    signal input depositHash;              // Poseidon(ownerCipherPayPubKey, amount, nonce), must match on-chain event
    signal input nextLeafIndex;            // Next leaf index in the Merkle tree
    
    // === Public outputs === 
    signal output newCommitment;           // Shielded note commitment
    signal output ownerCipherPayPubKey;    // Derived CipherPay identity
    signal output merkleRoot;
    
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
    
    // === Step 3: Merkle Path Verification === 
    // Use a simpler approach without reassigningsignal s
    component merkleHasher0 = Poseidon(2);
    component merkleHasher1 = Poseidon(2);
    component merkleHasher2 = Poseidon(2);
    component merkleHasher3 = Poseidon(2);
    component merkleHasher4 = Poseidon(2);
    component merkleHasher5 = Poseidon(2);
    component merkleHasher6 = Poseidon(2);
    component merkleHasher7 = Poseidon(2);
    component merkleHasher8 = Poseidon(2);
    component merkleHasher9 = Poseidon(2);
    component merkleHasher10 = Poseidon(2);
    component merkleHasher11 = Poseidon(2);
    component merkleHasher12 = Poseidon(2);
    component merkleHasher13 = Poseidon(2);
    component merkleHasher14 = Poseidon(2);
    component merkleHasher15 = Poseidon(2);
    
    // Level 0
    var left0 = inPathIndices[0] * (inPathElements[0] - newCommitment) + newCommitment;
    var right0 = inPathIndices[0] * (newCommitment - inPathElements[0]) + inPathElements[0];
    merkleHasher0.inputs[0] <== left0;
    merkleHasher0.inputs[1] <== right0;
    
    // Level 1
    var left1 = inPathIndices[1] * (inPathElements[1] - merkleHasher0.out) + merkleHasher0.out;
    var right1 = inPathIndices[1] * (merkleHasher0.out - inPathElements[1]) + inPathElements[1];
    merkleHasher1.inputs[0] <== left1;
    merkleHasher1.inputs[1] <== right1;
    
    // Level 2
    var left2 = inPathIndices[2] * (inPathElements[2] - merkleHasher1.out) + merkleHasher1.out;
    var right2 = inPathIndices[2] * (merkleHasher1.out - inPathElements[2]) + inPathElements[2];
    merkleHasher2.inputs[0] <== left2;
    merkleHasher2.inputs[1] <== right2;
    
    // Level 3
    var left3 = inPathIndices[3] * (inPathElements[3] - merkleHasher2.out) + merkleHasher2.out;
    var right3 = inPathIndices[3] * (merkleHasher2.out - inPathElements[3]) + inPathElements[3];
    merkleHasher3.inputs[0] <== left3;
    merkleHasher3.inputs[1] <== right3;
    
    // Level 4
    var left4 = inPathIndices[4] * (inPathElements[4] - merkleHasher3.out) + merkleHasher3.out;
    var right4 = inPathIndices[4] * (merkleHasher3.out - inPathElements[4]) + inPathElements[4];
    merkleHasher4.inputs[0] <== left4;
    merkleHasher4.inputs[1] <== right4;
    
    // Level 5
    var left5 = inPathIndices[5] * (inPathElements[5] - merkleHasher4.out) + merkleHasher4.out;
    var right5 = inPathIndices[5] * (merkleHasher4.out - inPathElements[5]) + inPathElements[5];
    merkleHasher5.inputs[0] <== left5;
    merkleHasher5.inputs[1] <== right5;
    
    // Level 6
    var left6 = inPathIndices[6] * (inPathElements[6] - merkleHasher5.out) + merkleHasher5.out;
    var right6 = inPathIndices[6] * (merkleHasher5.out - inPathElements[6]) + inPathElements[6];
    merkleHasher6.inputs[0] <== left6;
    merkleHasher6.inputs[1] <== right6;
    
    // Level 7
    var left7 = inPathIndices[7] * (inPathElements[7] - merkleHasher6.out) + merkleHasher6.out;
    var right7 = inPathIndices[7] * (merkleHasher6.out - inPathElements[7]) + inPathElements[7];
    merkleHasher7.inputs[0] <== left7;
    merkleHasher7.inputs[1] <== right7;
    
    // Level 8
    var left8 = inPathIndices[8] * (inPathElements[8] - merkleHasher7.out) + merkleHasher7.out;
    var right8 = inPathIndices[8] * (merkleHasher7.out - inPathElements[8]) + inPathElements[8];
    merkleHasher8.inputs[0] <== left8;
    merkleHasher8.inputs[1] <== right8;
    
    // Level 9
    var left9 = inPathIndices[9] * (inPathElements[9] - merkleHasher8.out) + merkleHasher8.out;
    var right9 = inPathIndices[9] * (merkleHasher8.out - inPathElements[9]) + inPathElements[9];
    merkleHasher9.inputs[0] <== left9;
    merkleHasher9.inputs[1] <== right9;
    
    // Level 10
    var left10 = inPathIndices[10] * (inPathElements[10] - merkleHasher9.out) + merkleHasher9.out;
    var right10 = inPathIndices[10] * (merkleHasher9.out - inPathElements[10]) + inPathElements[10];
    merkleHasher10.inputs[0] <== left10;
    merkleHasher10.inputs[1] <== right10;
    
    // Level 11
    var left11 = inPathIndices[11] * (inPathElements[11] - merkleHasher10.out) + merkleHasher10.out;
    var right11 = inPathIndices[11] * (merkleHasher10.out - inPathElements[11]) + inPathElements[11];
    merkleHasher11.inputs[0] <== left11;
    merkleHasher11.inputs[1] <== right11;
    
    // Level 12
    var left12 = inPathIndices[12] * (inPathElements[12] - merkleHasher11.out) + merkleHasher11.out;
    var right12 = inPathIndices[12] * (merkleHasher11.out - inPathElements[12]) + inPathElements[12];
    merkleHasher12.inputs[0] <== left12;
    merkleHasher12.inputs[1] <== right12;
    
    // Level 13
    var left13 = inPathIndices[13] * (inPathElements[13] - merkleHasher12.out) + merkleHasher12.out;
    var right13 = inPathIndices[13] * (merkleHasher12.out - inPathElements[13]) + inPathElements[13];
    merkleHasher13.inputs[0] <== left13;
    merkleHasher13.inputs[1] <== right13;
    
    // Level 14
    var left14 = inPathIndices[14] * (inPathElements[14] - merkleHasher13.out) + merkleHasher13.out;
    var right14 = inPathIndices[14] * (merkleHasher13.out - inPathElements[14]) + inPathElements[14];
    merkleHasher14.inputs[0] <== left14;
    merkleHasher14.inputs[1] <== right14;
    
    // Level 15
    var left15 = inPathIndices[15] * (inPathElements[15] - merkleHasher14.out) + merkleHasher14.out;
    var right15 = inPathIndices[15] * (merkleHasher14.out - inPathElements[15]) + inPathElements[15];
    merkleHasher15.inputs[0] <== left15;
    merkleHasher15.inputs[1] <== right15;
    
    merkleRoot <== merkleHasher15.out;

    // === Step 4: Validate deposit hash === 
    // Use ownerCipherPayPubKey for privacy-enhanced deposit hash binding
    component hash = Poseidon(3);
    hash.inputs[0] <== ownerCipherPayPubKey;
    hash.inputs[1] <== amount;
    hash.inputs[2] <== nonce;
    hash.out === depositHash;
}

component main {
    public [amount, depositHash, nextLeafIndex]
} = Deposit();