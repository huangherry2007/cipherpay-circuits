pragma circom 2.1.4;
// circuits/transfer/transfer.circom
include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";      // Num2Bits
include "../merkle/merkle.circom";               // MerkleProof(depth)
include "../nullifier/nullifier.circom";         // Nullifier*, incl. FromCipherKey
include "../note_commitment/note_commitment.circom"; // NoteCommitment, FromWallet

// Transfer with 1 input note, 2 output notes, and append-2 Merkle updates
// Public signals (Circom 2): outputs first, then [encNote1Hash, encNote2Hash]
// [ outCommitment1, outCommitment2, nullifier, merkleRoot,
//   newMerkleRoot1, newMerkleRoot2, newNextLeafIndex, encNote1Hash, encNote2Hash ]
template Transfer(depth) {
    // === Private input note (5-field note preimage) ===
    signal input inAmount;
    signal input inSenderWalletPubKey;
    signal input inSenderWalletPrivKey;
    signal input inRandomness;
    signal input inTokenId;
    signal input inMemo;

    // Membership proof for the input commitment
    signal input inPathElements[depth];     // siblings bottom -> top
    signal input inPathIndices[depth];      // 0 => (left=cur, right=sib), 1 => (left=sib, right=cur)

    // === Output note 1 (recipient) ===
    signal input out1Amount;
    signal input out1RecipientCipherPayPubKey;
    signal input out1Randomness;
    signal input out1TokenId;
    signal input out1Memo;

    // === Output note 2 (flexible recipient) ===
    signal input out2Amount;
    signal input out2RecipientCipherPayPubKey;
    signal input out2Randomness;
    signal input out2TokenId;
    signal input out2Memo;

    // === Append two new leaves at consecutive positions ===
    signal input nextLeafIndex;             // index for outCommitment1 (private)
    signal input out1PathElements[depth];   // insertion siblings for index = nextLeafIndex
    signal input out2PathElements[depth];   // insertion siblings for index = nextLeafIndex + 1 (pre-insertion tree)

    // === Public inputs (bind encrypted payloads to outputs/recipients) ===
    signal input encNote1Hash;              // Poseidon(outCommitment1, out1RecipientCipherPayPubKey)
    signal input encNote2Hash;              // Poseidon(outCommitment2, out2RecipientCipherPayPubKey)

    // === Public outputs ===
    signal output outCommitment1;
    signal output outCommitment2;
    signal output nullifier;
    signal output merkleRoot;               // root BEFORE insertions
    signal output newMerkleRoot1;           // AFTER inserting outCommitment1 at nextLeafIndex
    signal output newMerkleRoot2;           // AFTER inserting outCommitment2 at nextLeafIndex+1
    signal output newNextLeafIndex;         // == nextLeafIndex + 2

    // -- Step 1: input note commitment (derive sender CipherPay pubkey internally) --
    component inNote = NoteCommitmentFromWallet();
    inNote.amount        <== inAmount;
    inNote.walletPubKey  <== inSenderWalletPubKey;
    inNote.walletPrivKey <== inSenderWalletPrivKey;
    inNote.randomness    <== inRandomness;
    inNote.tokenId       <== inTokenId;
    inNote.memo          <== inMemo;

    signal inCommitment;
    inCommitment <== inNote.commitment;

    // -- Step 2: Merkle inclusion proof for the input commitment (yields current merkleRoot) --
    component mpIn = MerkleProof(depth);
    mpIn.leaf <== inCommitment;
    for (var i = 0; i < depth; i++) {
        mpIn.pathElements[i] <== inPathElements[i];
        mpIn.pathIndices[i]  <== inPathIndices[i];
    }
    merkleRoot <== mpIn.root;

    // -- Step 3: output notes (both can target arbitrary recipients) --
    component outNote1 = NoteCommitment();
    outNote1.amount          <== out1Amount;
    outNote1.cipherPayPubKey <== out1RecipientCipherPayPubKey;
    outNote1.randomness      <== out1Randomness;
    outNote1.tokenId         <== out1TokenId;
    outNote1.memo            <== out1Memo;
    outCommitment1           <== outNote1.commitment;

    component outNote2 = NoteCommitment();
    outNote2.amount          <== out2Amount;
    outNote2.cipherPayPubKey <== out2RecipientCipherPayPubKey;
    outNote2.randomness      <== out2Randomness;
    outNote2.tokenId         <== out2TokenId;
    outNote2.memo            <== out2Memo;
    outCommitment2           <== outNote2.commitment;

    // -- Step 4: nullifier (prevents double-spend of input note) --
    component nul = NullifierFromCipherKey();
    nul.cipherPayPubKey <== inNote.derivedCipherPayPubKey;  // reuse derived CPPK
    nul.randomness      <== inRandomness;
    nul.tokenId         <== inTokenId;
    nullifier           <== nul.nullifier;

    // -- Step 5: conservation & token checks --
    inAmount    === out1Amount + out2Amount;
    out1TokenId === inTokenId;
    out2TokenId === inTokenId;

    // -- Step 6: bind ciphertext tags to outputs & recipients --
    component bind1 = Poseidon(2);
    bind1.inputs[0] <== outCommitment1;
    bind1.inputs[1] <== out1RecipientCipherPayPubKey;
    encNote1Hash === bind1.out;

    component bind2 = Poseidon(2);
    bind2.inputs[0] <== outCommitment2;
    bind2.inputs[1] <== out2RecipientCipherPayPubKey;
    encNote2Hash === bind2.out;

    // -- Step 7: Insertion #1 (append outCommitment1 at index = nextLeafIndex) --
    component bits1 = Num2Bits(depth);
    bits1.in <== nextLeafIndex;             // also enforces nextLeafIndex < 2^depth

    signal cur1[depth + 1];
    cur1[0] <== outCommitment1;

    signal left1[depth];
    signal right1[depth];
    component H1[depth];

    for (var j = 0; j < depth; j++) {
        left1[j]  <== bits1.out[j] * (out1PathElements[j] - cur1[j]) + cur1[j];
        right1[j] <== bits1.out[j] * (cur1[j] - out1PathElements[j]) + out1PathElements[j];

        H1[j] = Poseidon(2);
        H1[j].inputs[0] <== left1[j];
        H1[j].inputs[1] <== right1[j];
        cur1[j + 1] <== H1[j].out;
    }
    newMerkleRoot1 <== cur1[depth];

    // -- Step 8: Insertion #2 (append outCommitment2 at index = nextLeafIndex + 1) --
    signal nextIdx1;
    nextIdx1 <== nextLeafIndex + 1;

    component bits2 = Num2Bits(depth);
    bits2.in <== nextIdx1;                  // enforces nextLeafIndex + 1 < 2^depth

    signal cur2[depth + 1];
    cur2[0] <== outCommitment2;

    signal left2[depth];
    signal right2[depth];
    component H2[depth];

    // Parity of nextLeafIndex (LSB from insertion #1 bits)
    signal b1;
    b1 <== bits1.out[0]; // boolean

    // Safe level-0 sibling selection via assignments (quadratic only):
    // sib0 = outCommitment1 + b1 * (out2PathElements[0] - outCommitment1)
    signal t0;
    t0   <== out2PathElements[0] - outCommitment1;
    signal sib0;
    sib0 <== outCommitment1 + b1 * t0;

    // Level 0 using sib0 and bits2
    left2[0]  <== bits2.out[0] * (sib0 - cur2[0]) + cur2[0];
    right2[0] <== bits2.out[0] * (cur2[0] - sib0) + sib0;

    H2[0] = Poseidon(2);
    H2[0].inputs[0] <== left2[0];
    H2[0].inputs[1] <== right2[0];
    cur2[1] <== H2[0].out;

    // Levels 1..depth-1 use provided pre-insertion siblings
    for (var k = 1; k < depth; k++) {
        left2[k]  <== bits2.out[k] * (out2PathElements[k] - cur2[k]) + cur2[k];
        right2[k] <== bits2.out[k] * (cur2[k] - out2PathElements[k]) + out2PathElements[k];

        H2[k] = Poseidon(2);
        H2[k].inputs[0] <== left2[k];
        H2[k].inputs[1] <== right2[k];
        cur2[k + 1] <== H2[k].out;
    }
    newMerkleRoot2 <== cur2[depth];

    // final next index after two insertions
    newNextLeafIndex <== nextLeafIndex + 2;
}

// Outputs first, then public inputs:
// [ outCommitment1, outCommitment2, nullifier, merkleRoot,
//   newMerkleRoot1, newMerkleRoot2, newNextLeafIndex, encNote1Hash, encNote2Hash ]
component main { public [encNote1Hash, encNote2Hash] } = Transfer(16);
