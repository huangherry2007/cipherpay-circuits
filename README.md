# CipherPay Circuits

Zero-knowledge proof circuits for privacy-preserving payments with wallet-bound identities and encrypted note delivery.

## Overview

CipherPay circuits implement privacy-preserving payment functionality using Circom 2.1.4 and the Groth16 proving system. The circuits provide shielded transfers with wallet-bound identities and encrypted note delivery for enhanced privacy.

## Core Circuits

### Transfer Circuit (`transfer.circom`)
**Purpose**: Shielded transfers between users with encrypted note delivery
- **Signals**: 19 total (18 private + 1 public)
- **Key Features**:
  - Amount conservation: `inAmount === out1Amount + out2Amount`
  - Token consistency: All notes use same token ID
  - Encrypted note delivery for recipient privacy
  - Merkle tree inclusion proof verification

### Deposit Circuit (`deposit.circom`)
**Purpose**: Convert public funds to shielded notes with privacy-enhanced binding
- **Signals**: 8 total (5 private + 3 public)
- **Key Features**:
  - Privacy-enhanced deposit hash using `ownerCipherPayPubKey`
  - Unique nonce prevents hash collisions
  - Wallet-bound identity derivation

### Withdraw Circuit (`withdraw.circom`)
**Purpose**: Convert shielded notes to public funds with identity verification
- **Signals**: 9 total (5 private + 4 public)
- **Key Features**:
  - Merkle tree inclusion proof verification
  - Commitment reconstruction and validation
  - Wallet-bound identity verification

## Components

### Note Commitment Component (`note_commitment.circom`)
**Purpose**: Reusable component for computing note commitments
- **Signals**: 5 inputs, 1 output
- **Function**: `commitment = Poseidon(amount, cipherPayPubKey, randomness, tokenId, memo)`

### Nullifier Component (`nullifier.circom`)
**Purpose**: Reusable component for generating nullifiers
- **Signals**: 4 inputs, 1 output
- **Function**: `nullifier = Poseidon(ownerWalletPubKey, ownerWalletPrivKey, randomness, tokenId)`

## Cryptographic Primitives

### Identity Derivation
```javascript
cipherPayPubKey = Poseidon(walletPubKey, walletPrivKey)
```

### Note Commitment
```javascript
commitment = Poseidon(amount, cipherPayPubKey, randomness, tokenId, memo)
```

### Nullifier Generation
```javascript
nullifier = Poseidon(ownerWalletPubKey, ownerWalletPrivKey, randomness, tokenId)
```

### Deposit Hash
```javascript
depositHash = Poseidon(ownerCipherPayPubKey, amount, nonce)
```

## Security Properties

### Privacy
- **Transaction Privacy**: Amounts, recipients, and sender relationships are hidden
- **Identity Privacy**: Wallet keys are never exposed on-chain
- **Note Privacy**: Note contents are encrypted for recipients

### Security
- **Double-Spending Prevention**: Nullifiers prevent note reuse
- **Merkle Tree Security**: Inclusion proofs verify note existence
- **Amount Conservation**: Mathematical constraints prevent value creation

### Auditability
- **Selective Disclosure**: Optional audit trails for compliance
- **Merkle Tree Verification**: Public verification of note inclusion
- **Nullifier Tracking**: Public tracking of spent notes

## Quick Start

### Prerequisites
- **Node.js** (v16 or later)
- **Circom** (v2.1.4)
- **snarkjs** (latest)

### Installation
```bash
# Clone repository
git clone <repository-url>
cd cipherpay-circuits

# Install dependencies
npm install

# Build circuits
node scripts/setup.js

# Run tests
npm test
```

## Testing

### Test Suite
```bash
# Run all tests
npm test

# Run specific test file
npm test -- test/circuits.test.js

# Run with increased timeout for ZK proofs
npm test -- --testTimeout=30000
```

### Test Coverage
- ✅ **Circuit Structure**: Signal counts and types validation
- ✅ **Input Validation**: Correct input formats and constraints
- ✅ **Proof Generation**: ZK proof creation and verification
- ✅ **Error Handling**: Invalid input rejection
- ✅ **Build Verification**: Circuit file generation validation

### Expected Results
```
PASS  test/circuits.test.js
PASS  test/proof-generation.test.js

Test Suites: 2 passed, 2 total
Tests:       28 passed, 28 total
```

