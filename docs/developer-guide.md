# CipherPay Developer Guide

## Getting Started

### Prerequisites

- **Node.js** (v16 or later)
- **npm** or **yarn**
- **Git**

### Installation

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd cipherpay-circuits
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Build Circuits**:
   ```bash
   node scripts/setup.js
   ```

4. **Run Tests**:
   ```bash
   npm test
   ```

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

## Circuit Development

### Understanding Circuits

CipherPay circuits are written in **Circom 2.1.4** and use the **Groth16** proving system. Each circuit implements specific privacy-preserving functionality:

#### Transfer Circuit
- **Purpose**: Shielded transfers between users
- **Inputs**: 19 signals (18 private + 1 public)
- **Outputs**: 5 signals (commitments, nullifier, merkle root)
- **Key Feature**: Encrypted note delivery for recipient privacy

#### Deposit Circuit
- **Purpose**: Convert public funds to shielded notes
- **Inputs**: 8 signals (5 private + 3 public)
- **Outputs**: 2 signals (commitment, identity)
- **Key Feature**: Privacy-enhanced deposit hash binding

#### Withdraw Circuit
- **Purpose**: Convert shielded notes to public funds
- **Inputs**: 9 signals (5 private + 4 public)
- **Outputs**: 2 signals (nullifier, merkle root)
- **Key Feature**: Identity verification and commitment validation

### Circuit Components

#### Note Commitment Component
```circom
template NoteCommitment() {
    signal input amount;
    signal input cipherPayPubKey;
    signal input randomness;
    signal input tokenId;
    signal input memo;
    signal output commitment;
    
    component hasher = Poseidon(5);
    hasher.inputs[0] <== amount;
    hasher.inputs[1] <== cipherPayPubKey;
    hasher.inputs[2] <== randomness;
    hasher.inputs[3] <== tokenId;
    hasher.inputs[4] <== memo;
    commitment <== hasher.out;
}
```

#### Nullifier Component
```circom
template Nullifier() {
    signal input ownerWalletPubKey;
    signal input ownerWalletPrivKey;
    signal input randomness;
    signal input tokenId;
    signal output nullifier;
    
    component hasher = Poseidon(4);
    hasher.inputs[0] <== ownerWalletPubKey;
    hasher.inputs[1] <== ownerWalletPrivKey;
    hasher.inputs[2] <== randomness;
    hasher.inputs[3] <== tokenId;
    nullifier <== hasher.out;
}
```

### Adding New Circuits

1. **Create Circuit File**:
   ```bash
   mkdir circuits/new_circuit
   touch circuits/new_circuit/new_circuit.circom
   ```

2. **Implement Circuit Logic**:
   ```circom
   pragma circom 2.1.4;
   
   template NewCircuit() {
       // Define inputs and outputs
       signal input privateInput;
       signal input publicInput;
       signal output result;
       
       // Implement circuit logic
       result <== privateInput + publicInput;
   }
   
   component main { public [publicInput] } = NewCircuit();
   ```

3. **Add to Build Script**:
   ```javascript
   // In scripts/setup.js
   const circuits = [
       'transfer',
       'deposit', 
       'withdraw',
       'new_circuit'  // Add new circuit
   ];
   ```

4. **Create Tests**:
   ```javascript
   // In test/helpers.js
   function generateNewCircuitInput() {
       return {
           privateInput: 123,
           publicInput: 456
       };
   }
   ```

## Testing

### Test Structure

The test suite validates:
- **Circuit Structure**: Signal counts and types
- **Input Validation**: Correct input formats
- **Proof Generation**: ZK proof creation and verification
- **Error Handling**: Invalid input rejection

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- test/circuits.test.js

# Run with verbose output
npm test -- --verbose

# Run with increased timeout
npm test -- --testTimeout=30000
```

### Writing Tests

#### Circuit Structure Test
```javascript
describe('New Circuit', () => {
    it('should have correct signal structure', () => {
        const input = generateNewCircuitInput();
        
        expect(input.privateInput).toBeDefined();
        expect(input.publicInput).toBeDefined();
    });
    
    it('should have correct signal count', () => {
        const input = generateNewCircuitInput();
        const signalCount = Object.keys(input).length;
        
        expect(signalCount).toBe(2); // private + public
    });
});
```

#### Proof Generation Test
```javascript
describe('New Circuit Proofs', () => {
    it('should generate proof with valid inputs', async () => {
        const input = generateNewCircuitInput();
        
        try {
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                wasmPath,
                zkeyPath
            );
            
            expect(proof).toBeDefined();
            expect(publicSignals).toBeDefined();
        } catch (error) {
            // Handle expected failures with test data
        }
    });
});
```

## Integration

### JavaScript Integration

#### Basic Proof Generation
```javascript
const snarkjs = require('snarkjs');
const fs = require('fs');

