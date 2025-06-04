# Chain Integration Guide

This guide explains how to integrate CipherPay circuits with different blockchains.

## Overview

CipherPay circuits are designed to be chain-agnostic, but each blockchain has its own specific requirements for:
- Proof verification
- Transaction formatting
- Gas optimization
- Smart contract integration

## Supported Chains

### Ethereum
1. **Verification Contract**
   ```solidity
   // Example verification contract interface
   interface ICipherPayVerifier {
       function verifyProof(
           uint256[2] memory a,
           uint256[2][2] memory b,
           uint256[2] memory c,
           uint256[] memory input
       ) external view returns (bool);
   }
   ```

2. **Gas Optimization**
   - Use efficient field arithmetic
   - Optimize proof verification
   - Batch proofs when possible

### Solana
1. **Verification Program**
   ```rust
   // Example Solana verification program
   use solana_program::{
       account_info::AccountInfo,
       entrypoint,
       entrypoint::ProgramResult,
       pubkey::Pubkey,
   };

   #[derive(AnchorSerialize, AnchorDeserialize)]
   pub struct VerifyProofArgs {
       pub proof_a: [u8; 64],
       pub proof_b: [u8; 128],
       pub proof_c: [u8; 64],
       pub public_inputs: Vec<u8>,
   }

   #[program]
   pub mod cipherpay_verifier {
       pub fn verify_proof(
           ctx: Context<VerifyProof>,
           args: VerifyProofArgs,
       ) -> ProgramResult {
           // Implement verification logic
           Ok(())
       }
   }
   ```

2. **Performance Optimization**
   - Use Solana's parallel transaction processing
   - Optimize for Solana's compute budget
   - Utilize Solana's account model efficiently

3. **Integration Considerations**
   - Use Solana's native program model
   - Handle Solana's account rent
   - Implement proper error handling for Solana's runtime

4. **Detailed Implementation Example**
   ```rust
   use anchor_lang::prelude::*;
   use anchor_lang::solana_program::system_program;

   #[program]
   pub mod cipherpay_verifier {
       pub fn initialize_verifier(
           ctx: Context<InitializeVerifier>,
           merkle_root: [u8; 32],
       ) -> Result<()> {
           let verifier_state = &mut ctx.accounts.verifier_state;
           verifier_state.merkle_root = merkle_root;
           verifier_state.authority = ctx.accounts.authority.key();
           Ok(())
       }

       pub fn verify_transfer_proof(
           ctx: Context<VerifyTransfer>,
           proof: VerifyProofArgs,
           amount: u64,
           recipient: Pubkey,
       ) -> Result<()> {
           // Verify the proof
           verify_proof_internal(&proof)?;
           
           // Update state
           let verifier_state = &mut ctx.accounts.verifier_state;
           verifier_state.last_verified_proof = proof.proof_a;
           
           // Emit event
           emit!(ProofVerified {
               amount,
               recipient,
               timestamp: Clock::get()?.unix_timestamp,
           });
           
           Ok(())
       }
   }

   #[derive(Accounts)]
   pub struct InitializeVerifier<'info> {
       #[account(
           init,
           payer = authority,
           space = 8 + VerifierState::LEN
       )]
       pub verifier_state: Account<'info, VerifierState>,
       #[account(mut)]
       pub authority: Signer<'info>,
       pub system_program: Program<'info, System>,
   }

   #[derive(Accounts)]
   pub struct VerifyTransfer<'info> {
       #[account(mut)]
       pub verifier_state: Account<'info, VerifierState>,
       pub system_program: Program<'info, System>,
   }

   #[account]
   pub struct VerifierState {
       pub merkle_root: [u8; 32],
       pub authority: Pubkey,
       pub last_verified_proof: [u8; 64],
   }

   impl VerifierState {
       pub const LEN: usize = 32 + 32 + 64;
   }

   #[event]
   pub struct ProofVerified {
       pub amount: u64,
       pub recipient: Pubkey,
       pub timestamp: i64,
   }
   ```

5. **Client Integration**
   ```typescript
   // Example TypeScript client integration
   import { Connection, PublicKey, Transaction } from '@solana/web3.js';
   import { Program, AnchorProvider } from '@project-serum/anchor';
   import { CipherpayVerifier } from './types/cipherpay_verifier';

   export class CipherPaySolanaClient {
       constructor(
           private connection: Connection,
           private program: Program<CipherpayVerifier>,
           private provider: AnchorProvider
       ) {}

       async verifyTransfer(
           proof: {
               proofA: Buffer;
               proofB: Buffer;
               proofC: Buffer;
               publicInputs: Buffer;
           },
           amount: number,
           recipient: PublicKey
       ): Promise<string> {
           const tx = await this.program.methods
               .verifyTransferProof(
                   proof.proofA,
                   proof.proofB,
                   proof.proofC,
                   proof.publicInputs,
                   new BN(amount),
                   recipient
               )
               .accounts({
                   verifierState: this.verifierState,
                   systemProgram: SystemProgram.programId,
               })
               .rpc();

           return tx;
       }

       async getVerifierState(): Promise<VerifierState> {
           return await this.program.account.verifierState.fetch(
               this.verifierState
           );
       }
   }
   ```

