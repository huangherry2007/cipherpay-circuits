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

## Building Circuits

```bash
# Install dependencies
npm install

# Build all circuits
npm run build:all

# Build specific circuit
npm run build:stream  # For zkStream circuit
npm run build:split   # For zkSplit circuit
npm run build:condition  # For zkCondition circuit
```

## Circuit Integration

### Input Format
All circuits expect inputs in the following format:
- Private inputs: Field elements
- Public inputs: Field elements
- Arrays: Fixed-size arrays of field elements

### Output Format
Circuits output:
- Zero-knowledge proofs
- Public signals
- Verification keys

### Chain Integration
To integrate with a specific chain:

1. Build the circuits:
```bash
npm run build:all
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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details
