# CipherPay Circuits Documentation

This directory contains comprehensive documentation for the CipherPay zero-knowledge proof circuits.

## Documentation Overview

### 📋 [Technical Specification](technical-spec.md)
**Complete technical reference for CipherPay circuits**

- Circuit specifications and signal structures
- Cryptographic primitives and security properties
- Implementation details and integration guidelines
- Security considerations and best practices

**Key Sections:**
- Transfer, Deposit, and Withdraw circuit details
- Note Commitment and Nullifier components
- Identity derivation and cryptographic primitives
- Security properties and auditability features

### 🔧 [Circuit Implementation Guide](circuit-implementation.md)
**Detailed guide for working with CipherPay circuits**

- Circuit structure and file organization
- Build process and testing procedures
- Integration examples and performance considerations
- Troubleshooting and debugging techniques

**Key Sections:**
- Circuit development workflow
- JavaScript and Solidity integration
- Performance optimization strategies
- Security best practices

### 👨‍💻 [Developer Guide](developer-guide.md)
**Comprehensive guide for developers**

- Getting started and project setup
- Circuit development and testing
- Integration patterns and examples
- Contributing guidelines and resources

**Key Sections:**
- Installation and project structure
- Circuit development workflow
- Testing strategies and examples
- Performance and security considerations

## Quick Start

### For New Developers
1. Start with the **[Developer Guide](developer-guide.md)** for setup and basic concepts
2. Review the **[Technical Specification](technical-spec.md)** for detailed circuit information
3. Use the **[Circuit Implementation Guide](circuit-implementation.md)** for advanced topics

### For Integration
1. Review the **[Technical Specification](technical-spec.md)** for circuit interfaces
2. Follow the **[Circuit Implementation Guide](circuit-implementation.md)** for integration examples
3. Use the **[Developer Guide](developer-guide.md)** for troubleshooting

### For Circuit Development
1. Study the **[Technical Specification](technical-spec.md)** for design principles
2. Follow the **[Circuit Implementation Guide](circuit-implementation.md)** for development workflow
3. Use the **[Developer Guide](developer-guide.md)** for testing and debugging

## Circuit Summary

### Core Circuits
- **Deposit Circuit**: Public to shielded conversion with privacy binding (6 signals)
- **Transfer Circuit**: Shielded transfers with encrypted note delivery (9 signals)
- **Withdraw Circuit**: Shielded to public conversion with identity verification (5 signals)

### Components
- **Note Commitment**: Reusable component for note commitment computation (5 signals)
- **Nullifier**: Reusable component for nullifier generation (4 signals)

### Key Features
- **Wallet-Bound Identity**: Derived from wallet keys using Poseidon hash
- **Privacy by Default**: All transaction details are shielded
- **Encrypted Notes**: Recipient privacy through encrypted note delivery
- **Merkle Tree Verification**: 16-level Merkle tree for note inclusion proofs
- **Amount Conservation**: Mathematical constraints prevent value creation

## Documentation Standards

### Accuracy
- All documentation reflects current circuit implementations
- Signal counts and structures match actual circuits
- Examples use correct input/output formats

### Completeness
- Comprehensive coverage of all circuit functionality
- Integration examples for multiple platforms
- Troubleshooting guides for common issues

### Maintainability
- Clear structure and organization
- Consistent formatting and style
- Regular updates with circuit changes

## Contributing to Documentation

### Adding New Documentation
1. Create new markdown file in appropriate location
2. Follow existing formatting and style guidelines
3. Update this README with new file reference
4. Ensure accuracy and completeness

### Updating Existing Documentation
1. Verify changes against current circuit implementations
2. Update signal counts and structures as needed
3. Test examples and code snippets
4. Maintain consistency across all documents

### Documentation Review
1. Technical accuracy review
2. Completeness and clarity review
3. Integration example testing
4. User experience validation

## Resources

### External Links
- [Circom Documentation](https://docs.circom.io/)
- [snarkjs Documentation](https://github.com/iden3/snarkjs)
- [Zero-Knowledge Proofs](https://z.cash/technology/zksnarks/)

### Internal References
- [Circuit Source Code](../circuits/)
- [Test Suite](../test/)
- [Build Scripts](../scripts/)

### Community
- [GitHub Issues](https://github.com/cipherpay/cipherpay-circuits/issues)
- [Developer Forum](https://forum.cipherpay.com/)
- [Discord Community](https://discord.gg/cipherpay)

---

**Last Updated**: Current implementation reflects CipherPay circuits v2.0
**Circuit Version**: Circom 2.1.4 with Groth16 proving system
**Test Status**: All 28 tests passing with clean test suite 