import { exec } from "child_process";
import { ContractInterface } from "ethers";
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from "hardhat/builtin-tasks/task-names";
import { Compiler } from "hardhat/internal/solidity/compiler/downloader";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as zk from "zksync-web3";

export const getZkContractFactoryByName = async (hre: HardhatRuntimeEnvironment, contractName: string, signer: zk.Signer | zk.Wallet) => {
    const artifact = await hre.artifacts.readArtifact(contractName);

    if (artifact.bytecode === "0x") {
        throw new Error(
            `You are trying to create a contract factory for the contract ${contractName}, which is abstract and can't be deployed.`,
        );
    }

    return new zk.ContractFactory(artifact.abi, artifact.bytecode, signer, "create");
};

let _solcBuild: Compiler;
async function getSolcBuild(hre: HardhatRuntimeEnvironment) {
    if (!_solcBuild) {
        _solcBuild = await hre.run(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, {
            quiet: false,
            solcVersion: hre.config.solidity.compilers[0].version,
        });
    }
    return _solcBuild;
}

export async function zkCompile(hre: HardhatRuntimeEnvironment, source: string): Promise<{ data: string; abi: ContractInterface }> {
    const zkSolcCompilerPath = hre.config.zksolc.settings.compilerPath;
    const solcBuild = await getSolcBuild(hre);

    const input = JSON.stringify({
        language: "Solidity",
        settings: {
            optimizer: {
                runs: 200,
                enabled: false,
            },
            outputSelection: {
                "*": {
                    "*": ["abi"],
                },
            },
        },
        sources: {
            "tmp.sol": {
                content: source,
            },
        },
    });

    const zkSolcData: string = await new Promise((resolve, reject) => {
        const process = exec(
            `${zkSolcCompilerPath} --standard-json --solc ${solcBuild.compilerPath}`,
            {
                maxBuffer: 1024 * 1024 * 500,
            },
            (err, stdout, _stderr) => {
                if (err !== null) {
                    return reject(err);
                }
                resolve(stdout);
            },
        );

        process.stdin?.write(input);
        process.stdin?.end();
    });

    const output = JSON.parse(zkSolcData);
    if (!output["contracts"]) {
        console.log(output);
        throw Error("Could not compile contract");
    }

    const fileOutput = output["contracts"]["tmp.sol"];
    const contractOutput = fileOutput[Object.keys(fileOutput)[0]];
    const abi = contractOutput["abi"];
    const data = "0x" + contractOutput["evm"]["bytecode"]["object"];

    return { data, abi };
}
