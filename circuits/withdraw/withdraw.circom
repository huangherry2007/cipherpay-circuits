pragma circom 2.1.4;

include "circomlib/circuits/poseidon.circom";
include "../merkle/merkle.circom";
include "../nullifier/nullifier.circom";
include "../note_commitment/note_commitment.circom";

// CipherPay Withdraw Circuit (parameterized Merkle depth)
// Public signals (in order): [ nullifier, merkleRoot, recipientWalletPubKey, amount, tokenId ]
template Withdraw(depth) {
    // === Private inputs ===
    signal input recipientWalletPrivKey;      // recipient L1 private key
    signal input randomness;                  // note randomness
    signal input memo;                        // optional memo
    signal input pathElements[depth];         // Merkle auth path (bottom -> top)
    signal input pathIndices[depth];          // 0 => (left=cur,right=sib), 1 => (left=sib,right=cur)
    signal input commitment;                  // PRIVATE: expected note commitment

    // === Public inputs ===
    signal input recipientWalletPubKey;       // recipient L1 public key
    signal input amount;                      // note amount
    signal input tokenId;                     // note token id

    // === Public outputs ===
    signal output nullifier;                  // spend nullifier (prevents reuse)
    signal output merkleRoot;                 // Merkle root of the tree

    // -- Step 1: derive CipherPay pubkey + recompute commitment from preimage --
    component note = NoteCommitmentFromWallet();
    note.amount        <== amount;
    note.walletPubKey  <== recipientWalletPubKey;
    note.walletPrivKey <== recipientWalletPrivKey;
    note.randomness    <== randomness;
    note.tokenId       <== tokenId;
    note.memo          <== memo;

    // Provided private `commitment` must match reconstructed one
    note.commitment === commitment;

    // -- Step 2: Merkle inclusion proof (commitment ∈ tree) --
    component mp = MerkleProof(depth);
    mp.leaf <== commitment;
    for (var i = 0; i < depth; i++) {
        mp.pathElements[i] <== pathElements[i];
        mp.pathIndices[i]  <== pathIndices[i];   // boolean enforced inside MerkleProof
    }
    merkleRoot <== mp.root;

    // -- Step 3: derive nullifier (prevents double-spend) --
    component nul = NullifierFromCipherKey();
    nul.cipherPayPubKey <== note.derivedCipherPayPubKey; // Poseidon(pub, priv)
    nul.randomness      <== randomness;
    nul.tokenId         <== tokenId;
    nullifier           <== nul.nullifier;
}

// Outputs first, then public inputs:
// [ nullifier, merkleRoot, recipientWalletPubKey, amount, tokenId ]
component main { public [recipientWalletPubKey, amount, tokenId] } = Withdraw(16);
