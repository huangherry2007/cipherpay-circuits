const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

async function setupCircuits() {
    console.log("🔧 Setting up CipherPay Circuits...");

    const circuits = ["deposit", "transfer", "withdraw"];

    const rootDir = path.join(__dirname, "..");
    const circuitsDir = path.join(rootDir, "circuits");
    const buildDir = path.join(rootDir, "build");
    const sharedPtauDir = path.join(rootDir, "powersOfTau");
    const sharedPtauFile = path.join(sharedPtauDir, "pot14_final.ptau");

    // Ensure shared ptau exists
    if (!fs.existsSync(sharedPtauFile)) {
        fs.mkdirSync(sharedPtauDir, { recursive: true });

        console.log("🔋 Generating shared pot14_final.ptau...");
        execSync(`npx snarkjs powersoftau new bn128 14 pot14_0000.ptau`, {
            stdio: "inherit",
            cwd: sharedPtauDir,
        });
        execSync(`npx snarkjs powersoftau prepare phase2 pot14_0000.ptau pot14_final.ptau`, {
            stdio: "inherit",
            cwd: sharedPtauDir,
        });
        console.log("✅ Shared ptau ready.\n");
    }

    fs.mkdirSync(buildDir, { recursive: true });

    for (const circuit of circuits) {
        const circuitPath = path.join(circuitsDir, circuit, `${circuit}.circom`);
        const circuitBuildDir = path.join(buildDir, circuit);

        console.log(`🚀 Building circuit: ${circuit}`);

        // Clean previous build
        if (fs.existsSync(circuitBuildDir)) {
            fs.rmSync(circuitBuildDir, { recursive: true, force: true });
        }
        fs.mkdirSync(circuitBuildDir, { recursive: true });

        // === Step 1: Compile .circom
        console.log("🔧 Compiling circuit...");
        execSync(`circom ${circuitPath} --r1cs --wasm --sym -o ${circuitBuildDir} -l node_modules`, {
            stdio: "inherit",
            cwd: rootDir,
        });

        const r1csPath = path.join(circuitBuildDir, `${circuit}.r1cs`);
        const zkeyPath = path.join(circuitBuildDir, `${circuit}.zkey`);
        const verifierJson = path.join(circuitBuildDir, `verifier-${circuit}.json`);
        const solidityVerifier = path.join(circuitBuildDir, `verifier.sol`);

        // === Step 2: Generate proving key
        console.log("🔑 Running Groth16 setup...");
        execSync(`npx snarkjs groth16 setup ${r1csPath} ${sharedPtauFile} ${zkeyPath} --verbose`, {
            stdio: "inherit",
            cwd: circuitBuildDir,
        });

        // === Step 3: Export verifier JSON
        console.log("📤 Exporting verifier JSON...");
        execSync(`npx snarkjs zkey export verificationkey ${zkeyPath} ${verifierJson}`, {
            stdio: "inherit",
            cwd: circuitBuildDir,
        });

        // === Step 4: Optional Solidity verifier
        console.log("📄 Exporting Solidity verifier...");
        execSync(`npx snarkjs zkey export solidityverifier ${zkeyPath} ${solidityVerifier}`, {
            stdio: "inherit",
            cwd: circuitBuildDir,
        });

        console.log(`✅ ${circuit} circuit setup complete.\n`);
    }

    console.log("🎉 All circuits have been compiled and prepared successfully.");
}

setupCircuits().catch((err) => {
    console.error("❌ Setup failed:", err.message);
    process.exit(1);
});