6. **Error Handling**
   ```rust
   #[error_code]
   pub enum CipherPayError {
       #[msg("Invalid proof format")]
       InvalidProofFormat,
       #[msg("Proof verification failed")]
       ProofVerificationFailed,
       #[msg("Insufficient compute budget")]
       InsufficientComputeBudget,
       #[msg("Invalid merkle root")]
       InvalidMerkleRoot,
   }

   fn verify_proof_internal(proof: &VerifyProofArgs) -> Result<()> {
       // Check compute budget
       let compute_budget = ComputeBudget::get()?;
       if compute_budget.remaining < REQUIRED_COMPUTE_UNITS {
           return err!(CipherPayError::InsufficientComputeBudget);
       }

       // Verify proof format
       if !is_valid_proof_format(proof) {
           return err!(CipherPayError::InvalidProofFormat);
       }

       // Perform verification
       if !verify_proof(proof) {
           return err!(CipherPayError::ProofVerificationFailed);
       }

       Ok(())
   }
   ```

7. **Testing**
   ```typescript
   // Example test suite
   import * as anchor from '@project-serum/anchor';
   import { Program } from '@project-serum/anchor';
   import { CipherpayVerifier } from '../target/types/cipherpay_verifier';

   describe('cipherpay-verifier', () => {
       const provider = anchor.AnchorProvider.env();
       anchor.setProvider(provider);

       const program = anchor.workspace.CipherpayVerifier as Program<CipherpayVerifier>;

       it('Initializes verifier state', async () => {
           const merkleRoot = Buffer.alloc(32);
           const tx = await program.methods
               .initializeVerifier(merkleRoot)
               .accounts({
                   verifierState: verifierState,
                   authority: provider.wallet.publicKey,
                   systemProgram: anchor.web3.SystemProgram.programId,
               })
               .rpc();

           const state = await program.account.verifierState.fetch(verifierState);
           assert.ok(state.merkleRoot.equals(merkleRoot));
       });

       it('Verifies transfer proof', async () => {
           const proof = generateTestProof();
           const tx = await program.methods
               .verifyTransferProof(
                   proof.proofA,
                   proof.proofB,
                   proof.proofC,
                   proof.publicInputs,
                   new anchor.BN(1000),
                   recipient
               )
               .accounts({
                   verifierState: verifierState,
                   systemProgram: anchor.web3.SystemProgram.programId,
               })
               .rpc();

           // Verify transaction success
           const txInfo = await provider.connection.getTransaction(tx);
           assert.ok(txInfo.meta.err === null);
       });
   });
   ```

8. **Circuit-Specific Verifications**
   ```rust
   // Example of specialized circuit verifications
   #[program]
   pub mod cipherpay_verifier {
       // ... existing code ...

       pub fn verify_stream_proof(
           ctx: Context<VerifyStream>,
           proof: VerifyProofArgs,
           stream_params: StreamParams,
       ) -> Result<()> {
           // Verify compute budget
           check_compute_budget(StreamVerification::REQUIRED_UNITS)?;
           
           // Verify proof
           verify_proof_internal(&proof)?;
           
           // Verify stream parameters
           verify_stream_params(&stream_params)?;
           
           // Update state
           let stream_state = &mut ctx.accounts.stream_state;
           stream_state.last_verified_time = Clock::get()?.unix_timestamp;
           stream_state.total_verified = stream_state.total_verified.checked_add(1)
               .ok_or(CipherPayError::ArithmeticOverflow)?;
           
           emit!(StreamProofVerified {
               stream_id: stream_params.stream_id,
               timestamp: Clock::get()?.unix_timestamp,
           });
           
           Ok(())
       }

       pub fn verify_split_proof(
           ctx: Context<VerifySplit>,
           proof: VerifyProofArgs,
           split_params: SplitParams,
       ) -> Result<()> {
           // Verify compute budget
           check_compute_budget(SplitVerification::REQUIRED_UNITS)?;
           
           // Verify proof
           verify_proof_internal(&proof)?;
           
           // Verify split parameters
           verify_split_params(&split_params)?;
           
           // Update state
           let split_state = &mut ctx.accounts.split_state;
           split_state.last_verified_time = Clock::get()?.unix_timestamp;
           
           emit!(SplitProofVerified {
               split_id: split_params.split_id,
               num_recipients: split_params.recipients.len() as u8,
               timestamp: Clock::get()?.unix_timestamp,
           });
           
           Ok(())
       }
   }

   #[derive(AnchorSerialize, AnchorDeserialize)]
   pub struct StreamParams {
       pub stream_id: [u8; 32],
       pub start_time: i64,
       pub end_time: i64,
       pub total_amount: u64,
   }

   #[derive(AnchorSerialize, AnchorDeserialize)]
   pub struct SplitParams {
       pub split_id: [u8; 32],
       pub recipients: Vec<Pubkey>,
       pub amounts: Vec<u64>,
   }

   #[account]
   pub struct StreamState {
       pub last_verified_time: i64,
       pub total_verified: u64,
       pub merkle_root: [u8; 32],
   }

   #[account]
   pub struct SplitState {
       pub last_verified_time: i64,
       pub merkle_root: [u8; 32],
   }
   ```

