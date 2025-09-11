# CipherPay Circuit Implementation Guide

## Overview

This guide provides detailed information on implementing and working with CipherPay's zero-knowledge proof circuits. The circuits are written in Circom 2.1.4 and use the Groth16 proving system.

## Circuit Structure

### File Organization

```
circuits/
├── transfer/
│   └── transfer.circom          # Shielded transfer circuit
├── deposit/
│   └── deposit.circom           # Deposit to shielded pool
├── withdraw/
│   └── withdraw.circom          # Withdraw from shielded pool
├── note_commitment/
│   └── note_commitment.circom   # Note commitment component
└── nullifier/
    └── nullifier.circom         # Nullifier generation component
```

### Build Output

Each circuit generates the following files when compiled:

```
build/{circuit_name}/
├── {circuit_name}.r1cs          # Constraint system
├── {circuit_name}_js/           # JavaScript witness calculator
│   └── {circuit_name}.wasm
├── {circuit_name}.zkey          # Proving key
├── verification_key.json         # Verification key
└── verifier-{circuit_name}.json # Renamed verification key
```

## Circuit Details

### Deposit Circuit

**File**: `circuits/deposit/deposit.circom`

**Purpose**: Converts public funds to shielded notes with Merkle tree integration.

**Key Components**:
1. **Identity Derivation**: Derives owner's CipherPay identity from wallet keys
2. **Note Commitment**: Computes commitment for new shielded note
3. **Merkle Tree Update**: Updates Merkle tree with new commitment
4. **Deposit Hash Verification**: Verifies privacy-enhanced deposit binding

**Input Structure**:
```javascript
{
  // Private inputs (5 signals)
  ownerWalletPubKey: number,
  ownerWalletPrivKey: number,
  randomness: number,
  tokenId: number,
  memo: number,
  inPathElements: number[16],
  inPathIndices: number[16],
  nextLeafIndex: number,
  
  // Public inputs (3 signals)
  nonce: number,
  amount: number,
  depositHash: number
}
```

**Output Structure**:
```javascript
{
  // Public outputs (4 signals)
  newCommitment: number,
  ownerCipherPayPubKey: number,
  newMerkleRoot: number,
  newNextLeafIndex: number
}
```

**Constraints**:
- Deposit hash verification: `depositHash === Poseidon(ownerCipherPayPubKey, amount, nonce)`
- Merkle tree path verification
- Commitment reconstruction for new note

### Transfer Circuit

**File**: `circuits/transfer/transfer.circom`

**Purpose**: Enables shielded transfers between users with encrypted note delivery.

**Key Components**:
1. **Identity Derivation**: Derives sender's CipherPay identity from wallet keys
2. **Note Commitment**: Computes commitments for input and output notes
3. **Merkle Verification**: Verifies input note inclusion in Merkle tree
4. **Nullifier Generation**: Prevents double-spending of input note
5. **Amount Conservation**: Ensures `inAmount === out1Amount + out2Amount`

**Input Structure**:
```javascript
{
  // Private inputs (7 signals)
  inAmount: number,
  inSenderWalletPubKey: number,
  inSenderWalletPrivKey: number,
  inRandomness: number,
  inTokenId: number,
  inMemo: number,
  inPathElements: number[16],
  inPathIndices: number[16],
  out1Amount: number,
  out1RecipientCipherPayPubKey: number,
  out1Randomness: number,
  out1TokenId: number,
  out1Memo: number,
  out2Amount: number,
  out2SenderCipherPayPubKey: number,
  out2Randomness: number,
  out2TokenId: number,
  out2Memo: number,
  
  // Public inputs (2 signals)
  encNote1Hash: number,
  encNote2Hash: number
}
```

**Output Structure**:
```javascript
{
  // Public outputs (7 signals)
  outCommitment1: number,
  outCommitment2: number,
  nullifier: number,
  merkleRoot: number,
  newMerkleRoot1: number,
  newMerkleRoot2: number,
  newNextLeafIndex: number
}
```

**Constraints**:
- Amount conservation: `inAmount === out1Amount + out2Amount`
- Token consistency: `inTokenId === out1TokenId === out2TokenId`
- Merkle path verification for input note
- Commitment reconstruction for output notes

### Withdraw Circuit

**File**: `circuits/withdraw/withdraw.circom`

**Purpose**: Converts shielded notes to public funds with identity verification.

**Key Components**:
1. **Identity Reconstruction**: Reconstructs recipient's CipherPay identity
2. **Commitment Verification**: Validates note commitment reconstruction
3. **Merkle Verification**: Verifies note inclusion in Merkle tree
4. **Nullifier Generation**: Prevents double-spending

**Input Structure**:
```javascript
{
  // Private inputs (5 signals)
  recipientWalletPrivKey: number,
  randomness: number,
  memo: number,
  pathElements: number[16],
  pathIndices: number[16],
  
  commitment: number,
  
  // Public inputs (3 signals)
  recipientWalletPubKey: number,
  amount: number,
  tokenId: number
}
```

**Output Structure**:
```javascript
{
  // Public outputs (2 signals)
  nullifier: number,
  merkleRoot: number
}
```

