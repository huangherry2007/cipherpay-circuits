# CipherPay Circuits

Zero-knowledge circuits used across the CipherPay protocol for shielded transfers, proof-of-payment, and privacy-preserving flows.

## Circuits

### `transfer.circom`
Base private transfer circuit (zk-SNARK, Groth16)
- Inputs: sender note, nullifier, Merkle path, recipient commitment
- Output: zk-proof submitted to CipherPay program

### Future
- `split.circom`, `stream.circom`, `audit.circom`

## Structure
```
cipherpay-circuits/
├── circuits/
│   ├── transfer.circom
│   └── helpers.circom
├── input.json
├── scripts/
│   ├── build.sh
│   ├── generate_proof.sh
├── verifier/
│   └── verifier.sol (for EVM)
│   └── verifier.rs (for Solana)
```

## Commands
```bash
bash scripts/build.sh
bash scripts/generate_proof.sh
```

## Dependencies
- Circom 2.x
- snarkjs

## License
MIT © AppFounder Corp.
