# CipherPay Circuits

Zero-knowledge proof circuits for privacy-preserving payments with wallet-bound identities, encrypted note delivery, and Merkle tree integration.

Usage - refer to package.json

```bash
nvm use 18
npm run setup
npm run convert-vk-to-bin-anchor
npm run copy-keys-to-relayer-and-anchor
npm run copy-proofs-artifacts-to-relayer

npm run generate-proof
npm run generate-bin-proofs

```

## Overview

CipherPay circuits implement privacy-preserving payment functionality using Circom 2.1.4 and the Groth16 proving system. The circuits provide shielded transfers with wallet-bound identities, encrypted note delivery, and Merkle tree integration for enhanced privacy and security.

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

**Purpose**: Convert public funds to shielded notes with Merkle tree integration

- **Signals**: 46 total (39 private + 3 public + 4 outputs)
- **Key Features**:
  - Privacy-enhanced deposit hash using `ownerCipherPayPubKey`
  - Unique nonce prevents hash collisions
  - Wallet-bound identity derivation
  - Merkle tree path verification and root update
  - Leaf index tracking for tree insertion

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
cipherPayPubKey = Poseidon(walletPubKey, walletPrivKey);
```

### Note Commitment

```javascript
commitment = Poseidon(amount, cipherPayPubKey, randomness, tokenId, memo);
```

### Nullifier Generation

```javascript
nullifier = Poseidon(
  ownerWalletPubKey,
  ownerWalletPrivKey,
  randomness,
  tokenId
);
```

### Deposit Hash

```javascript
depositHash = Poseidon(ownerCipherPayPubKey, amount, nonce);
```

### Merkle Tree Operations

```javascript
// For deposit circuit
newMerkleRoot = computeMerkleRoot(newCommitment, inPathElements, inPathIndices);
newNextLeafIndex = nextLeafIndex + 1;
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

# Build circuits (includes ptau generation)
node scripts/setup.js

# Run tests
npm test
```

### Manual Ptau Setup (if needed)

```bash
# Create build directory
mkdir -p build

# Generate ptau files manually
cd build
npx snarkjs powersoftau new bn128 14 pot14_0000.ptau
npx snarkjs powersoftau prepare phase2 pot14_0000.ptau pot14_final.ptau
cd ..

# Build circuits
node scripts/setup.js
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

### Deposit Circuit (46 signals)

```javascript
{
    // Private inputs (39 signals)
    ownerWalletPubKey: 1234567890,
    ownerWalletPrivKey: 1111111111,
    randomness: 9876543210,
    tokenId: 1,
    memo: 0,
    inPathElements: Array(16).fill(0), // Merkle path elements
    inPathIndices: Array(16).fill(0),  // Merkle path indices
    nextLeafIndex: 0,                   // Current next leaf index

    // Public inputs (3 signals)
    nonce: 3333333333,
    amount: 100,
    depositHash: 7777777777,

    // Public outputs (4 signals) - automatically generated
    // newCommitment: Shielded note commitment
    // ownerCipherPayPubKey: Derived CipherPay identity
    // newMerkleRoot: New merkle root after adding commitment
    // newNextLeafIndex: Next leaf index after insertion
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
- **Deposit**: ~4,694 constraints (with Merkle tree)
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

### Power of Tau (Ptau) Files

Before building circuits, you need power of tau files for the Groth16 setup. These files are used to generate proving and verification keys.

#### Generating Ptau Files

```bash
# Create a new power of tau file (only needed once)
cd build
npx snarkjs powersoftau new bn128 14 pot14_0000.ptau

# Contribute to the ceremony (optional, for security)
npx snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau --name="Your Name"

# Prepare phase 2 (required for each circuit)
npx snarkjs powersoftau prepare phase2 pot14_0001.ptau pot14_final.ptau
```

#### Using Existing Ptau Files

If you have existing ptau files, you can use them directly:

```bash
# Copy existing ptau files to build directory
cp /path/to/your/pot14_final.ptau build/pot14_final.ptau
```

#### Ptau File Requirements

- **Size**: Must be large enough for your circuit (14 for most circuits)
- **Curve**: Must use bn128 curve for compatibility
- **Phase**: Must be prepared for phase 2 (final.ptau)

#### Ptau File Management

```bash
# Check ptau file size
npx snarkjs powersoftau info pot14_final.ptau

# Verify ptau file integrity
npx snarkjs powersoftau verify pot14_final.ptau

# List available ptau files
ls -la build/*.ptau
```

#### Best Practices

- **Security**: Use trusted ptau files from public ceremonies
- **Size**: Choose ptau size based on circuit complexity (14 for most, 16+ for large circuits)
- **Storage**: Ptau files can be reused across multiple circuits
- **Backup**: Keep backups of your ptau files

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

# Generate zkey and verification key for specific circuit
node scripts/generate-zkey-vk.js deposit

# Generate proof for specific circuit
node scripts/generate-proof.js transfer
node scripts/generate-proof.js withdraw
node scripts/generate-proof.js deposit

# Convert verification keys to binary format for Solana
node scripts/convert-vk-to-binary.js

# Generate binary proof files for Solana testing
node scripts/generate-binary-proofs.js
```

### Setup Process Details

The `setup.js` script automatically handles ptau file generation if they don't exist:

1. **Compilation**: Circuits compiled to R1CS format
2. **Shared Ptau**: Creates single ptau file shared by all circuits
3. **Proving Keys**: Generates Groth16 proving keys using shared ptau file
4. **Verification Keys**: Exports verification keys for on-chain use
5. **File Distribution**: Copies keys to expected locations

## Solana Integration

### Binary Format Conversion

The circuits support Solana on-chain verification through binary format conversion:

```bash
# Convert JSON verification keys to binary
node scripts/convert-vk-to-binary.js

# Generate binary proof files for testing
node scripts/generate-binary-proofs.js
```

### Generated Binary Files

- `{circuit}_vk.bin` - Binary verification key for groth16-solana
- `deposit_proof.bin` - Binary proof (512 bytes)
- `deposit_public_inputs.bin` - Binary public signals (128 bytes)

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

6. **"InvalidZkProof" in Solana tests**

   ```bash
   # Regenerate verification keys
   node scripts/setup.js
   node scripts/convert-vk-to-binary.js
   # Rebuild anchor program
   anchor build -- --features real-crypto
   ```

7. **"ptau file not found" or "Invalid ptau file"**

   ```bash
   # Regenerate ptau files
   cd build
   npx snarkjs powersoftau new bn128 14 pot14_0000.ptau
   npx snarkjs powersoftau prepare phase2 pot14_0000.ptau pot14_final.ptau
   # Rebuild circuits
   cd .. && node scripts/setup.js
   ```

8. **"ptau file too small"**
   ```bash
   # Use larger ptau file (increase size from 14 to 16 or higher)
   npx snarkjs powersoftau new bn128 16 pot16_0000.ptau
   npx snarkjs powersoftau prepare phase2 pot16_0000.ptau pot16_final.ptau
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
│   ├── generate-zkey-vk.js
│   ├── generate-proof.js
│   ├── verify-proof.js
│   ├── convert-vk-to-binary.js
│   ├── generate-binary-proofs.js
│   └── README.md
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