**Constraints**:
- Commitment reconstruction: `Poseidon(amount, recipientCipherPayPubKey, randomness, tokenId, memo) === commitment`
- Merkle path verification
- Identity reconstruction from wallet keys

### Note Commitment Component

**File**: `circuits/note_commitment/note_commitment.circom`

**Purpose**: Reusable component for computing note commitments.

**Input Structure**:
```javascript
{
  amount: number,
  cipherPayPubKey: number,
  randomness: number,
  tokenId: number,
  memo: number
}
```

**Output**: `commitment` - Poseidon hash of note components

### Nullifier Component

**File**: `circuits/nullifier/nullifier.circom`

**Purpose**: Reusable component for generating nullifiers.

**Input Structure**:
```javascript
{
  ownerWalletPubKey: number,
  ownerWalletPrivKey: number,
  randomness: number,
  tokenId: number
}
```

**Output**: `nullifier` - Poseidon hash of owner keys and note data

## Building Circuits

### Prerequisites

1. **Node.js** (v16 or later)
2. **Circom** (v2.1.4)
3. **snarkjs** (latest)

### Build Process

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Compile Circuits**:
   ```bash
   node scripts/setup.js
   ```

3. **Verify Build**:
   ```bash
   npm test
   ```

### Build Output

The build process generates:
- **R1CS files**: Constraint systems for each circuit
- **WASM files**: JavaScript witness calculators
- **Proving keys**: For generating ZK proofs
- **Verification keys**: For verifying ZK proofs

## Testing Circuits

### Test Structure

```
test/
├── helpers.js                   # Test input generators
├── circuits.test.js             # Circuit structure validation
└── proof-generation.test.js     # ZK proof generation tests
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- test/circuits.test.js

# Run with increased timeout for ZK proofs
npm test -- --testTimeout=30000
```

### Test Inputs

The test helpers generate realistic input data for each circuit:

- **Transfer**: 19 signals with Merkle paths and encrypted notes
- **Deposit**: 8 signals with deposit hash validation
- **Withdraw**: 9 signals with commitment verification
- **Components**: 4-5 signals for reusable components

## Integration Examples

### JavaScript Integration

```javascript
const snarkjs = require('snarkjs');

// Generate transfer proof
async function generateTransferProof(input) {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    'build/transfer/transfer_js/transfer.wasm',
    'build/transfer/transfer.zkey'
  );
  
  return { proof, publicSignals };
}

// Verify transfer proof
async function verifyTransferProof(proof, publicSignals) {
  const verificationKey = JSON.parse(
    fs.readFileSync('build/transfer/verifier-transfer.json', 'utf8')
  );
  
  return await snarkjs.groth16.verify(verificationKey, publicSignals, proof);
}
```

### Solidity Integration

```solidity
// Transfer circuit verifier
contract TransferVerifier {
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[1] memory input
    ) public view returns (bool) {
        // Verification logic
    }
}
```

## Performance Considerations

### Circuit Complexity

- **Transfer**: ~215 constraints
- **Deposit**: ~214 constraints  
- **Withdraw**: ~215 constraints
- **Components**: ~10-20 constraints each

### Proof Generation

- **Time**: 2-5 seconds per proof (depending on hardware)
- **Memory**: ~2GB RAM required
- **Proof Size**: ~2.5KB per proof

### Verification

- **Gas Cost**: ~200K gas per verification
- **Time**: <1 second per verification
- **On-chain**: Constant gas cost regardless of circuit complexity

## Security Considerations

### Trusted Setup

- **Power of Tau**: Multi-party computation for proving key generation
- **Circuit-Specific**: Each circuit requires its own trusted setup
- **Verification**: Public verification keys can be generated without trust

### Cryptographic Assumptions

- **Discrete Logarithm**: Security of elliptic curve cryptography
- **Hash Function**: Collision resistance of Poseidon hash
- **Zero-Knowledge**: Soundness and completeness of Groth16

### Best Practices

1. **Input Validation**: Validate all inputs before proof generation
2. **Key Management**: Secure storage of wallet private keys
3. **Randomness**: Use cryptographically secure random number generation
4. **Audit Trails**: Maintain logs for compliance requirements

## Troubleshooting

### Common Issues

1. **Build Failures**: Check Circom version compatibility
2. **Memory Issues**: Increase Node.js heap size for large circuits
3. **Timeout Errors**: Increase Jest timeout for ZK proof tests
4. **Constraint Errors**: Verify input signal constraints match circuit

### Debugging

1. **Circuit Validation**: Use `circom --c` for constraint analysis
2. **Witness Generation**: Check WASM file generation
3. **Proof Generation**: Verify input signal compatibility
4. **Verification**: Test with known valid proofs

## Future Enhancements

### Planned Improvements

1. **Recursive Proofs**: Enable proof aggregation
2. **Optimized Circuits**: Reduce constraint count
3. **Multi-Asset Support**: Native support for multiple tokens
4. **Advanced Privacy**: Enhanced privacy features

### Extension Points

1. **Custom Constraints**: Add domain-specific constraints
2. **New Circuits**: Implement additional privacy features
3. **Optimization**: Circuit-specific optimizations
4. **Integration**: Additional blockchain support 