9. **Compute Budget Optimization**
   ```rust
   // Compute budget management
   pub struct ComputeBudgetManager {
       pub required_units: u32,
       pub max_units: u32,
   }

   impl ComputeBudgetManager {
       pub fn new(required_units: u32) -> Self {
           Self {
               required_units,
               max_units: 200_000, // Solana's default max
           }
       }

       pub fn check_budget(&self) -> Result<()> {
           let compute_budget = ComputeBudget::get()?;
           if compute_budget.remaining < self.required_units {
               return err!(CipherPayError::InsufficientComputeBudget);
           }
           Ok(())
       }

       pub fn optimize_verification(&self, proof: &VerifyProofArgs) -> Result<()> {
           // Check if proof can be verified within budget
           let estimated_units = self.estimate_verification_units(proof);
           if estimated_units > self.max_units {
               return err!(CipherPayError::ProofTooComplex);
           }

           // Optimize proof verification
           self.optimize_proof_verification(proof)?;
           Ok(())
       }

       fn estimate_verification_units(&self, proof: &VerifyProofArgs) -> u32 {
           // Estimate compute units based on proof complexity
           let base_units = 100_000;
           let proof_size_units = (proof.proof_a.len() + proof.proof_b.len() + proof.proof_c.len()) as u32 * 100;
           base_units + proof_size_units
       }

       fn optimize_proof_verification(&self, proof: &VerifyProofArgs) -> Result<()> {
           // Implement proof-specific optimizations
           Ok(())
       }
   }
   ```

10. **Enhanced Client Utilities**
    ```typescript
    // Enhanced client utilities
    export class CipherPaySolanaClient {
        // ... existing code ...

        async verifyStreamProof(
            proof: VerifyProofArgs,
            streamParams: StreamParams
        ): Promise<string> {
            // Optimize compute budget
            await this.optimizeComputeBudget(StreamVerification.REQUIRED_UNITS);

            const tx = await this.program.methods
                .verifyStreamProof(proof, streamParams)
                .accounts({
                    streamState: this.streamState,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            return tx;
        }

        async verifySplitProof(
            proof: VerifyProofArgs,
            splitParams: SplitParams
        ): Promise<string> {
            // Optimize compute budget
            await this.optimizeComputeBudget(SplitVerification.REQUIRED_UNITS);

            const tx = await this.program.methods
                .verifySplitProof(proof, splitParams)
                .accounts({
                    splitState: this.splitState,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            return tx;
        }

        private async optimizeComputeBudget(requiredUnits: number): Promise<void> {
            const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
                units: requiredUnits
            });

            const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
                microLamports: 1000
            });

            await this.provider.sendAndConfirm(
                new Transaction().add(modifyComputeUnits).add(addPriorityFee)
            );
        }

        async getStreamState(): Promise<StreamState> {
            return await this.program.account.streamState.fetch(this.streamState);
        }

        async getSplitState(): Promise<SplitState> {
            return await this.program.account.splitState.fetch(this.splitState);
        }
    }
    ```

