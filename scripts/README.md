# CipherPay Circuit Scripts

This directory contains utility scripts for building, testing, and managing CipherPay zero-knowledge circuits.

## Scripts Overview

### 1. `setup.js` - Circuit Build and Setup
Builds all core circuits and generates proving/verification keys.

**Usage:**
```bash
node scripts/setup.js
```

**What it does:**
- Compiles all core circuits to R1CS format
- Generates WebAssembly files for proof generation
- Creates proving keys (.zkey files) using Groth16
- Exports verification keys for on-chain verification
- Copies verification keys to expected test locations

**Generated files per circuit:**
- `{circuit}.r1cs` - R1CS constraint system
- `{circuit}_js/{circuit}.wasm` - WebAssembly circuit
- `{circuit}.zkey` - Proving key (Groth16)
- `verification_key.json` - Verification key
- `verifier-{circuit}.json` - Renamed verification key for tests

**Circuits built:**
- `transfer` - Shielded transfers with encrypted note delivery (19 signals)
- `deposit` - Public to shielded conversion with privacy binding (8 signals)
- `withdraw` - Shielded to public conversion with identity verification (9 signals)

### 2. `generate-proof.js` - Proof Generation
Generates zero-knowledge proofs for any core circuit.

**Usage:**
```bash
# Generate proof for transfer circuit
node scripts/generate-proof.js transfer

# Generate proof for withdraw circuit
node scripts/generate-proof.js withdraw

# Generate proof for deposit circuit
node scripts/generate-proof.js deposit
```

**Available circuits:**
- `transfer` - Shielded transfers between users
- `withdraw` - Withdrawals from shielded pool
- `deposit` - Deposits into shielded pool

**Generated files:**
- `proof.json` - Zero-knowledge proof
- `public_signals.json` - Public signals for verification

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
    inPathElements: Array(16).fill(0), // Merkle path elements
    inPathIndices: Array(16).fill(0),  // Merkle path indices
    
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
    encryptedNote: 12345678901234567890 // Encrypted note for recipient
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
    depositHash: 7777777777 // Poseidon(ownerCipherPayPubKey, amount, nonce)
}
```

### Withdraw Circuit (9 signals)
```javascript
{
    // Private inputs (5 signals)
    recipientWalletPrivKey: 1111111111,
    randomness: 9876543210,
    memo: 0,
    pathElements: Array(16).fill(0), // Merkle path elements
    pathIndices: Array(16).fill(0),  // Merkle path indices

    // Public inputs (4 signals)
    recipientWalletPubKey: 1234567890,
    amount: 100,
    tokenId: 1,
    commitment: 7777777777 // Note commitment for verification
}
```

## Test Suite

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

### Test Coverage
- **Circuit Structure**: Signal counts and types validation
- **Input Validation**: Correct input formats and constraints
- **Proof Generation**: ZK proof creation and verification
- **Error Handling**: Invalid input rejection
- **Build Verification**: Circuit file generation validation

## Workflow

### 1. Initial Setup
```bash
# Install dependencies
npm install

# Build all circuits and generate keys
node scripts/setup.js
```

### 2. Testing
```bash
# Run comprehensive test suite
npm test

# Test specific circuit
node scripts/generate-proof.js transfer
```

### 3. Development
```bash
# After modifying a circuit, rebuild
node scripts/setup.js

# Test the modified circuit
npm test
```

## Circuit Features

### Transfer Circuit
- **Purpose**: Shielded transfers with encrypted note delivery
- **Signals**: 19 total (18 private + 1 public)
- **Key Features**:
  - Amount conservation: `inAmount === out1Amount + out2Amount`
  - Token consistency: All notes use same token ID
  - Encrypted note delivery for recipient privacy
  - Merkle tree inclusion proof verification

### Deposit Circuit
- **Purpose**: Convert public funds to shielded notes
- **Signals**: 8 total (5 private + 3 public)
- **Key Features**:
  - Privacy-enhanced deposit hash using `ownerCipherPayPubKey`
  - Unique nonce prevents hash collisions
  - Wallet-bound identity derivation

### Withdraw Circuit
- **Purpose**: Convert shielded notes to public funds
- **Signals**: 9 total (5 private + 4 public)
- **Key Features**:
  - Merkle tree inclusion proof verification
  - Commitment reconstruction and validation
  - Wallet-bound identity verification

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

### Build Process
1. **Compilation**: Circuits are compiled to R1CS format
2. **WASM Generation**: JavaScript witness calculators are created
3. **Proving Keys**: Groth16 proving keys are generated (time-intensive)
4. **Verification Keys**: Public verification keys are exported
5. **File Distribution**: Keys are copied to test locations

## Dependencies

- **circom**: Circuit compiler (v2.1.4)
- **snarkjs**: Zero-knowledge proof generation and verification
- **Node.js**: Runtime environment (v16+)
- **npm**: Package manager
- **Jest**: Testing framework

## Documentation

For detailed documentation, see the `/docs` directory:
- **[Technical Specification](../docs/technical-spec.md)** - Complete circuit specifications
- **[Circuit Implementation Guide](../docs/circuit-implementation.md)** - Development workflow
- **[Developer Guide](../docs/developer-guide.md)** - Getting started guide

## License

This project is licensed under the MIT License - see the LICENSE file for details. 