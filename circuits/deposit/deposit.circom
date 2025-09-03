pragma circom 2.1.4;

include "circomlib/circuits/poseidon.circom";
include "../note_commitment/note_commitment.circom";
include "../merkle/merkle.circom";

// CipherPay Deposit Circuit (parameterized by Merkle depth)
template Deposit(depth) {
    // === Private inputs (note preimage) ===
    signal input ownerWalletPubKey;
    signal input ownerWalletPrivKey;
    signal input randomness;
    signal input tokenId;
    signal input memo;

    // === Merkle tree inputs ===
    signal input inPathElements[depth]; // sibling hashes bottom→top
    signal input inPathIndices[depth];  // 0 = (left=cur,right=sib), 1 = (left=sib,right=cur)
    signal input nextLeafIndex;         // index being inserted

    // === Public inputs ===
    signal input nonce;                 // binds depositHash
    signal input amount;                // public amount
    signal input depositHash;           // Poseidon(ownerCipherPayPubKey, amount, nonce)

    // === Public outputs ===
    signal output newCommitment;
    signal output ownerCipherPayPubKey;
    signal output newMerkleRoot;
    signal output newNextLeafIndex;

    // -- Step 1: derive CipherPay identity + build commitment --
    // commitment = Poseidon(amount, derivedCipherPayPubKey, randomness, tokenId, memo)
    component note = NoteCommitmentFromWallet();
    note.amount        <== amount;
    note.walletPubKey  <== ownerWalletPubKey;
    note.walletPrivKey <== ownerWalletPrivKey;
    note.randomness    <== randomness;
    note.tokenId       <== tokenId;
    note.memo          <== memo;

    newCommitment        <== note.commitment;
    ownerCipherPayPubKey <== note.derivedCipherPayPubKey;

    // -- Step 2: enforce depositHash binding --
    component depHash = Poseidon(3);
    depHash.inputs[0] <== ownerCipherPayPubKey;
    depHash.inputs[1] <== amount;
    depHash.inputs[2] <== nonce;
    depositHash === depHash.out;

    // -- Step 3: compute Merkle root using reusable MerkleProof --
    component mp = MerkleProof(depth);
    mp.leaf <== newCommitment;
    for (var i = 0; i < depth; i++) {
        mp.pathElements[i] <== inPathElements[i];
        mp.pathIndices[i]  <== inPathIndices[i];
    }
    newMerkleRoot <== mp.root;

    // -- Step 4: next index (append semantics)
    newNextLeafIndex <== nextLeafIndex + 1;
}

// Public signals order (Circom 2):
// [ newCommitment, ownerCipherPayPubKey, newMerkleRoot, newNextLeafIndex, amount, depositHash ]
component main { public [amount, depositHash] } = Deposit(16);