11. **Additional Test Cases**
    ```typescript
    // Additional test cases
    describe('cipherpay-verifier', () => {
        // ... existing code ...

        it('Verifies stream proof with valid parameters', async () => {
            const proof = generateTestProof();
            const streamParams = {
                streamId: Buffer.alloc(32),
                startTime: new anchor.BN(Date.now() / 1000),
                endTime: new anchor.BN(Date.now() / 1000 + 3600),
                totalAmount: new anchor.BN(1000)
            };

            const tx = await program.methods
                .verifyStreamProof(proof, streamParams)
                .accounts({
                    streamState: streamState,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            const txInfo = await provider.connection.getTransaction(tx);
            assert.ok(txInfo.meta.err === null);

            const state = await program.account.streamState.fetch(streamState);
            assert.ok(state.totalVerified.eq(new anchor.BN(1)));
        });

        it('Verifies split proof with multiple recipients', async () => {
            const proof = generateTestProof();
            const splitParams = {
                splitId: Buffer.alloc(32),
                recipients: [
                    new anchor.web3.PublicKey('11111111111111111111111111111111'),
                    new anchor.web3.PublicKey('22222222222222222222222222222222')
                ],
                amounts: [new anchor.BN(500), new anchor.BN(500)]
            };

            const tx = await program.methods
                .verifySplitProof(proof, splitParams)
                .accounts({
                    splitState: splitState,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            const txInfo = await provider.connection.getTransaction(tx);
            assert.ok(txInfo.meta.err === null);
        });

        it('Handles compute budget errors', async () => {
            const proof = generateLargeProof(); // Proof that exceeds compute budget
            const streamParams = {
                streamId: Buffer.alloc(32),
                startTime: new anchor.BN(Date.now() / 1000),
                endTime: new anchor.BN(Date.now() / 1000 + 3600),
                totalAmount: new anchor.BN(1000)
            };

            try {
                await program.methods
                    .verifyStreamProof(proof, streamParams)
                    .accounts({
                        streamState: streamState,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .rpc();
                assert.fail('Expected error was not thrown');
            } catch (error) {
                assert.ok(error.message.includes('InsufficientComputeBudget'));
            }
        });
    });
    ```

12. **Circuit-Specific Optimizations**
    ```rust
    // Circuit-specific optimizations
    pub struct CircuitOptimizer {
        pub circuit_type: CircuitType,
        pub optimization_level: OptimizationLevel,
    }

    #[derive(Clone, Copy)]
    pub enum CircuitType {
        Transfer,
        Stream,
        Split,
        Condition,
    }

    #[derive(Clone, Copy)]
    pub enum OptimizationLevel {
        Low,    // Basic optimizations
        Medium, // Standard optimizations
        High,   // Aggressive optimizations
    }

    impl CircuitOptimizer {
        pub fn new(circuit_type: CircuitType, level: OptimizationLevel) -> Self {
            Self {
                circuit_type,
                optimization_level: level,
            }
        }

        pub fn optimize_proof(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            match self.circuit_type {
                CircuitType::Transfer => self.optimize_transfer_proof(proof),
                CircuitType::Stream => self.optimize_stream_proof(proof),
                CircuitType::Split => self.optimize_split_proof(proof),
                CircuitType::Condition => self.optimize_condition_proof(proof),
            }
        }

        fn optimize_transfer_proof(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Optimize transfer-specific proof elements
            match self.optimization_level {
                OptimizationLevel::Low => {
                    // Basic optimizations
                    self.compress_proof_size(proof)?;
                }
                OptimizationLevel::Medium => {
                    // Standard optimizations
                    self.compress_proof_size(proof)?;
                    self.optimize_field_operations(proof)?;
                }
                OptimizationLevel::High => {
                    // Aggressive optimizations
                    self.compress_proof_size(proof)?;
                    self.optimize_field_operations(proof)?;
                    self.optimize_merkle_path(proof)?;
                }
            }
            Ok(())
        }

        fn optimize_stream_proof(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Optimize stream-specific proof elements
            match self.optimization_level {
                OptimizationLevel::Low => {
                    self.compress_proof_size(proof)?;
                }
                OptimizationLevel::Medium => {
                    self.compress_proof_size(proof)?;
                    self.optimize_time_checks(proof)?;
                }
                OptimizationLevel::High => {
                    self.compress_proof_size(proof)?;
                    self.optimize_time_checks(proof)?;
                    self.optimize_amount_calculation(proof)?;
                }
            }
            Ok(())
        }

        fn optimize_split_proof(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Optimize split-specific proof elements
            match self.optimization_level {
                OptimizationLevel::Low => {
                    self.compress_proof_size(proof)?;
                }
                OptimizationLevel::Medium => {
                    self.compress_proof_size(proof)?;
                    self.optimize_recipient_checks(proof)?;
                }
                OptimizationLevel::High => {
                    self.compress_proof_size(proof)?;
                    self.optimize_recipient_checks(proof)?;
                    self.optimize_amount_distribution(proof)?;
                }
            }
            Ok(())
        }

        fn compress_proof_size(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Implement proof compression
            Ok(())
        }

        fn optimize_field_operations(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Optimize field arithmetic operations
            Ok(())
        }

        fn optimize_merkle_path(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Optimize Merkle path verification
            Ok(())
        }

        fn optimize_time_checks(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Optimize time-based checks
            Ok(())
        }

        fn optimize_amount_calculation(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Optimize amount calculations
            Ok(())
        }

        fn optimize_recipient_checks(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Optimize recipient validation
            Ok(())
        }

        fn optimize_amount_distribution(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Optimize amount distribution checks
            Ok(())
        }
    }
    ```

