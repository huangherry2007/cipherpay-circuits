pragma circom 2.1.4;

include "circomlib/circuits/poseidon.circom";
include "../nullifier/nullifier.circom";
include "../note_commitment/note_commitment.circom";

// CipherPay Withdraw Circuit
// Converts shielded note into public transfer with wallet-bound identity
template Withdraw() {
    // === Private inputs === 
    signal input recipientWalletPrivKey;      // Recipient's private wallet key
    signal input randomness;                  // Randomness of note
    signal input memo;                        // Optional memo
    signal input pathElements[16];            // Merkle auth path
    signal input pathIndices[16];             // Merkle path selectors
    
    // === Public inputs === 
    signal input recipientWalletPubKey;       // Recipient wallet public key
    signal input amount;                      // Amount in the note
    signal input tokenId;                     // Token ID
    signal input commitment;                  // Commitment (used to check Merkle inclusion)
    
    // === Public outputs === 
    signal output nullifier;                  // Nullifier to prevent reuse
    signal output merkleRoot;                 // Merkle root of commitment tree
    
    // === Step 1: Reconstruct recipient identity === 
    component idHasher = Poseidon(2);
    idHasher.inputs[0] <== recipientWalletPubKey;
    idHasher.inputs[1] <== recipientWalletPrivKey;
    signal recipientCipherPayPubKey <== idHasher.out;
    
    // === Step 2: Reconstruct and validate note commitment === 
    component noteHasher = NoteCommitment();
    noteHasher.amount <== amount;
    noteHasher.cipherPayPubKey <== recipientCipherPayPubKey;
    noteHasher.randomness <== randomness;
    noteHasher.tokenId <== tokenId;
    noteHasher.memo <== memo;
    
    // Verify commitment matches
    noteHasher.commitment === commitment;
    
    // === Step 3: Merkle path verification === 
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
    var left0 = pathIndices[0] * (pathElements[0] - commitment) + commitment;
    var right0 = pathIndices[0] * (commitment - pathElements[0]) + pathElements[0];
    merkleHasher0.inputs[0] <== left0;
    merkleHasher0.inputs[1] <== right0;
    
    // Level 1
    var left1 = pathIndices[1] * (pathElements[1] - merkleHasher0.out) + merkleHasher0.out;
    var right1 = pathIndices[1] * (merkleHasher0.out - pathElements[1]) + pathElements[1];
    merkleHasher1.inputs[0] <== left1;
    merkleHasher1.inputs[1] <== right1;
    
    // Level 2
    var left2 = pathIndices[2] * (pathElements[2] - merkleHasher1.out) + merkleHasher1.out;
    var right2 = pathIndices[2] * (merkleHasher1.out - pathElements[2]) + pathElements[2];
    merkleHasher2.inputs[0] <== left2;
    merkleHasher2.inputs[1] <== right2;
    
    // Level 3
    var left3 = pathIndices[3] * (pathElements[3] - merkleHasher2.out) + merkleHasher2.out;
    var right3 = pathIndices[3] * (merkleHasher2.out - pathElements[3]) + pathElements[3];
    merkleHasher3.inputs[0] <== left3;
    merkleHasher3.inputs[1] <== right3;
    
    // Level 4
    var left4 = pathIndices[4] * (pathElements[4] - merkleHasher3.out) + merkleHasher3.out;
    var right4 = pathIndices[4] * (merkleHasher3.out - pathElements[4]) + pathElements[4];
    merkleHasher4.inputs[0] <== left4;
    merkleHasher4.inputs[1] <== right4;
    
    // Level 5
    var left5 = pathIndices[5] * (pathElements[5] - merkleHasher4.out) + merkleHasher4.out;
    var right5 = pathIndices[5] * (merkleHasher4.out - pathElements[5]) + pathElements[5];
    merkleHasher5.inputs[0] <== left5;
    merkleHasher5.inputs[1] <== right5;
    
    // Level 6
    var left6 = pathIndices[6] * (pathElements[6] - merkleHasher5.out) + merkleHasher5.out;
    var right6 = pathIndices[6] * (merkleHasher5.out - pathElements[6]) + pathElements[6];
    merkleHasher6.inputs[0] <== left6;
    merkleHasher6.inputs[1] <== right6;
    
    // Level 7
    var left7 = pathIndices[7] * (pathElements[7] - merkleHasher6.out) + merkleHasher6.out;
    var right7 = pathIndices[7] * (merkleHasher6.out - pathElements[7]) + pathElements[7];
    merkleHasher7.inputs[0] <== left7;
    merkleHasher7.inputs[1] <== right7;
    
    // Level 8
    var left8 = pathIndices[8] * (pathElements[8] - merkleHasher7.out) + merkleHasher7.out;
    var right8 = pathIndices[8] * (merkleHasher7.out - pathElements[8]) + pathElements[8];
    merkleHasher8.inputs[0] <== left8;
    merkleHasher8.inputs[1] <== right8;
    
    // Level 9
    var left9 = pathIndices[9] * (pathElements[9] - merkleHasher8.out) + merkleHasher8.out;
    var right9 = pathIndices[9] * (merkleHasher8.out - pathElements[9]) + pathElements[9];
    merkleHasher9.inputs[0] <== left9;
    merkleHasher9.inputs[1] <== right9;
    
    // Level 10
    var left10 = pathIndices[10] * (pathElements[10] - merkleHasher9.out) + merkleHasher9.out;
    var right10 = pathIndices[10] * (merkleHasher9.out - pathElements[10]) + pathElements[10];
    merkleHasher10.inputs[0] <== left10;
    merkleHasher10.inputs[1] <== right10;
    
    // Level 11
    var left11 = pathIndices[11] * (pathElements[11] - merkleHasher10.out) + merkleHasher10.out;
    var right11 = pathIndices[11] * (merkleHasher10.out - pathElements[11]) + pathElements[11];
    merkleHasher11.inputs[0] <== left11;
    merkleHasher11.inputs[1] <== right11;
    
    // Level 12
    var left12 = pathIndices[12] * (pathElements[12] - merkleHasher11.out) + merkleHasher11.out;
    var right12 = pathIndices[12] * (merkleHasher11.out - pathElements[12]) + pathElements[12];
    merkleHasher12.inputs[0] <== left12;
    merkleHasher12.inputs[1] <== right12;
    
    // Level 13
    var left13 = pathIndices[13] * (pathElements[13] - merkleHasher12.out) + merkleHasher12.out;
    var right13 = pathIndices[13] * (merkleHasher12.out - pathElements[13]) + pathElements[13];
    merkleHasher13.inputs[0] <== left13;
    merkleHasher13.inputs[1] <== right13;
    
    // Level 14
    var left14 = pathIndices[14] * (pathElements[14] - merkleHasher13.out) + merkleHasher13.out;
    var right14 = pathIndices[14] * (merkleHasher13.out - pathElements[14]) + pathElements[14];
    merkleHasher14.inputs[0] <== left14;
    merkleHasher14.inputs[1] <== right14;
    
    // Level 15
    var left15 = pathIndices[15] * (pathElements[15] - merkleHasher14.out) + merkleHasher14.out;
    var right15 = pathIndices[15] * (merkleHasher14.out - pathElements[15]) + pathElements[15];
    merkleHasher15.inputs[0] <== left15;
    merkleHasher15.inputs[1] <== right15;
    
    merkleRoot <== merkleHasher15.out;
    
    // === Step 4: Nullifier derivation === 
    component nullifierGen = Nullifier();
    nullifierGen.ownerWalletPubKey <== recipientWalletPubKey;
    nullifierGen.ownerWalletPrivKey <== recipientWalletPrivKey;
    nullifierGen.randomness <== randomness;
    nullifierGen.tokenId <== tokenId;
    nullifier <== nullifierGen.nullifier;
}

component main { public [recipientWalletPubKey, amount, tokenId, commitment] } = Withdraw();