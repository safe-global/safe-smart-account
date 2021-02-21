import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import { task } from "hardhat/config";
import solc from "solc"

const solcCache: Record<string, any> = {}

const loadSolc = async (version: string): Promise<any> => {
    return await new Promise((resolve, reject) => {
        if (solcCache[version] !== undefined) resolve(solcCache[version])
        else solc.loadRemoteVersion(`v${version}`, (error: any, soljson: any) => {
            solcCache[version] = soljson
            return (error) ? reject(error) : resolve(soljson);
        });
    });
}

task("local-verify", "Verifies that the local deployment files correspond to the on chain code")
    .setAction(async (_, hre) => {
        const deployedContracts = await hre.deployments.all()
        for (const contract of Object.keys(deployedContracts)) {
            const deployment = await hre.deployments.get(contract)
            const meta = JSON.parse(deployment.metadata!!)
            const solcjs = await loadSolc(meta.compiler.version)
            delete meta.compiler
            delete meta.output
            delete meta.version
            meta.settings.outputSelection = {}
            const targets = Object.entries(meta.settings.compilationTarget)
            for (const [key, value] of targets) {
                meta.settings.outputSelection[key] = {}
                meta.settings.outputSelection[key][value as string] = [
                    'evm.bytecode',
                    'evm.deployedBytecode',
                    'metadata'
                ];
            }
            delete meta.settings.compilationTarget
            const compiled = solcjs.compile(JSON.stringify(meta));
            const output = JSON.parse(compiled);
            for (const [key, value] of targets) {
                const compiledContract = output.contracts[key][value as string];
                const onChainCode = await hre.ethers.provider.getCode(deployment.address)
                const onchainBytecodeHash = hre.ethers.utils.keccak256(onChainCode)
                const localBytecodeHash = hre.ethers.utils.keccak256(`0x${compiledContract.evm.deployedBytecode.object}`)
                const verifySuccess = onchainBytecodeHash === localBytecodeHash ? "SUCCESS" : "FAILURE"
                console.log(`Verification status for ${value}: ${verifySuccess}`)
            }
        }
    });

export { }