13. **Advanced Error Handling**
    ```rust
    // Advanced error handling
    #[error_code]
    pub enum CipherPayError {
        // ... existing errors ...

        // Circuit-specific errors
        #[msg("Invalid stream parameters")]
        InvalidStreamParams,
        #[msg("Stream has expired")]
        StreamExpired,
        #[msg("Invalid split distribution")]
        InvalidSplitDistribution,
        #[msg("Recipient limit exceeded")]
        RecipientLimitExceeded,
        #[msg("Amount overflow")]
        AmountOverflow,
        #[msg("Time constraint violation")]
        TimeConstraintViolation,

        // Optimization errors
        #[msg("Optimization failed")]
        OptimizationFailed,
        #[msg("Proof too complex for optimization")]
        ProofTooComplex,
        #[msg("Invalid optimization level")]
        InvalidOptimizationLevel,

        // State errors
        #[msg("State inconsistency detected")]
        StateInconsistency,
        #[msg("Invalid state transition")]
        InvalidStateTransition,
        #[msg("State update failed")]
        StateUpdateFailed,
    }

    pub struct ErrorHandler {
        pub error_type: CipherPayError,
        pub context: ErrorContext,
    }

    #[derive(Default)]
    pub struct ErrorContext {
        pub circuit_type: Option<CircuitType>,
        pub proof_size: Option<usize>,
        pub state_version: Option<u64>,
        pub timestamp: Option<i64>,
    }

    impl ErrorHandler {
        pub fn new(error_type: CipherPayError) -> Self {
            Self {
                error_type,
                context: ErrorContext::default(),
            }
        }

        pub fn handle_error(&self) -> Result<()> {
            match self.error_type {
                CipherPayError::InvalidStreamParams => self.handle_stream_error(),
                CipherPayError::StreamExpired => self.handle_expired_stream(),
                CipherPayError::InvalidSplitDistribution => self.handle_split_error(),
                CipherPayError::RecipientLimitExceeded => self.handle_recipient_error(),
                CipherPayError::AmountOverflow => self.handle_amount_error(),
                CipherPayError::TimeConstraintViolation => self.handle_time_error(),
                CipherPayError::OptimizationFailed => self.handle_optimization_error(),
                CipherPayError::ProofTooComplex => self.handle_complexity_error(),
                CipherPayError::InvalidOptimizationLevel => self.handle_optimization_level_error(),
                CipherPayError::StateInconsistency => self.handle_state_error(),
                CipherPayError::InvalidStateTransition => self.handle_transition_error(),
                CipherPayError::StateUpdateFailed => self.handle_update_error(),
                _ => err!(self.error_type),
            }
        }

        fn handle_stream_error(&self) -> Result<()> {
            // Handle stream-specific errors
            Ok(())
        }

        fn handle_expired_stream(&self) -> Result<()> {
            // Handle expired stream errors
            Ok(())
        }

        fn handle_split_error(&self) -> Result<()> {
            // Handle split-specific errors
            Ok(())
        }

        fn handle_recipient_error(&self) -> Result<()> {
            // Handle recipient-related errors
            Ok(())
        }

        fn handle_amount_error(&self) -> Result<()> {
            // Handle amount-related errors
            Ok(())
        }

        fn handle_time_error(&self) -> Result<()> {
            // Handle time-related errors
            Ok(())
        }

        fn handle_optimization_error(&self) -> Result<()> {
            // Handle optimization errors
            Ok(())
        }

        fn handle_complexity_error(&self) -> Result<()> {
            // Handle complexity-related errors
            Ok(())
        }

        fn handle_optimization_level_error(&self) -> Result<()> {
            // Handle optimization level errors
            Ok(())
        }

        fn handle_state_error(&self) -> Result<()> {
            // Handle state-related errors
            Ok(())
        }

        fn handle_transition_error(&self) -> Result<()> {
            // Handle state transition errors
            Ok(())
        }

        fn handle_update_error(&self) -> Result<()> {
            // Handle state update errors
            Ok(())
        }
    }
    ```

