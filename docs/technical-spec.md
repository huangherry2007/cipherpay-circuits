# CipherPay Circuits Technical Specification

## Overview

This document provides technical specifications for CipherPay's zero-knowledge circuits. The circuits are designed to be chain-agnostic and implement various privacy-preserving payment functionalities.

## Circuit Specifications

### 1. Transfer Circuit

#### Inputs
- Private:
  - `inAmount`: Field element
  - `inNullifier`: Field element
  - `inSecret`: Field element
  - `inPathElements[32]`: Array of field elements
  - `inPathIndices[32]`: Array of field elements
- Public:
  - `outCommitment`: Field element
  - `merkleRoot`: Field element
  - `recipientPubKey`: Field element

#### Outputs
- `isValid`: Boolean
- `outNullifier`: Field element

#### Constraints
- Input amount must be positive
- Merkle path must be valid
- Nullifier must be unique
- Commitment must be valid

### 2. ZkStream Circuit

#### Inputs
- Private:
  - `totalAmount`: Field element
  - `startTime`: Field element
  - `endTime`: Field element
  - `currentTime`: Field element
  - `streamSecret`: Field element
  - `streamId`: Field element
- Public:
  - `recipientAddress`: Field element
  - `merkleRoot`: Field element
  - `streamCommitment`: Field element

#### Outputs
- `isValid`: Boolean
- `availableAmount`: Field element

#### Constraints
- Time constraints must be valid
- Commitment must be valid
- Amount calculation must be correct

### 3. ZkSplit Circuit

#### Inputs
- Private:
  - `totalAmount`: Field element
  - `splitSecret`: Field element
  - `splitId`: Field element
  - `numRecipients`: Field element
- Public:
  - `recipientAddresses[10]`: Array of field elements
  - `splitAmounts[10]`: Array of field elements
  - `merkleRoot`: Field element
  - `splitCommitment`: Field element

#### Outputs
- `isValid`: Boolean

#### Constraints
- Total amount must match sum of splits
- All amounts must be positive
- All recipients must be valid
- Commitment must be valid

### 4. ZkCondition Circuit

#### Inputs
- Private:
  - `amount`: Field element
  - `conditionSecret`: Field element
  - `conditionId`: Field element
  - `conditionType`: Field element
  - `conditionValue`: Field element
  - `currentValue`: Field element
- Public:
  - `recipientAddress`: Field element
  - `merkleRoot`: Field element
  - `conditionCommitment`: Field element

#### Outputs
- `isValid`: Boolean
- `isConditionMet`: Boolean

#### Constraints
- Condition type must be valid
- Condition value must be valid
- Commitment must be valid
- Amount must be positive

## Cryptographic Primitives

### 1. Poseidon Hash
- Used for commitment generation
- Used for nullifier generation
- Used for Merkle tree operations

### 2. Merkle Tree
- 32-level Merkle tree
- Poseidon hash for node hashing
- Binary tree structure

### 3. Field Arithmetic
- Field size: 21888242871839275222246405745257275088548364400416034343698204186575808495617
- Prime field operations
- Efficient field arithmetic

## Security Considerations

### 1. Circuit Security
- Constant-time operations
- No timing side-channels
- No memory side-channels

### 2. Cryptographic Security
- Secure hash function
- Secure commitment scheme
- Secure nullifier scheme

### 3. Input Validation
- All inputs are validated
- No assumptions about input formats
- Generic validation rules

## Performance Considerations

### 1. Circuit Size
- Optimized for minimal constraints
- Efficient field arithmetic
- Minimal memory usage

### 2. Proof Generation
- Efficient proof generation
- Minimal memory usage
- Optimized for batch processing

### 3. Verification
- Efficient verification
- Minimal gas usage
- Optimized for chain-specific requirements

## Integration Guidelines

### 1. Circuit Integration
- Use standard interfaces
- Follow chain-specific requirements
- Implement proper error handling

### 2. Proof Generation
- Use efficient proof generation
- Optimize for chain-specific requirements
- Handle errors properly

### 3. Verification
- Use chain-specific verification
- Optimize for gas usage
- Handle errors properly

## Testing Guidelines

### 1. Unit Testing
- Test individual components
- Test edge cases
- Test error cases

### 2. Integration Testing
- Test end-to-end flow
- Test chain-specific features
- Test error scenarios

### 3. Performance Testing
- Test circuit size
- Test proof generation
- Test verification

## Future Improvements

### 1. Circuit Optimizations
- Reduce circuit size
- Improve proof generation
- Optimize verification

### 2. Feature Additions
- Add new circuit types
- Add new features
- Add new optimizations

### 3. Security Improvements
- Add new security features
- Improve existing security
- Add new security checks 