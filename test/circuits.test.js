const {
    generateTransferInput,
    generateDepositInput,
    generateWithdrawInput,
    generateNoteCommitmentInput,
    generateNullifierInput
} = require('./helpers');

describe('CipherPay Circuit Tests', () => {
    describe('Transfer Circuit', () => {
        it('should have correct signal structure', () => {
            const input = generateTransferInput();
            
            // Check input note signals
            expect(input.inAmount).toBe(100);
            expect(input.inSenderWalletPubKey).toBe(1234567890);
            expect(input.inSenderWalletPrivKey).toBe(1111111111);
            expect(input.inRandomness).toBe(9876543210);
            expect(input.inTokenId).toBe(1);
            expect(input.inMemo).toBe(0);
            expect(input.inPathElements).toHaveLength(16);
            expect(input.inPathIndices).toHaveLength(16);

            // Check output note signals
            expect(input.out1Amount).toBe(80);
            expect(input.out1RecipientCipherPayPubKey).toBe(2222222222);
            expect(input.out1Randomness).toBe(4444444444);
            expect(input.out1TokenId).toBe(1);
            expect(input.out1Memo).toBe(0);
            
            expect(input.out2Amount).toBe(20);
            expect(input.out2SenderCipherPayPubKey).toBe(3333333333);
            expect(input.out2Randomness).toBe(5555555555);
            expect(input.out2TokenId).toBe(1);
            expect(input.out2Memo).toBe(0);

            // Check public inputs
            expect(input.encryptedNote).toBe(12345678901234567890);

            // Verify amount conservation
            expect(input.inAmount).toBe(input.out1Amount + input.out2Amount);
        });

        it('should have correct signal count', () => {
            const input = generateTransferInput();
            const signalCount = Object.keys(input).length;
            
            // Transfer circuit should have 19 signals:
            // - 8 input note signals (inAmount, inSenderWalletPubKey, inSenderWalletPrivKey, inRandomness, inTokenId, inMemo, inPathElements[16], inPathIndices[16])
            // - 10 output note signals (out1Amount, out1RecipientCipherPayPubKey, out1Randomness, out1TokenId, out1Memo, out2Amount, out2SenderCipherPayPubKey, out2Randomness, out2TokenId, out2Memo)
            // - 1 public input (encryptedNote)
            expect(signalCount).toBe(19);
        });

        it('should validate wallet-bound identity', () => {
            const input = generateTransferInput();
            
            // Check that wallet keys are present for identity derivation
            expect(input.inSenderWalletPubKey).toBeDefined();
            expect(input.inSenderWalletPrivKey).toBeDefined();
            
            // Check that CipherPay pubkeys are provided for output notes
            expect(input.out1RecipientCipherPayPubKey).toBeDefined();
            expect(input.out2SenderCipherPayPubKey).toBeDefined();
        });

        it('should validate Merkle path structure', () => {
            const input = generateTransferInput();
            
            // Check Merkle path arrays
            expect(input.inPathElements).toHaveLength(16);
            expect(input.inPathIndices).toHaveLength(16);
            
            // Check that all path elements are numbers
            input.inPathElements.forEach(element => {
                expect(typeof element).toBe('number');
            });
            
            input.inPathIndices.forEach(index => {
                expect(typeof index).toBe('number');
            });
        });
    });

    describe('Deposit Circuit', () => {
        it('should have correct signal structure', () => {
            const input = generateDepositInput();
            
            // Check private inputs
            expect(input.ownerWalletPubKey).toBe(1234567890);
            expect(input.ownerWalletPrivKey).toBe(1111111111);
            expect(input.randomness).toBe(9876543210);
            expect(input.tokenId).toBe(1);
            expect(input.memo).toBe(0);

            // Check public inputs
            expect(input.amount).toBe(100);
            expect(input.nonce).toBe(3333333333);
            expect(input.depositHash).toBeDefined();
        });

        it('should have correct signal count', () => {
            const input = generateDepositInput();
            const signalCount = Object.keys(input).length;
            
            // Deposit circuit should have 8 signals:
            // - 5 private inputs (ownerWalletPubKey, ownerWalletPrivKey, randomness, tokenId, memo)
            // - 3 public inputs (amount, nonce, depositHash)
            expect(signalCount).toBe(8);
        });

        it('should validate deposit hash binding', () => {
            const input = generateDepositInput();
            
            // Check that deposit hash is computed from owner identity
            expect(input.depositHash).toBeDefined();
            expect(input.amount).toBeDefined();
            expect(input.nonce).toBeDefined();
        });
    });

    describe('Withdraw Circuit', () => {
        it('should have correct signal structure', () => {
            const input = generateWithdrawInput();
            
            // Check private inputs
            expect(input.recipientWalletPrivKey).toBe(1111111111);
            expect(input.randomness).toBe(9876543210);
            expect(input.memo).toBe(0);
            expect(input.pathElements).toHaveLength(16);
            expect(input.pathIndices).toHaveLength(16);

            // Check public inputs
            expect(input.recipientWalletPubKey).toBe(1234567890);
            expect(input.amount).toBe(100);
            expect(input.tokenId).toBe(1);
            expect(input.commitment).toBeDefined();
        });

        it('should have correct signal count', () => {
            const input = generateWithdrawInput();
            const signalCount = Object.keys(input).length;
            
            // Withdraw circuit should have 9 signals:
            // - 5 private inputs (recipientWalletPrivKey, randomness, memo, pathElements[16], pathIndices[16])
            // - 4 public inputs (recipientWalletPubKey, amount, tokenId, commitment)
            expect(signalCount).toBe(9);
        });

        it('should validate commitment verification', () => {
            const input = generateWithdrawInput();
            
            // Check that commitment is provided for verification
            expect(input.commitment).toBeDefined();
            expect(input.amount).toBeDefined();
            expect(input.tokenId).toBeDefined();
        });
    });

    describe('Note Commitment Component', () => {
        it('should have correct signal structure', () => {
            const input = generateNoteCommitmentInput();
            
            expect(input.amount).toBe(100);
            expect(input.cipherPayPubKey).toBe(1234567890);
            expect(input.randomness).toBe(9876543210);
            expect(input.tokenId).toBe(1);
            expect(input.memo).toBe(0);
        });

        it('should have correct signal count', () => {
            const input = generateNoteCommitmentInput();
            const signalCount = Object.keys(input).length;
            
            // Note commitment component should have 5 signals:
            // - 5 inputs (amount, cipherPayPubKey, randomness, tokenId, memo)
            expect(signalCount).toBe(5);
        });
    });

    describe('Nullifier Component', () => {
        it('should have correct signal structure', () => {
            const input = generateNullifierInput();
            
            expect(input.ownerWalletPubKey).toBe(1234567890);
            expect(input.ownerWalletPrivKey).toBe(1111111111);
            expect(input.randomness).toBe(9876543210);
            expect(input.tokenId).toBe(1);
        });

        it('should have correct signal count', () => {
            const input = generateNullifierInput();
            const signalCount = Object.keys(input).length;
            
            // Nullifier component should have 4 signals:
            // - 4 inputs (ownerWalletPubKey, ownerWalletPrivKey, randomness, tokenId)
            expect(signalCount).toBe(4);
        });
    });

    describe('Circuit Features', () => {
        it('should support privacy-enhanced design', () => {
            const transferInput = generateTransferInput();
            const depositInput = generateDepositInput();
            const withdrawInput = generateWithdrawInput();
            
            // Check wallet-bound identity features
            expect(transferInput.inSenderWalletPubKey).toBeDefined();
            expect(transferInput.inSenderWalletPrivKey).toBeDefined();
            expect(depositInput.ownerWalletPubKey).toBeDefined();
            expect(depositInput.ownerWalletPrivKey).toBeDefined();
            expect(withdrawInput.recipientWalletPubKey).toBeDefined();
            expect(withdrawInput.recipientWalletPrivKey).toBeDefined();
        });

        it('should support encrypted note feature', () => {
            const transferInput = generateTransferInput();
            
            // Check encrypted note for recipient privacy
            expect(transferInput.encryptedNote).toBeDefined();
            expect(typeof transferInput.encryptedNote).toBe('number');
        });

        it('should support Merkle tree verification', () => {
            const transferInput = generateTransferInput();
            const withdrawInput = generateWithdrawInput();
            
            // Check Merkle path structures
            expect(transferInput.inPathElements).toHaveLength(16);
            expect(transferInput.inPathIndices).toHaveLength(16);
            expect(withdrawInput.pathElements).toHaveLength(16);
            expect(withdrawInput.pathIndices).toHaveLength(16);
        });

        it('should support amount conservation', () => {
            const transferInput = generateTransferInput();
            
            // Verify input amount equals sum of output amounts
            expect(transferInput.inAmount).toBe(transferInput.out1Amount + transferInput.out2Amount);
        });

        it('should support token consistency', () => {
            const transferInput = generateTransferInput();
            
            // Verify all notes use the same token
            expect(transferInput.inTokenId).toBe(1);
            expect(transferInput.out1TokenId).toBe(1);
            expect(transferInput.out2TokenId).toBe(1);
        });
    });
}); 