## Circuit Input Formats

### Transfer Circuit (19 signals)
```javascript
{
    // Private inputs (18 signals)
    inAmount: 100,
    inSenderWalletPubKey: 1234567890,
    inSenderWalletPrivKey: 1111111111,
    inRandomness: 9876543210,
    inTokenId: 1,
    inMemo: 0,
    inPathElements: Array(16).fill(0),
    inPathIndices: Array(16).fill(0),
    
    // Output note 1 (for recipient)
    out1Amount: 80,
    out1RecipientCipherPayPubKey: 2222222222,
    out1Randomness: 4444444444,
    out1TokenId: 1,
    out1Memo: 0,
    
    // Output note 2 (change note)
    out2Amount: 20,
    out2SenderCipherPayPubKey: 3333333333,
    out2Randomness: 5555555555,
    out2TokenId: 1,
    out2Memo: 0,
    
    // Public inputs (1 signal)
    encryptedNote: 12345678901234567890
}
```

### Deposit Circuit (8 signals)
```javascript
{
    // Private inputs (5 signals)
    ownerWalletPubKey: 1234567890,
    ownerWalletPrivKey: 1111111111,
    randomness: 9876543210,
    tokenId: 1,
    memo: 0,

    // Public inputs (3 signals)
    nonce: 3333333333,
    amount: 100,
    depositHash: 7777777777
}
```

### Withdraw Circuit (9 signals)
```javascript
{
    // Private inputs (5 signals)
    recipientWalletPrivKey: 1111111111,
    randomness: 9876543210,
    memo: 0,
    pathElements: Array(16).fill(0),
    pathIndices: Array(16).fill(0),

    // Public inputs (4 signals)
    recipientWalletPubKey: 1234567890,
    amount: 100,
    tokenId: 1,
    commitment: 7777777777
}
```

## Performance Characteristics

### Circuit Complexity
- **Transfer**: ~215 constraints
- **Deposit**: ~214 constraints
- **Withdraw**: ~215 constraints

### Proof Generation
- **Time**: 2-5 seconds per proof (depending on hardware)
- **Memory**: ~2GB RAM required
- **Proof Size**: ~2.5KB per proof

### Verification
- **Gas Cost**: ~200K gas per verification
- **Time**: <1 second per verification
- **On-chain**: Constant gas cost regardless of circuit complexity

## Build Process

### Generated Files
Each circuit generates:
- `{circuit}.r1cs` - R1CS constraint system
- `{circuit}_js/{circuit}.wasm` - WebAssembly circuit
- `{circuit}.zkey` - Proving key (Groth16)
- `verification_key.json` - Verification key
- `verifier-{circuit}.json` - Renamed verification key for tests

### Build Commands
```bash
# Build all circuits
node scripts/setup.js

# Generate proof for specific circuit
node scripts/generate-proof.js transfer
node scripts/generate-proof.js withdraw
node scripts/generate-proof.js deposit
```

## Troubleshooting

### Common Issues

1. **"circom not found"**
   ```bash
   npm install -g circom
   ```

2. **"snarkjs not found"**
   ```bash
   npm install -g snarkjs
   ```

3. **"WASM file not found"**
   ```bash
   node scripts/setup.js
   ```

4. **"Test timeout"**
   ```bash
   npm test -- --testTimeout=30000
   ```

5. **"Memory issues"**
   ```bash
   node --max-old-space-size=4096 scripts/setup.js
   ```

## Documentation

For detailed documentation, see the `/docs` directory:
- **[Technical Specification](docs/technical-spec.md)** - Complete circuit specifications
- **[Circuit Implementation Guide](docs/circuit-implementation.md)** - Development workflow
- **[Developer Guide](docs/developer-guide.md)** - Getting started guide

## Project Structure

```
cipherpay-circuits/
├── circuits/                    # Circuit implementations
│   ├── transfer/
│   ├── deposit/
│   ├── withdraw/
│   ├── note_commitment/
│   └── nullifier/
├── test/                       # Test files
│   ├── helpers.js
│   ├── circuits.test.js
│   └── proof-generation.test.js
├── scripts/                    # Build scripts
│   ├── setup.js
│   └── generate-proof.js
├── build/                      # Build outputs
├── docs/                       # Documentation
└── package.json
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 