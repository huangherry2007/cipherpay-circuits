const snarkjs = require('snarkjs');
const { expect } = require('chai');
const {
    generateTransferInput,
    generateMerkleInput,
    generateNullifierInput,
    generateAuditInput,
    generateWithdrawInput,
    generateZkStreamInput,
    generateZkSplitInput,
    generateZkConditionInput,
    loadCircuit
} = require('./helpers');

describe('CipherPay Circuits', () => {
    describe('Transfer Circuit', () => {
        it('should generate and verify valid proof', async () => {
            const { circuit, provingKey, verificationKey } = await loadCircuit('transfer');
            const input = generateTransferInput();
            
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                circuit,
                provingKey
            );
            
            const isValid = await snarkjs.groth16.verify(
                verificationKey,
                publicSignals,
                proof
            );
            
            expect(isValid).to.be.true;
        });

        it('should reject negative amounts', async () => {
            const { circuit, provingKey } = await loadCircuit('transfer');
            const input = generateTransferInput();
            input.inAmount = -100;
            
            try {
                await snarkjs.groth16.fullProve(input, circuit, provingKey);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.exist;
            }
        });
    });

    describe('Merkle Circuit', () => {
        it('should generate and verify valid proof', async () => {
            const { circuit, provingKey, verificationKey } = await loadCircuit('merkle');
            const input = generateMerkleInput();
            
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                circuit,
                provingKey
            );
            
            const isValid = await snarkjs.groth16.verify(
                verificationKey,
                publicSignals,
                proof
            );
            
            expect(isValid).to.be.true;
        });

        it('should reject invalid merkle path', async () => {
            const { circuit, provingKey } = await loadCircuit('merkle');
            const input = generateMerkleInput();
            input.root = "0x0000000000000000";
            
            try {
                await snarkjs.groth16.fullProve(input, circuit, provingKey);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.exist;
            }
        });
    });

    describe('Nullifier Circuit', () => {
        it('should generate and verify valid proof', async () => {
            const { circuit, provingKey, verificationKey } = await loadCircuit('nullifier');
            const input = generateNullifierInput();
            
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                circuit,
                provingKey
            );
            
            const isValid = await snarkjs.groth16.verify(
                verificationKey,
                publicSignals,
                proof
            );
            
            expect(isValid).to.be.true;
        });

        it('should generate unique nullifiers for different inputs', async () => {
            const { circuit, provingKey } = await loadCircuit('nullifier');
            const input1 = generateNullifierInput();
            const input2 = generateNullifierInput();
            input2.secret = "0x1111111111111111";
            
            const { publicSignals: signals1 } = await snarkjs.groth16.fullProve(
                input1,
                circuit,
                provingKey
            );
            
            const { publicSignals: signals2 } = await snarkjs.groth16.fullProve(
                input2,
                circuit,
                provingKey
            );
            
            expect(signals1[0]).to.not.equal(signals2[0]);
        });
    });

    describe('Audit Proof Circuit', () => {
        it('should generate and verify valid proof', async () => {
            const { circuit, provingKey, verificationKey } = await loadCircuit('audit_proof');
            const input = generateAuditInput();
            
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                circuit,
                provingKey
            );
            
            const isValid = await snarkjs.groth16.verify(
                verificationKey,
                publicSignals,
                proof
            );
            
            expect(isValid).to.be.true;
        });

        it('should reject future timestamps', async () => {
            const { circuit, provingKey } = await loadCircuit('audit_proof');
            const input = generateAuditInput();
            input.timestamp = 9999999999; // Future timestamp
            
            try {
                await snarkjs.groth16.fullProve(input, circuit, provingKey);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.exist;
            }
        });
    });

    describe('Withdraw Circuit', () => {
        it('should generate and verify valid proof', async () => {
            const { circuit, provingKey, verificationKey } = await loadCircuit('withdraw');
            const input = generateWithdrawInput();
            
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                circuit,
                provingKey
            );
            
            const isValid = await snarkjs.groth16.verify(
                verificationKey,
                publicSignals,
                proof
            );
            
            expect(isValid).to.be.true;
        });

        it('should reject mismatched withdrawal amount', async () => {
            const { circuit, provingKey } = await loadCircuit('withdraw');
            const input = generateWithdrawInput();
            input.withdrawalAmount = 200; // Different from inAmount
            
            try {
                await snarkjs.groth16.fullProve(input, circuit, provingKey);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.exist;
            }
        });
    });

    describe('ZkStream Circuit', () => {
        it('should generate and verify valid proof', async () => {
            const { circuit, provingKey, verificationKey } = await loadCircuit('stream');
            const input = generateZkStreamInput();
            
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                circuit,
                provingKey
            );
            
            const isValid = await snarkjs.groth16.verify(
                verificationKey,
                publicSignals,
                proof
            );
            
            expect(isValid).to.be.true;
        });

        it('should reject invalid time range', async () => {
            const { circuit, provingKey } = await loadCircuit('stream');
            const input = generateZkStreamInput();
            input.currentTime = input.endTime + 1; // After end time
            
            try {
                await snarkjs.groth16.fullProve(input, circuit, provingKey);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.exist;
            }
        });
    });

    describe('ZkSplit Circuit', () => {
        it('should generate and verify valid proof', async () => {
            const { circuit, provingKey, verificationKey } = await loadCircuit('split');
            const input = generateZkSplitInput();
            
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                circuit,
                provingKey
            );
            
            const isValid = await snarkjs.groth16.verify(
                verificationKey,
                publicSignals,
                proof
            );
            
            expect(isValid).to.be.true;
        });

        it('should reject mismatched total amount', async () => {
            const { circuit, provingKey } = await loadCircuit('split');
            const input = generateZkSplitInput();
            input.totalAmount = 2000; // Different from sum of splits
            
            try {
                await snarkjs.groth16.fullProve(input, circuit, provingKey);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.exist;
            }
        });
    });

    describe('ZkCondition Circuit', () => {
        it('should generate and verify valid proof', async () => {
            const { circuit, provingKey, verificationKey } = await loadCircuit('condition');
            const input = generateZkConditionInput();
            
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                circuit,
                provingKey
            );
            
            const isValid = await snarkjs.groth16.verify(
                verificationKey,
                publicSignals,
                proof
            );
            
            expect(isValid).to.be.true;
        });

        it('should handle different condition types', async () => {
            const { circuit, provingKey } = await loadCircuit('condition');
            const input = generateZkConditionInput();
            
            // Test event-based condition
            input.conditionType = 1;
            input.conditionValue = 42;
            input.currentValue = 42;
            
            const { publicSignals: signals1 } = await snarkjs.groth16.fullProve(
                input,
                circuit,
                provingKey
            );
            
            // Test threshold-based condition
            input.conditionType = 2;
            input.conditionValue = 100;
            input.currentValue = 150;
            
            const { publicSignals: signals2 } = await snarkjs.groth16.fullProve(
                input,
                circuit,
                provingKey
            );
            
            expect(signals1[1]).to.equal(1); // Event condition met
            expect(signals2[1]).to.equal(1); // Threshold condition met
        });
    });
}); 