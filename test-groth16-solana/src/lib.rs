// Test file to check if groth16-solana compiles without symbol length issues
use groth16_solana;

pub fn test_groth16() {
    // Just import to test compilation
    let _ = groth16_solana::verify;
}