14. **Edge Case Testing**
    ```typescript
    // Edge case testing
    describe('cipherpay-verifier-edge-cases', () => {
        // ... existing code ...

        it('Handles maximum number of recipients in split', async () => {
            const proof = generateTestProof();
            const maxRecipients = 10; // Maximum allowed recipients
            const recipients = Array(maxRecipients).fill(null).map(() => 
                new anchor.web3.PublicKey('11111111111111111111111111111111')
            );
            const amounts = Array(maxRecipients).fill(new anchor.BN(100));

            const splitParams = {
                splitId: Buffer.alloc(32),
                recipients,
                amounts
            };

            const tx = await program.methods
                .verifySplitProof(proof, splitParams)
                .accounts({
                    splitState: splitState,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            const txInfo = await provider.connection.getTransaction(tx);
            assert.ok(txInfo.meta.err === null);
        });

        it('Handles stream expiration edge cases', async () => {
            const proof = generateTestProof();
            const now = Math.floor(Date.now() / 1000);
            
            // Test stream that just expired
            const streamParams = {
                streamId: Buffer.alloc(32),
                startTime: new anchor.BN(now - 3600),
                endTime: new anchor.BN(now - 1),
                totalAmount: new anchor.BN(1000)
            };

            try {
                await program.methods
                    .verifyStreamProof(proof, streamParams)
                    .accounts({
                        streamState: streamState,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .rpc();
                assert.fail('Expected error was not thrown');
            } catch (error) {
                assert.ok(error.message.includes('StreamExpired'));
            }
        });

        it('Handles amount overflow in split', async () => {
            const proof = generateTestProof();
            const maxAmount = new anchor.BN('18446744073709551615'); // u64 max
            
            const splitParams = {
                splitId: Buffer.alloc(32),
                recipients: [
                    new anchor.web3.PublicKey('11111111111111111111111111111111'),
                    new anchor.web3.PublicKey('22222222222222222222222222222222')
                ],
                amounts: [maxAmount, new anchor.BN(1)]
            };

            try {
                await program.methods
                    .verifySplitProof(proof, splitParams)
                    .accounts({
                        splitState: splitState,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .rpc();
                assert.fail('Expected error was not thrown');
            } catch (error) {
                assert.ok(error.message.includes('AmountOverflow'));
            }
        });

        it('Handles state inconsistency recovery', async () => {
            // Simulate state inconsistency
            const proof = generateTestProof();
            const streamParams = {
                streamId: Buffer.alloc(32),
                startTime: new anchor.BN(Date.now() / 1000),
                endTime: new anchor.BN(Date.now() / 1000 + 3600),
                totalAmount: new anchor.BN(1000)
            };

            // First verification
            await program.methods
                .verifyStreamProof(proof, streamParams)
                .accounts({
                    streamState: streamState,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            // Attempt to verify same proof again
            try {
                await program.methods
                    .verifyStreamProof(proof, streamParams)
                    .accounts({
                        streamState: streamState,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .rpc();
                assert.fail('Expected error was not thrown');
            } catch (error) {
                assert.ok(error.message.includes('StateInconsistency'));
            }
        });
    });
    ```

15. **Performance Benchmarking**
    ```rust
    // Performance benchmarking utilities
    pub struct BenchmarkResult {
        pub circuit_type: CircuitType,
        pub proof_size: usize,
        pub verification_time: u64,
        pub compute_units: u32,
        pub memory_usage: u64,
    }

    pub struct BenchmarkRunner {
        pub iterations: u32,
        pub warmup_iterations: u32,
    }

    impl BenchmarkRunner {
        pub fn new(iterations: u32, warmup_iterations: u32) -> Self {
            Self {
                iterations,
                warmup_iterations,
            }
        }

        pub async fn benchmark_circuit(
            &self,
            circuit_type: CircuitType,
            proof: &VerifyProofArgs,
        ) -> BenchmarkResult {
            // Warmup phase
            for _ in 0..self.warmup_iterations {
                self.run_verification(circuit_type, proof).await?;
            }

            // Benchmark phase
            let mut total_time = 0;
            let mut total_units = 0;
            let mut total_memory = 0;

            for _ in 0..self.iterations {
                let result = self.run_verification(circuit_type, proof).await?;
                total_time += result.verification_time;
                total_units += result.compute_units;
                total_memory += result.memory_usage;
            }

            BenchmarkResult {
                circuit_type,
                proof_size: proof.proof_a.len() + proof.proof_b.len() + proof.proof_c.len(),
                verification_time: total_time / self.iterations as u64,
                compute_units: total_units / self.iterations,
                memory_usage: total_memory / self.iterations as u64,
            }
        }

        async fn run_verification(
            &self,
            circuit_type: CircuitType,
            proof: &VerifyProofArgs,
        ) -> Result<BenchmarkResult> {
            let start_time = SystemTime::now();
            let start_memory = get_memory_usage();

            // Run verification
            let compute_units = match circuit_type {
                CircuitType::Transfer => verify_transfer_proof(proof).await?,
                CircuitType::Stream => verify_stream_proof(proof).await?,
                CircuitType::Split => verify_split_proof(proof).await?,
                CircuitType::Condition => verify_condition_proof(proof).await?,
            };

            let end_time = SystemTime::now();
            let end_memory = get_memory_usage();

            Ok(BenchmarkResult {
                circuit_type,
                proof_size: proof.proof_a.len() + proof.proof_b.len() + proof.proof_c.len(),
                verification_time: end_time.duration_since(start_time)?.as_millis() as u64,
                compute_units,
                memory_usage: end_memory - start_memory,
            })
        }
    }
    ```

