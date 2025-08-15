pragma circom 2.1.4;

include "circomlib/circuits/poseidon.circom";
include "../nullifier/nullifier.circom";
include "../note_commitment/note_commitment.circom";

// CipherPay Transfer circuit with wallet-bound recipient identity
template Transfer() {
    // === Private input note (5-field note preimage) === 
    signal input inAmount;
    signal input inSenderWalletPubKey;
    signal input inSenderWalletPrivKey;
    signal input inRandomness;
    signal input inTokenId;
    signal input inMemo;
    
    signal input inPathElements[16];
    signal input inPathIndices[16];
    
    // === Output note 1 (for recipient) === 
    signal input out1Amount;
    signal input out1RecipientCipherPayPubKey;  // Recipient provides this directly
    signal input out1Randomness;
    signal input out1TokenId;
    signal input out1Memo;
    
    // === Output note 2 (change note) === 
    signal input out2Amount;
    signal input out2SenderCipherPayPubKey;  // Sender's change note
    signal input out2Randomness;
    signal input out2TokenId;
    signal input out2Memo;
    
    // === Encrypted note for recipient === 
    signal input encryptedNote;  // Encrypted note for recipient (out1)
    
    // === Public outputs === 
    signal output inCommitment;
    signal output outCommitment1;
    signal output outCommitment2;
    signal output nullifier;
    signal output merkleRoot;
    
    // === Step 1: Derive CipherPay identities === 
    component id1 = Poseidon(2);
    id1.inputs[0] <== inSenderWalletPubKey;
    id1.inputs[1] <== inSenderWalletPrivKey;
    signal inSenderCipherPayPubKey <== id1.out;
    
    // For output notes, recipients provide their CipherPay pubkeys directly
    // out1 is for the recipient, out2 is for sender's change
    signal out1CipherPayPubKey <== out1RecipientCipherPayPubKey;
    signal out2CipherPayPubKey <== out2SenderCipherPayPubKey;
    
    // === Step 2: Compute input commitment === 
    component inputNote = NoteCommitment();
    inputNote.amount <== inAmount;
    inputNote.cipherPayPubKey <== inSenderCipherPayPubKey;
    inputNote.randomness <== inRandomness;
    inputNote.tokenId <== inTokenId;
    inputNote.memo <== inMemo;
    inCommitment <== inputNote.commitment;
    
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
    var left0 = inPathIndices[0] * (inPathElements[0] - inCommitment) + inCommitment;
    var right0 = inPathIndices[0] * (inCommitment - inPathElements[0]) + inPathElements[0];
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
    
    // === Step 4: Output commitment 1 === 
    component outNote1 = NoteCommitment();
    outNote1.amount <== out1Amount;
    outNote1.cipherPayPubKey <== out1CipherPayPubKey;
    outNote1.randomness <== out1Randomness;
    outNote1.tokenId <== out1TokenId;
    outNote1.memo <== out1Memo;
    outCommitment1 <== outNote1.commitment;
    
    // === Step 5: Output commitment 2 === 
    component outNote2 = NoteCommitment();
    outNote2.amount <== out2Amount;
    outNote2.cipherPayPubKey <== out2CipherPayPubKey;
    outNote2.randomness <== out2Randomness;
    outNote2.tokenId <== out2TokenId;
    outNote2.memo <== out2Memo;
    outCommitment2 <== outNote2.commitment;
    
    // === Step 6: Nullifier === 
    component nullifierGen = Nullifier();
    nullifierGen.ownerWalletPubKey <== inSenderWalletPubKey;
    nullifierGen.ownerWalletPrivKey <== inSenderWalletPrivKey;
    nullifierGen.randomness <== inRandomness;
    nullifierGen.tokenId <== inTokenId;
    nullifier <== nullifierGen.nullifier;
    

    
    // === Step 7: Conservation Checks === 
    inAmount === out1Amount + out2Amount;
    out1TokenId === inTokenId;
    out2TokenId === inTokenId;
}

component main {public [encryptedNote]} = Transfer();
