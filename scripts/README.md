# CipherPay Circuit Scripts

This directory contains utility scripts for building, testing, and managing CipherPay zero-knowledge circuits.

## Scripts Overview

### 1. `setup.js` - Circuit Build and Setup
Builds all core circuits and generates proving/verification keys.

**Usage:**
```bash
nvm use 18   ### must use node v18
npm run setup
npm run generate-proof

```

**What it does:**
- Compiles all core circuits to R1CS format
- Generates WebAssembly files for proof generation
- Creates shared ptau file for all circuits (if needed)
- Creates proving keys (.zkey files) using Groth16
- Exports verification keys for on-chain verification
- Automatically generates ptau files if needed

**Generated files per circuit:**
- `{circuit}.r1cs` - R1CS constraint system
- `{circuit}_js/{circuit}.wasm` - WebAssembly circuit
- `{circuit}_final.zkey` - Final proving key (Groth16)
- `verification_key.json` - Verification key

**Shared files:**
- `pot14_final.ptau` - Shared power of tau file for all circuits

**Circuits built:**
- `deposit` - Public to shielded conversion with Merkle tree integration (6 signals)
- `transfer` - Shielded transfers with encrypted note delivery (9 signals)
- `withdraw` - Shielded to public conversion with identity verification (5 signals)

### 2. `generate-zkey-vk.js` - ZKey and Verification Key Generation
Dedicated script for generating zkey files and verification keys with advanced options.

**Usage:**
```bash
# Generate for specific circuit (called by setup.js)
node scripts/generate-zkey-vk.js deposit

# Generate with custom options
node scripts/generate-zkey-vk.js deposit --ptau-size 16 --no-auto-ptau
```

**Options:**
- `--no-auto-ptau` - Don't auto-generate ptau files
- `--ptau-size <size>` - Set ptau file size (default: 14)
- `--stop-on-error` - Stop processing if any circuit fails

**What it does:**
- Checks for existing R1CS files
- Generates or finds ptau files
- Creates zkey files using Groth16 setup
- Exports verification keys
- Displays verification key information

### 3. `generate-example-proof.js` - Example Proof Generation
Generates zero-knowledge proofs for any core circuit with example inputs.

**Usage:**
```bash
# Generate proof for transfer circuit
node scripts/generate-example-proof.js transfer

# Generate proof for withdraw circuit
node scripts/generate-example-proof.js withdraw

# Generate proof for deposit circuit
node scripts/generate-example-proof.js deposit
```

**Available circuits:**
- `transfer` - Shielded transfers between users
- `withdraw` - Withdrawals from shielded pool
- `deposit` - Deposits into shielded pool with Merkle tree integration

**Generated files:**
- `proof.json` - Zero-knowledge proof
- `public_signals.json` - Public signals for verification

### 4. `convert-vk-to-bin.js` - Verification Key Conversion
Converts JSON verification keys to binary format for Solana on-chain verification.

**Usage:**
```bash
# Convert all circuits
node scripts/convert-vk-to-bin.js --all

# Convert specific circuit
node scripts/convert-vk-to-bin.js --circuit deposit

# Convert with custom options
node scripts/convert-vk-to-bin.js --circuit deposit --endianness le --include-alphabeta
```

**Options:**
- `--all` - Convert all circuits
- `--circuit <name>` - Convert specific circuit
- `--endianness <le|be>` - Set endianness (default: be)
- `--include-alphabeta` - Include vk_alphabeta_12 in output
- `--force` - Bypass validation checks

**What it does:**
- Reads JSON verification keys from `build/{circuit}/verification_key.json`
- Converts BN254 curve points to binary format
- Outputs binary files to `../cipherpay-anchor/src/zk_verifier/{circuit}_vk.bin`
- Supports groth16-solana library format

### 5. `generate-bin-proofs.js` - Binary Proof Generation
Generates binary proof files for Solana integration testing.

**Usage:**
```bash
# Deposit with built-in example inputs
node scripts/generate-bin-proofs.js

# Transfer / Withdraw with built-in example inputs
node scripts/generate-bin-proofs.js transfer
node scripts/generate-bin-proofs.js withdraw

# Use your own input JSON (must match the circuit's signals)
node scripts/generate-bin-proofs.js deposit -i my-deposit-input.json

# Generate all three in one go
node scripts/generate-bin-proofs.js --all
```