16. **Advanced Optimization Strategies**
    ```rust
    // Advanced optimization strategies
    pub struct OptimizationStrategy {
        pub circuit_type: CircuitType,
        pub strategy_type: StrategyType,
        pub parameters: OptimizationParameters,
    }

    #[derive(Clone)]
    pub struct OptimizationParameters {
        pub compression_level: u8,
        pub batch_size: u32,
        pub parallel_processing: bool,
        pub memory_limit: u64,
    }

    #[derive(Clone, Copy)]
    pub enum StrategyType {
        ProofCompression,
        BatchProcessing,
        ParallelVerification,
        MemoryOptimization,
        Custom,
    }

    impl OptimizationStrategy {
        pub fn new(
            circuit_type: CircuitType,
            strategy_type: StrategyType,
            parameters: OptimizationParameters,
        ) -> Self {
            Self {
                circuit_type,
                strategy_type,
                parameters,
            }
        }

        pub fn apply(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            match self.strategy_type {
                StrategyType::ProofCompression => self.apply_compression(proof),
                StrategyType::BatchProcessing => self.apply_batch_processing(proof),
                StrategyType::ParallelVerification => self.apply_parallel_verification(proof),
                StrategyType::MemoryOptimization => self.apply_memory_optimization(proof),
                StrategyType::Custom => self.apply_custom_strategy(proof),
            }
        }

        fn apply_compression(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Implement proof compression
            match self.circuit_type {
                CircuitType::Transfer => self.compress_transfer_proof(proof),
                CircuitType::Stream => self.compress_stream_proof(proof),
                CircuitType::Split => self.compress_split_proof(proof),
                CircuitType::Condition => self.compress_condition_proof(proof),
            }
        }

        fn apply_batch_processing(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Implement batch processing
            if self.parameters.batch_size > 1 {
                self.prepare_for_batch(proof)?;
            }
            Ok(())
        }

        fn apply_parallel_verification(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Implement parallel verification
            if self.parameters.parallel_processing {
                self.prepare_for_parallel(proof)?;
            }
            Ok(())
        }

        fn apply_memory_optimization(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Implement memory optimization
            if proof.proof_a.len() + proof.proof_b.len() + proof.proof_c.len() > self.parameters.memory_limit as usize {
                self.optimize_memory_usage(proof)?;
            }
            Ok(())
        }

        fn apply_custom_strategy(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Implement custom optimization strategy
            match self.circuit_type {
                CircuitType::Transfer => self.custom_transfer_optimization(proof),
                CircuitType::Stream => self.custom_stream_optimization(proof),
                CircuitType::Split => self.custom_split_optimization(proof),
                CircuitType::Condition => self.custom_condition_optimization(proof),
            }
        }

        // Circuit-specific compression methods
        fn compress_transfer_proof(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Implement transfer-specific compression
            Ok(())
        }

        fn compress_stream_proof(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Implement stream-specific compression
            Ok(())
        }

        fn compress_split_proof(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Implement split-specific compression
            Ok(())
        }

        fn compress_condition_proof(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Implement condition-specific compression
            Ok(())
        }

        // Utility methods
        fn prepare_for_batch(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Prepare proof for batch processing
            Ok(())
        }

        fn prepare_for_parallel(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Prepare proof for parallel processing
            Ok(())
        }

        fn optimize_memory_usage(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Optimize memory usage
            Ok(())
        }

        // Custom optimization methods
        fn custom_transfer_optimization(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Implement custom transfer optimization
            Ok(())
        }

        fn custom_stream_optimization(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Implement custom stream optimization
            Ok(())
        }

        fn custom_split_optimization(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Implement custom split optimization
            Ok(())
        }

        fn custom_condition_optimization(&self, proof: &mut VerifyProofArgs) -> Result<()> {
            // Implement custom condition optimization
            Ok(())
        }
    }
    ```

