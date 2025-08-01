# CipherPay Technical Specification

## Overview

CipherPay is a privacy-preserving payment protocol built on zero-knowledge proofs (ZKPs). The protocol enables shielded transfers with wallet-bound identities, ensuring privacy while maintaining auditability and compliance.

## Core Architecture

### Zero-Knowledge Proof Circuits

CipherPay uses Circom 2.1.4 to implement the following core circuits:

1. **Transfer Circuit** - Shielded transfers between users
2. **Deposit Circuit** - Converting public funds to shielded notes
3. **Withdraw Circuit** - Converting shielded notes to public funds
4. **Note Commitment Component** - Computing note commitments
5. **Nullifier Component** - Generating nullifiers to prevent double-spending

### Key Design Principles

- **Wallet-Bound Identity**: Users derive CipherPay identities from their wallet keys
- **Privacy by Default**: All transaction details are shielded by default
- **Selective Auditability**: Optional audit trails for compliance
- **Blockchain Agnostic**: Works on any blockchain with elliptic curve cryptography

## Circuit Specifications

### Transfer Circuit

**Purpose**: Enables shielded transfers between users with encrypted note delivery.

**Input Signals** (19 total):
- **Private Inputs** (18):
  - `inAmount`: Input note amount
  - `inSenderWalletPubKey`: Sender's wallet public key
  - `inSenderWalletPrivKey`: Sender's wallet private key
  - `inRandomness`: Input note randomness
  - `inTokenId`: Token identifier
  - `inMemo`: Optional memo
  - `inPathElements[16]`: Merkle path elements
  - `inPathIndices[16]`: Merkle path indices
  - `out1Amount`: Recipient note amount
  - `out1RecipientCipherPayPubKey`: Recipient's CipherPay public key
  - `out1Randomness`: Recipient note randomness
  - `out1TokenId`: Recipient note token ID
  - `out1Memo`: Recipient note memo
  - `out2Amount`: Change note amount
  - `out2SenderCipherPayPubKey`: Sender's change note CipherPay public key
  - `out2Randomness`: Change note randomness
  - `out2TokenId`: Change note token ID
  - `out2Memo`: Change note memo
- **Public Inputs** (1):
  - `encryptedNote`: Encrypted note data for recipient

**Output Signals** (5):
- `inCommitment`: Input note commitment
- `outCommitment1`: Recipient note commitment
- `outCommitment2`: Change note commitment
- `nullifier`: Nullifier to prevent double-spending
- `merkleRoot`: Updated Merkle root

**Key Features**:
- Amount conservation: `inAmount === out1Amount + out2Amount`
- Token consistency: All notes use same token ID
- Encrypted note delivery for recipient privacy
- Merkle tree inclusion proof verification

### Deposit Circuit

**Purpose**: Converts public funds to shielded notes with privacy-enhanced binding.

**Input Signals** (8 total):
- **Private Inputs** (5):
  - `ownerWalletPubKey`: Owner's wallet public key
  - `ownerWalletPrivKey`: Owner's wallet private key
  - `randomness`: Note randomness
  - `tokenId`: Token identifier
  - `memo`: Optional memo
- **Public Inputs** (3):
  - `nonce`: Unique deposit nonce
  - `amount`: Deposit amount
  - `depositHash`: Hash binding owner identity to deposit

**Output Signals** (2):
- `newCommitment`: New shielded note commitment
- `ownerCipherPayPubKey`: Derived CipherPay identity

**Key Features**:
- Privacy-enhanced deposit hash using `ownerCipherPayPubKey`
- Unique nonce prevents hash collisions
- Wallet-bound identity derivation

### Withdraw Circuit

**Purpose**: Converts shielded notes to public funds with identity verification.

**Input Signals** (9 total):
- **Private Inputs** (5):
  - `recipientWalletPrivKey`: Recipient's wallet private key
  - `randomness`: Note randomness
  - `memo`: Optional memo
  - `pathElements[16]`: Merkle path elements
  - `pathIndices[16]`: Merkle path indices
- **Public Inputs** (4):
  - `recipientWalletPubKey`: Recipient's wallet public key
  - `amount`: Withdrawal amount
  - `tokenId`: Token identifier
  - `commitment`: Note commitment for verification

**Output Signals** (2):
- `nullifier`: Nullifier to prevent double-spending
- `merkleRoot`: Updated Merkle root

**Key Features**:
- Merkle tree inclusion proof verification
- Commitment reconstruction and validation
- Wallet-bound identity verification

### Note Commitment Component

**Purpose**: Computes commitments for shielded notes.

**Input Signals** (5):
- `amount`: Note amount
- `cipherPayPubKey`: Owner's CipherPay public key
- `randomness`: Note randomness
- `tokenId`: Token identifier
- `memo`: Optional memo

**Output Signals** (1):
- `commitment`: Note commitment hash

### Nullifier Component

**Purpose**: Generates nullifiers to prevent double-spending.

**Input Signals** (4):
- `ownerWalletPubKey`: Owner's wallet public key
- `ownerWalletPrivKey`: Owner's wallet private key
- `randomness`: Note randomness
- `tokenId`: Token identifier

**Output Signals** (1):
- `nullifier`: Unique nullifier hash

## Cryptographic Primitives

### Identity Derivation

CipherPay identities are derived from wallet keys using Poseidon hash:

```
cipherPayPubKey = Poseidon(walletPubKey, walletPrivKey)
```

This provides:
- **Privacy**: Wallet keys are not directly exposed
- **Uniqueness**: Each wallet has a unique CipherPay identity
- **Verifiability**: Identity can be reconstructed from wallet keys

### Note Commitment

Note commitments use Poseidon hash over note components:

```
commitment = Poseidon(amount, cipherPayPubKey, randomness, tokenId, memo)
```

### Nullifier Generation

Nullifiers prevent double-spending using Poseidon hash:

```
nullifier = Poseidon(ownerWalletPubKey, ownerWalletPrivKey, randomness, tokenId)
```

### Deposit Hash

Deposit hashes bind owner identity to deposit using Poseidon hash:

```
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

## Implementation Details

### Merkle Tree
- **Depth**: 16 levels (supports 2^16 notes)
- **Hash Function**: Poseidon(2) for internal nodes
- **Path Verification**: Standard Merkle inclusion proof

### Field Arithmetic
- **Prime Field**: BN254 scalar field
- **Hash Function**: Poseidon for all cryptographic operations
- **Circuit Constraints**: R1CS format for Groth16 proving system

### Proving System
- **Protocol**: Groth16
- **Trusted Setup**: Power of Tau ceremony
- **Proof Size**: ~2.5KB per proof
- **Verification**: On-chain verification with constant gas cost

## Integration Guidelines

### On-Chain Integration
1. Deploy verification contracts for each circuit
2. Implement note commitment tree management
3. Add nullifier tracking for double-spend prevention
4. Handle encrypted note delivery for recipients

### Client Integration
1. Generate wallet key pairs
2. Derive CipherPay identities
3. Create and manage shielded notes
4. Generate and submit ZK proofs

### Relayer Integration
1. Accept proof submissions from users
2. Verify proofs on-chain
3. Handle gas fee payments
4. Manage encrypted note delivery 