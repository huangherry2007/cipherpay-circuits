pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";

// Merkle proof verification circuit for CipherPay v2
// Optimized for depth-16 trees with tree rotation strategy
// Based on v2 whitepaper Appendix B specifications
//
// Security Properties:
// - Merkle inclusion verification for shielded note commitments
// - Binary selection with quadratic constraints for path verification
// - Computes Merkle root from leaf and path for on-chain verification
//
// Note: Relayers maintain the full Merkle tree off-chain in JavaScript/TypeScript
// This circuit only verifies inclusion proofs using paths provided by relayers

// Core Merkle proof verificationtemplate (optimized for depth-16)
template MerkleProof(depth) {
    // === Public inputs === 
    signal input leaf;              // Leaf commitment to verify (254-bit)
    
    // === Private inputs === 
    signal input pathElements[depth]; // Sibling hashes along the Merkle path (254-bit each)
    signal input pathIndices[depth];  // Bit array indicating left/right sibling at each level (0 = left, 1 = right)
    
    // === Public outputs === 
    signal output root;              // Computed Merkle root from path (254-bit)
    
    // === Internalsignal s for path computation === 
    signal left[depth];          // Left child at each level
    signal right[depth];         // Right child at each level
    
    // === Components === 
    component poseidonHash[depth];  // Array of Poseidoncomponent s for Merkle path
    
    // Initialize Poseidoncomponent s for Merkle path
    for (var i = 0; i < depth; i++) {
        poseidonHash[i] = Poseidon(2);
    }
    
    // === Compute Merkle path using binary selection with quadratic constraints === 
    var current = leaf;
    for (var i = 0; i < depth; i++) {
        // Use binary selection with quadratic constraints
        // left = pathIndices[i] ? pathElements[i] : current
        left[i] <== pathIndices[i] * (pathElements[i] - current) + current;
        
        // right = pathIndices[i] ? current : pathElements[i]
        right[i] <== pathIndices[i] * (current - pathElements[i]) + pathElements[i];
        
        // Hash the pair using Poseidon
        poseidonHash[i].inputs[0] <== left[i];
        poseidonHash[i].inputs[1] <== right[i];
        current = poseidonHash[i].out;
    }
    
    // === Output the computed root === 
    root <== current;
}

// Note: This is a reusablecomponent , not meant to be compiled standalone
//
// Usage in transfer/withdraw circuits:
//component merkleProof = MerkleProof(16);
// merkleProof.leaf <== computedCommitment;
// for (var i = 0; i < 16; i++) {
    //     merkleProof.pathElements[i] <== inPathElements[i];
    //     merkleProof.pathIndices[i] <== inPathIndices[i];
// }
// merkleRoot <== merkleProof.root;