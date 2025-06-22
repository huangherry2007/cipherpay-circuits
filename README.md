# CipherPay Circuits

This repository contains the zero-knowledge circuits used by CipherPay for privacy-preserving payments. The circuits are designed to be chain-agnostic and can be used with any blockchain that supports zero-knowledge proofs.

## Circuit Overview

### Core Circuits
- `transfer.circom`: Handles private transfers between users
- `merkle.circom`: Manages Merkle tree operations for note commitments
- `nullifier.circom`: Generates and verifies nullifiers for spent notes

### Specialized Circuits
- `zkStream.circom`: Handles streaming payments with time-based release
- `zkSplit.circom`: Manages payment splitting among multiple recipients
- `zkCondition.circom`: Handles conditional payments with various condition types

### Utility Circuits
- `audit_proof.circom`: Generates audit proofs for compliance
- `withdraw.circom`: Handles withdrawal of funds from private to public

## Circuit Details

### Transfer Circuit (`transfer.circom`)
**Purpose**: Enables private transfers between users with full privacy guarantees.
- **Private Inputs**: Input notes, output notes, recipient, amount, fee, secrets
- **Public Outputs**: New commitments, nullifiers, fee commitment
- **Security**: Prevents double-spending, ensures amount conservation

### Merkle Circuit (`merkle.circom`)
**Purpose**: Verifies Merkle tree membership for note commitments.
- **Private Inputs**: Leaf commitment, Merkle path, path indices
- **Public Outputs**: Merkle root verification
- **Security**: Ensures notes exist in the current state tree

### Nullifier Circuit (`nullifier.circom`)
**Purpose**: Generates unique nullifiers for spent notes.
- **Private Inputs**: Note commitment, secret
- **Public Outputs**: Nullifier hash
- **Security**: Prevents double-spending of notes

### ZK Stream Circuit (`zkStream.circom`)
**Purpose**: Handles streaming payments with time-based release.
- **Private Inputs**: Commitment, recipient, start/end times, current time, amount
- **Public Outputs**: Stream validity, release amount
- **Security**: Ensures time-based conditions are met

### ZK Split Circuit (`zkSplit.circom`)
**Purpose**: Manages payment splitting among multiple recipients.
- **Private Inputs**: Input note, output notes, total amount
- **Public Outputs**: Split validity, individual amounts
- **Security**: Ensures split amounts sum correctly

### ZK Condition Circuit (`zkCondition.circom`)
**Purpose**: Handles conditional payments with various condition types.
- **Private Inputs**: Commitment, condition type, condition data, recipient, amount
- **Public Outputs**: Condition validity, payment eligibility
- **Security**: Supports time-based, event-based, and threshold-based conditions

### Audit Proof Circuit (`audit_proof.circom`)
**Purpose**: Generates audit proofs for compliance requirements.
- **Private Inputs**: Notes, view key, total amount, timestamp
- **Public Outputs**: Audit proof validity
- **Security**: Maintains compliance while preserving privacy

### Withdraw Circuit (`withdraw.circom`)
**Purpose**: Handles withdrawal of funds from private to public addresses.
- **Private Inputs**: Input notes, recipient, amount, fee
- **Public Outputs**: Withdrawal validity, public transfer
- **Security**: Ensures proper withdrawal with fee handling

## Chain-Agnostic Design

The circuits are designed to be chain-agnostic, meaning they can be used with any blockchain that supports zero-knowledge proofs. This is achieved through:

1. **Generic Input/Output Formats**
   - All addresses are treated as field elements
   - No chain-specific data structures
   - Standard cryptographic primitives

2. **Standard Cryptographic Primitives**
   - Poseidon hash function
   - Merkle tree operations
   - Field arithmetic

3. **Flexible Integration Points**
   - Circuits output standard proof formats
   - Verification keys can be used by any chain
   - No chain-specific constraints

## Setup and Build Process

### Prerequisites
- Node.js >= 16.x
- npm or yarn
- Circom compiler
- snarkjs

### Installation
```bash
# Install dependencies
npm install

# Install circom globally (if not already installed)
npm install -g circom

# Install snarkjs globally (if not already installed)
npm install -g snarkjs
```

### Building Circuits
```bash
# Build all circuits and generate keys
npm run setup

# This command will:
# 1. Compile all circuits to R1CS format
# 2. Generate WebAssembly files
# 3. Create proving keys (.zkey files)
# 4. Export verification keys (verifier-*.json files)
# 5. Copy files to all repositories
```

### Generated Files
For each circuit, the following files are generated:
- `{circuit}.r1cs`: R1CS constraint system
- `{circuit}.wasm`: WebAssembly circuit
- `{circuit}.zkey`: Proving key (Groth16)
- `verifier-{circuit}.json`: Verification key

### File Distribution
The setup script automatically copies verification keys to:
- `cipherpay-sdk/src/zk/circuits/`
- `cipherpay-evm/src/zk/circuits/`
- `cipherpay-anchor/src/zk/circuits/`
- `cipherpay-relayer-evm/src/zk/circuits/`
- `cipherpay-relayer-solana/src/zk/circuits/`

## Circuit Integration

### Input Format
All circuits expect inputs in the following format:
- Private inputs: Field elements
- Public inputs: Field elements
- Arrays: Fixed-size arrays of field elements

### Output Format
Circuits output:
- Zero-knowledge proofs (Groth16 format)
- Public signals
- Verification keys

### Chain Integration
To integrate with a specific chain:

1. Build the circuits:
```bash
npm run setup
```

2. Use the generated files:
- `build/*/circuit.wasm`: WebAssembly circuit
- `build/*/circuit.r1cs`: R1CS constraint system
- `build/*/verification_key.json`: Verification key

3. Implement chain-specific verification:
- Import verification keys
- Implement proof verification
- Handle chain-specific transaction formats

## Testing

```bash
# Run all tests
npm test

# Run specific test
npm test -- -t "ZkStream"
```

## Security Considerations

1. **Circuit Security**
   - All circuits are audited for security
   - Standard cryptographic primitives are used
   - No chain-specific security assumptions

2. **Input Validation**
   - All inputs are validated within the circuit
   - No assumptions about input formats
   - Generic validation rules

3. **Output Verification**
   - Standard proof verification
   - Chain-agnostic verification rules
   - No chain-specific verification logic

4. **Trusted Setup**
   - Groth16 trusted setup performed
   - Toxic waste properly destroyed
   - Verification keys distributed securely

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details