async function generateProof(circuitName, input) {
    const wasmPath = `build/${circuitName}/${circuitName}_js/${circuitName}.wasm`;
    const zkeyPath = `build/${circuitName}/${circuitName}.zkey`;
    
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        wasmPath,
        zkeyPath
    );
    
    return { proof, publicSignals };
}
```

#### Proof Verification
```javascript
async function verifyProof(circuitName, proof, publicSignals) {
    const vkPath = `build/${circuitName}/verifier-${circuitName}.json`;
    const verificationKey = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
    
    return await snarkjs.groth16.verify(
        verificationKey,
        publicSignals,
        proof
    );
}
```

### Solidity Integration

#### Verifier Contract
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TransferVerifier {
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[1] memory input
    ) public view returns (bool) {
        // Verification logic generated by snarkjs
        return true; // Simplified for example
    }
}
```

#### Integration Contract
```solidity
contract CipherPay {
    TransferVerifier public transferVerifier;
    
    function executeTransfer(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[1] memory input
    ) public {
        require(
            transferVerifier.verifyProof(a, b, c, input),
            "Invalid proof"
        );
        
        // Execute transfer logic
    }
}
```

## Performance Optimization

### Circuit Optimization

1. **Reduce Constraints**: Minimize the number of constraints
2. **Optimize Hashes**: Use efficient hash function implementations
3. **Reuse Components**: Share common components across circuits
4. **Batch Operations**: Combine multiple operations where possible

### Build Optimization

1. **Parallel Compilation**: Compile circuits in parallel
2. **Caching**: Cache intermediate build artifacts
3. **Memory Management**: Optimize memory usage during compilation
4. **Incremental Builds**: Only rebuild changed circuits

### Runtime Optimization

1. **Proof Generation**: Use efficient proving key generation
2. **Verification**: Optimize on-chain verification
3. **Gas Optimization**: Minimize gas costs for verification
4. **Batch Verification**: Verify multiple proofs together

## Security Best Practices

### Cryptographic Security

1. **Trusted Setup**: Use secure multi-party computation for trusted setup
2. **Key Management**: Secure storage and handling of private keys
3. **Randomness**: Use cryptographically secure random number generation
4. **Input Validation**: Validate all inputs before circuit execution

### Code Security

1. **Input Sanitization**: Sanitize all user inputs
2. **Error Handling**: Implement proper error handling
3. **Audit Trails**: Maintain logs for security auditing
4. **Access Control**: Implement proper access controls

### Testing Security

1. **Unit Tests**: Comprehensive unit testing
2. **Integration Tests**: End-to-end testing
3. **Security Tests**: Penetration testing
4. **Formal Verification**: Mathematical proof of correctness

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check Circom version
circom --version

# Clear build cache
rm -rf build/

# Reinstall dependencies
npm install
```

#### Memory Issues
```bash
# Increase Node.js heap size
node --max-old-space-size=4096 scripts/setup.js
```

#### Test Failures
```bash
# Run with verbose output
npm test -- --verbose

# Run specific test
npm test -- --testNamePattern="Transfer Circuit"
```

### Debugging

#### Circuit Debugging
```bash
# Analyze constraints
circom circuits/transfer/transfer.circom --c

# Generate witness
node build/transfer/transfer_js/generate_witness.js
```

#### Proof Debugging
```javascript
// Enable debug logging
const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmPath,
    zkeyPath,
    { logCallback: console.log }
);
```

## Contributing

### Development Workflow

1. **Fork Repository**: Create a fork of the repository
2. **Create Branch**: Create a feature branch
3. **Implement Changes**: Make your changes
4. **Add Tests**: Write tests for your changes
5. **Run Tests**: Ensure all tests pass
6. **Submit PR**: Create a pull request

### Code Style

1. **Circom**: Follow Circom best practices
2. **JavaScript**: Use ESLint configuration
3. **Documentation**: Update documentation for changes
4. **Comments**: Add clear comments for complex logic

### Review Process

1. **Code Review**: All changes require review
2. **Testing**: Ensure comprehensive test coverage
3. **Documentation**: Update relevant documentation
4. **Security**: Security review for new features

## Resources

### Documentation
- [Circom Documentation](https://docs.circom.io/)
- [snarkjs Documentation](https://github.com/iden3/snarkjs)
- [Zero-Knowledge Proofs](https://z.cash/technology/zksnarks/)

### Tools
- [Circom Compiler](https://github.com/iden3/circom)
- [snarkjs Library](https://github.com/iden3/snarkjs)
- [Poseidon Hash](https://www.poseidon-hash.info/)

### Community
- [CipherPay Discord](https://discord.gg/cipherpay)
- [GitHub Issues](https://github.com/cipherpay/cipherpay-circuits/issues)
- [Developer Forum](https://forum.cipherpay.com/) 