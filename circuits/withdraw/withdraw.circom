pragma circom 2.1.4;

include "circomlib/circuits/poseidon.circom";
include "../merkle/merkle.circom";
include "../nullifier/nullifier.circom";
include "../note_commitment/note_commitment.circom";

// CipherPay Withdraw Circuit (parameterized Merkle depth)
// NEW public signals order (outputs first, then public inputs):
// [ nullifier, merkleRoot, recipientOwner_lo, recipientOwner_hi, recipientWalletPubKey, amount, tokenId ]
template Withdraw(depth) {
    // === Private inputs ===
    signal input recipientWalletPrivKey;      // recipient L1 private key
    signal input randomness;                  // note randomness
    signal input memo;                        // optional memo
    signal input pathElements[depth];         // Merkle auth path (bottom -> top)
    signal input pathIndices[depth];          // 0 => (left=cur,right=sib), 1 => (left=sib,right=cur)
    signal input commitment;                  // PRIVATE: expected note commitment

    // === Public inputs ===
    //
    // Solana recipient owner pubkey (32 bytes) split into two 128-bit LE limbs:
    //   - recipientOwner_lo: LE integer of bytes[ 0..16)
    //   - recipientOwner_hi: LE integer of bytes[16..32)
    //
    // These are *not* used in arithmetic; they are exposed so the on-chain
    // program can reconstruct the 32-byte Pubkey and compare to recipient_owner.
    signal input recipientOwner_lo;           // low 128 bits (LE)
    signal input recipientOwner_hi;           // high 128 bits (LE)

    // Existing UI-ish public inputs
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

    // NOTE: no arithmetic constraints on recipientOwner_lo/hi.
    // They are public-only for on-chain equality checking.
}

// Outputs first, then declared `public` inputs become public signals in this order:
// [ nullifier, merkleRoot, recipientOwner_lo, recipientOwner_hi, recipientWalletPubKey, amount, tokenId ]
component main { public [recipientOwner_lo, recipientOwner_hi, recipientWalletPubKey, amount, tokenId] } = Withdraw(16);