17. **Performance Testing**
    ```typescript
    // Performance testing
    describe('cipherpay-verifier-performance', () => {
        // ... existing code ...

        it('Benchmarks transfer proof verification', async () => {
            const proof = generateTestProof();
            const benchmarkRunner = new BenchmarkRunner(100, 10);
            
            const result = await benchmarkRunner.benchmarkCircuit(
                CircuitType.Transfer,
                proof
            );

            // Assert performance metrics
            assert.ok(result.verificationTime < 1000); // Less than 1 second
            assert.ok(result.computeUnits < 200000); // Within Solana's limit
            assert.ok(result.memoryUsage < 1000000); // Less than 1MB
        });

        it('Benchmarks stream proof verification', async () => {
            const proof = generateTestProof();
            const benchmarkRunner = new BenchmarkRunner(100, 10);
            
            const result = await benchmarkRunner.benchmarkCircuit(
                CircuitType.Stream,
                proof
            );

            // Assert performance metrics
            assert.ok(result.verificationTime < 1500); // Less than 1.5 seconds
            assert.ok(result.computeUnits < 200000);
            assert.ok(result.memoryUsage < 1000000);
        });

        it('Tests optimization strategies', async () => {
            const proof = generateTestProof();
            const strategy = new OptimizationStrategy(
                CircuitType.Transfer,
                StrategyType.ProofCompression,
                {
                    compressionLevel: 9,
                    batchSize: 1,
                    parallelProcessing: false,
                    memoryLimit: 1000000
                }
            );

            // Apply optimization
            await strategy.apply(proof);

            // Verify optimization results
            const benchmarkRunner = new BenchmarkRunner(100, 10);
            const result = await benchmarkRunner.benchmarkCircuit(
                CircuitType.Transfer,
                proof
            );

            // Assert optimization improvements
            assert.ok(result.proofSize < originalProofSize);
            assert.ok(result.verificationTime < originalVerificationTime);
            assert.ok(result.computeUnits < originalComputeUnits);
        });

        it('Tests parallel verification', async () => {
            const proofs = Array(10).fill(null).map(() => generateTestProof());
            const strategy = new OptimizationStrategy(
                CircuitType.Transfer,
                StrategyType.ParallelVerification,
                {
                    compressionLevel: 0,
                    batchSize: 10,
                    parallelProcessing: true,
                    memoryLimit: 10000000
                }
            );

            // Apply parallel optimization
            await Promise.all(proofs.map(proof => strategy.apply(proof)));

            // Benchmark parallel verification
            const benchmarkRunner = new BenchmarkRunner(100, 10);
            const results = await Promise.all(
                proofs.map(proof => benchmarkRunner.benchmarkCircuit(
                    CircuitType.Transfer,
                    proof
                ))
            );

            // Assert parallel processing improvements
            const totalTime = results.reduce((sum, r) => sum + r.verificationTime, 0);
            assert.ok(totalTime < 10 * results[0].verificationTime); // Should be faster than sequential
        });
    });
    ```

## Integration Steps

1. **Build Circuits**
   ```bash
   npm run build:all
   ```

2. **Generate Verification Keys**
   ```bash
   npm run setup
   ```

3. **Implement Chain-Specific Verification**
   - Import verification keys
   - Implement proof verification
   - Handle chain-specific formats

4. **Optimize for Chain**
   - Gas/Compute optimization
   - Transaction formatting
   - Batch processing

## Best Practices

1. **Proof Verification**
   - Use chain-specific verification contracts/programs
   - Optimize gas/compute usage
   - Handle chain-specific errors

2. **Transaction Formatting**
   - Follow chain-specific formats
   - Optimize for chain's gas/compute model
   - Handle chain-specific constraints

3. **Gas/Compute Optimization**
   - Use efficient field arithmetic
   - Optimize proof verification
   - Use batch processing when possible

4. **Error Handling**
   - Handle chain-specific errors
   - Provide meaningful error messages
   - Implement proper fallbacks

## Example Implementations

### Ethereum
```solidity
// Example verification contract
contract CipherPayVerifier {
    function verifyTransferProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[] memory input
    ) public view returns (bool) {
        // Implement verification logic
    }
}
```

### Solana
```rust
// Example Solana verification program
use anchor_lang::prelude::*;

#[program]
pub mod cipherpay_verifier {
    pub fn verify_transfer_proof(
        ctx: Context<VerifyProof>,
        proof_a: [u8; 64],
        proof_b: [u8; 128],
        proof_c: [u8; 64],
        public_inputs: Vec<u8>,
    ) -> Result<()> {
        // Implement Solana-specific verification
        Ok(())
    }
}

#[derive(Accounts)]
pub struct VerifyProof<'info> {
    #[account(mut)]
    pub verifier_state: Account<'info, VerifierState>,
    pub system_program: Program<'info, System>,
}
```

## Testing

1. **Chain-Specific Tests**
   - Test verification on each chain
   - Test gas/compute optimization
   - Test error handling

2. **Integration Tests**
   - Test end-to-end flow
   - Test chain-specific features
   - Test error scenarios

3. **Gas/Compute Tests**
   - Test optimization
   - Test batch processing
   - Test chain-specific optimizations

## Security Considerations

1. **Chain-Specific Security**
   - Follow chain-specific security best practices
   - Implement proper access controls
   - Handle chain-specific vulnerabilities

2. **Verification Security**
   - Verify proofs correctly
   - Handle verification errors
   - Implement proper fallbacks

3. **Transaction Security**
   - Follow chain-specific transaction security
   - Handle transaction errors
   - Implement proper error handling

## Support

For chain-specific support:
- Ethereum: [Ethereum Support](https://ethereum.org)
- Solana: [Solana Support](https://solana.com) 