**What it does:**
- Generates a deposit proof using example inputs
- Converts proof and public signals to binary format
- Saves binary files to `../cipherpay-anchor/proofs/`
- Creates `deposit_proof.bin` (256 bytes) and `deposit_public_signals.bin` (192 bytes)

**Generated files:**
- `deposit_proof.bin` - Binary Groth16 proof for on-chain verification
- `deposit_public_signals.bin` - Binary public signals (6 signals × 32 bytes)

### 6. `verify-proof.js` - Proof Verification
Verifies zero-knowledge proofs using snarkjs.

**Usage:**
```bash
# Verify proof for specific circuit
node scripts/verify-proof.js deposit

# Verify with custom paths
node scripts/verify-proof.js deposit --proof build/deposit/proof.json --vk build/deposit/verification_key.json
```

**What it does:**
- Loads verification key from JSON file
- Loads proof and public signals
- Verifies the proof using snarkjs
- Reports verification result

### 7. `generate-ptau.js` - Power of Tau Generation
Generates power of tau files for trusted setup ceremonies.

**Usage:**
```bash
# Generate ptau file with default size (14)
node scripts/generate-ptau.js

# Generate with custom size
node scripts/generate-ptau.js --power 16 --out build/
```

**What it does:**
- Generates power of tau files for Groth16 setup
- Creates `pot{power}_final.ptau` files
- Used by other scripts for zkey generation

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

### Deposit Circuit (6 signals)
```javascript
{
    // Private inputs (5 signals)
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
    depositHash: 7777777777 // Poseidon(ownerCipherPayPubKey, amount, nonce)
    
    // Public outputs (4 signals) - automatically generated
    // newCommitment: Shielded note commitment
    // ownerCipherPayPubKey: Derived CipherPay identity  
    // newMerkleRoot: New merkle root after adding commitment
    // newNextLeafIndex: Next leaf index after insertion
}
```

### Withdraw Circuit (5 signals)
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

### 4. Solana Integration
```bash
# Convert verification keys to binary format
node scripts/convert-vk-to-bin.js --all

# Generate binary proof files for testing
node scripts/generate-bin-proofs.js

# Build anchor program with real-crypto feature
cd ../cipherpay-anchor && anchor build -- --features real-crypto
```

### 5. Advanced ZKey Generation
```bash
# Generate zkey and vk for specific circuit with custom options
node scripts/generate-zkey-vk.js deposit --ptau-size 16

# Generate for all circuits with error handling
node scripts/generate-zkey-vk.js --stop-on-error

# Use existing ptau files
node scripts/generate-zkey-vk.js transfer --no-auto-ptau
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
- **Purpose**: Convert public funds to shielded notes with Merkle tree integration
- **Signals**: 46 total (39 private + 3 public + 4 outputs)
- **Key Features**:
  - Privacy-enhanced deposit hash using `ownerCipherPayPubKey`
  - Unique nonce prevents hash collisions
  - Wallet-bound identity derivation
  - Merkle tree path verification and root update
  - Leaf index tracking for tree insertion

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

### Merkle Tree Operations
```javascript
// For deposit circuit
newMerkleRoot = computeMerkleRoot(newCommitment, inPathElements, inPathIndices)
newNextLeafIndex = nextLeafIndex + 1
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
- **Deposit**: ~214 constraints (with Merkle tree)
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

6. **"InvalidZkProof" in Solana tests**
   ```bash
   # Regenerate verification keys
   node scripts/setup.js
   node scripts/convert-vk-to-bin.js --all
   # Rebuild anchor program
   anchor build -- --features real-crypto
   ```

### Build Process
1. **Compilation**: Circuits are compiled to R1CS format
2. **WASM Generation**: JavaScript witness calculators are created
3. **Proving Keys**: Groth16 proving keys are generated (time-intensive)
4. **Verification Keys**: Public verification keys are exported
5. **Binary Conversion**: JSON keys converted to binary for Solana
6. **File Distribution**: Keys are copied to test locations

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