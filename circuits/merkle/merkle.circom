pragma circom 2.1.4;

include "circomlib/circuits/poseidon.circom";

// Generic Merkle inclusion proof (depth-parametric, bottom -> top)
// Notes:
// - `leaf`, `pathElements[]`, `pathIndices[]` are template inputs (not public
//   unless exposed by a parent circuit's `main { public [...] }`).
// - `pathIndices[i]` is constrained boolean (0/1).
template MerkleProof(depth) {
    // Inputs
    signal input leaf;                    // leaf being proven
    signal input pathElements[depth];     // sibling at each level (bottom -> top)
    signal input pathIndices[depth];      // 0 => (left=cur,right=sib), 1 => (left=sib,right=cur)

    // Output
    signal output root;                   // computed Merkle root

    // Working signals
    signal cur[depth + 1];
    signal left[depth];
    signal right[depth];
    component H[depth];

    // Start from the leaf
    cur[0] <== leaf;

    // Walk the path
    for (var i = 0; i < depth; i++) {
        // Enforce bit is boolean
        pathIndices[i] * (pathIndices[i] - 1) === 0;

        // Select children using quadratic selector
        // if bit==0: left=cur[i],   right=pathElements[i]
        // if bit==1: left=pathElem, right=cur[i]
        left[i]  <== pathIndices[i] * (pathElements[i] - cur[i]) + cur[i];
        right[i] <== pathIndices[i] * (cur[i] - pathElements[i]) + pathElements[i];

        // Hash pair for next level
        H[i] = Poseidon(2);
        H[i].inputs[0] <== left[i];
        H[i].inputs[1] <== right[i];
        cur[i + 1] <== H[i].out;
    }

    // Root at the top
    root <== cur[depth];
}

// Example usage inside another circuit:
// component mp = MerkleProof(16);
// mp.leaf <== someCommitment;
// for (var i = 0; i < 16; i++) {
//     mp.pathElements[i] <== pathElems[i];
//     mp.pathIndices[i]  <== pathBits[i];
// }
// someRootSignal <== mp.root;
