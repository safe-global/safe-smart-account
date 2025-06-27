import { task } from "hardhat/config";
import { loadSolc } from "../utils/solc";

task("local-verify", "Verifies that the local deployment files correspond to the on chain code").setAction(async (_, hre) => {
    const allowedSourceKey = ["keccak256", "content"];
    const deployedContracts = await hre.deployments.all();
    for (const contract of Object.keys(deployedContracts)) {
        const deployment = await hre.deployments.get(contract);
        const meta = JSON.parse(deployment.metadata!);
        const solcjs = await loadSolc(meta.compiler.version);
        delete meta.compiler;
        delete meta.output;
        delete meta.version;
        const sources = Object.values<Record<string, unknown>>(meta.sources);
        for (const source of sources) {
            for (const key of Object.keys(source)) {
                if (allowedSourceKey.indexOf(key) < 0) delete source[key];
            }
        }
        meta.settings.outputSelection = {};
        const targets = Object.entries<string>(meta.settings.compilationTarget);
        for (const [key, value] of targets) {
            meta.settings.outputSelection[key] = {};
            meta.settings.outputSelection[key][value] = ["evm.deployedBytecode.object", "evm.deployedBytecode.immutableReferences"];
        }
        delete meta.settings.compilationTarget;
        const compiled = solcjs.compile(JSON.stringify(meta));
        const output = JSON.parse(compiled);
        for (const [key, value] of targets) {
            const compiledContract = output.contracts[key][value];
            const onChainCode = hre.ethers.getBytes(await hre.ethers.provider.getCode(deployment.address));
            for (const references of Object.values<{ start: number; length: number }[]>(
                compiledContract.evm.deployedBytecode.immutableReferences,
            )) {
                for (const { start, length } of references) {
                    onChainCode.fill(0, start, start + length);
                }
            }
            const onchainBytecodeHash = hre.ethers.keccak256(onChainCode);
            const localBytecodeHash = hre.ethers.keccak256(`0x${compiledContract.evm.deployedBytecode.object}`);
            const verifySuccess = onchainBytecodeHash === localBytecodeHash ? "SUCCESS" : "FAILURE";
            console.log(`Verification status for ${value}: ${verifySuccess}`);
        }
    }
});

export {};
