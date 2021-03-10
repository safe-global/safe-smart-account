import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import { task, types } from "hardhat/config";
import { loadSolc } from "../utils/solc";

task("codesize", "Displays the codesize of the contracts")
    .addParam("skipcompile", "should not compile before printing size", false, types.boolean, true)
    .addParam("contractname", "name of the contract", undefined, types.string, true)
    .setAction(async (taskArgs, hre) => {
        if (!taskArgs.skipcompile) {
            await hre.run("compile")
        }
        const contracts = await hre.artifacts.getAllFullyQualifiedNames()
        for (const contract of contracts) {
            const artifact = await hre.artifacts.readArtifact(contract)
            if (taskArgs.contractname && taskArgs.contractname !== artifact.contractName) continue
            console.log(artifact.contractName, Math.max(0, (artifact.deployedBytecode.length - 2) / 2), "bytes (limit is 24576)")
        }
    });

task("yulcode", "Outputs yul code for contracts")
    .addParam("contractname", "name of the contract", undefined, types.string, true)
    .setAction(async (taskArgs, hre) => {
        const contracts = await hre.artifacts.getAllFullyQualifiedNames()
        for (const contract of contracts) {
            if (taskArgs.contractname && !contract.endsWith(taskArgs.contractname)) continue
            const buildInfo = await hre.artifacts.getBuildInfo(contract)
            if (!buildInfo) return
            console.log({buildInfo})
            buildInfo.input.settings.outputSelection['*']['*'].push("ir", "evm.assembly")
            const solcjs = await loadSolc(buildInfo.solcLongVersion)
            const compiled = solcjs.compile(JSON.stringify(buildInfo.input))
            const output = JSON.parse(compiled);
            console.log(output.contracts[contract.split(":")[0]])
            console.log(output.errors)
        }
    });

export { }