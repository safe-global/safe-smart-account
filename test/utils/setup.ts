import hre, { deployments } from "hardhat";
import { Contract, Signer, ethers } from "ethers";
import { AddressZero } from "@ethersproject/constants";
import solc from "solc";
import * as zk from "zksync-ethers";
import { logGas } from "../../src/utils/execution";
import { safeContractUnderTest } from "./config";
import { zkCompile } from "./zkSync";
import { getRandomIntAsString } from "./numbers";
import { MockContract, Safe, SafeL2 } from "../../typechain-types";

type SafeSingleton = {
    readonly singleton?: Safe | SafeL2;
};

type SafeWithSetupConfig = {
    readonly owners: string[];
    readonly threshold?: number;
    readonly to?: string;
    readonly data?: string;
    readonly fallbackHandler?: string;
    readonly saltNumber?: string;
};

type LogGas = {
    readonly logGasUsage?: boolean;
};

type GetSafeParameters = SafeSingleton & SafeWithSetupConfig & LogGas;

export const defaultTokenCallbackHandlerDeployment = async () => {
    return deployments.get("TokenCallbackHandler");
};

export const getSafeSingleton = async () => {
    const safeContractName = safeContractUnderTest();
    const safe = await hre.ethers.getContractAt(safeContractUnderTest(), (await deployments.get(safeContractName)).address);
    return safe as unknown as Safe | SafeL2;
};

export const getSafeL1Singleton = async (): Promise<Safe> => {
    const safeSingletonDeployment = await deployments.get("Safe");
    const Safe = await hre.ethers.getContractAt("Safe", safeSingletonDeployment.address);
    return Safe;
};

export const getSafeL2Singleton = async (): Promise<SafeL2> => {
    const safeSingletonDeployment = await deployments.get("SafeL2");
    const Safe = await hre.ethers.getContractAt("SafeL2", safeSingletonDeployment.address);
    return Safe;
};

export const getSafeSingletonAt = async (address: string) => {
    const safe = await hre.ethers.getContractAt(safeContractUnderTest(), address);
    return safe as unknown as Safe | SafeL2;
};

export const getFactory = async (address?: string) => {
    if (!address) {
        const factoryDeployment = await deployments.get("SafeProxyFactory");
        address = factoryDeployment.address;
    }

    const Factory = await hre.ethers.getContractAt("SafeProxyFactory", address);
    return Factory;
};

export const getSimulateTxAccessor = async () => {
    const SimulateTxAccessor = await hre.ethers.getContractAt("SimulateTxAccessor", (await deployments.get("SimulateTxAccessor")).address);
    return SimulateTxAccessor;
};

export const getMultiSend = async () => {
    const MultiSend = await hre.ethers.getContractAt("MultiSend", (await deployments.get("MultiSend")).address);
    return MultiSend;
};

export const getMultiSendCallOnly = async () => {
    const MultiSend = await hre.ethers.getContractAt("MultiSendCallOnly", (await deployments.get("MultiSendCallOnly")).address);
    return MultiSend;
};

export const getCreateCall = async () => {
    const CreateCall = await hre.ethers.getContractAt("CreateCall", (await deployments.get("CreateCall")).address);
    return CreateCall;
};

export const migrationContractFactory = async () => {
    return await hre.ethers.getContractFactory("Migration");
};

export const safeMigrationContract = async () => {
    const safeMigration = await hre.ethers.getContractAt("SafeMigration", (await deployments.get("SafeMigration")).address);
    return safeMigration;
};

export const getMock = async (): Promise<MockContract> => {
    const contractFactory = await hre.ethers.getContractFactory("MockContract");
    const contract = await contractFactory.deploy();

    return contract;
};

export const getSafeTemplate = async (saltNumber: string = getRandomIntAsString()) => {
    const singleton = await getSafeSingleton();
    return getSafeTemplateWithSingleton(singleton, saltNumber);
};

export const getSafeTemplateWithSingleton = async (singleton: Contract | Safe, saltNumber: string = getRandomIntAsString()) => {
    const singletonAddress = await singleton.getAddress();
    const factory = await getFactory();
    const template = await factory.createProxyWithNonce.staticCall(singletonAddress, "0x", saltNumber);
    await factory.createProxyWithNonce(singletonAddress, "0x", saltNumber).then((tx) => tx.wait());
    return singleton.attach(template) as Safe | SafeL2;
};

export const getSafe = async (safe: GetSafeParameters) => {
    const {
        singleton = await getSafeSingleton(),
        owners,
        threshold = owners.length,
        to = AddressZero,
        data = "0x",
        fallbackHandler = AddressZero,
        logGasUsage = false,
        saltNumber = getRandomIntAsString(),
    } = safe;

    const template = await getSafeTemplateWithSingleton(singleton, saltNumber);
    await logGas(
        `Setup Safe with ${owners.length} owner(s)${fallbackHandler && fallbackHandler !== AddressZero ? " and fallback handler" : ""}`,
        template.setup(owners, threshold, to, data, fallbackHandler, AddressZero, 0, AddressZero),
        !logGasUsage,
    );
    return template;
};

export const getTokenCallbackHandler = async (address?: string) => {
    if (!address) {
        const tokenCallbackHandlerDeployment = await defaultTokenCallbackHandlerDeployment();
        address = tokenCallbackHandlerDeployment.address;
    }

    const tokenCallbackHandler = await hre.ethers.getContractAt("TokenCallbackHandler", address);
    return tokenCallbackHandler;
};

export const getCompatFallbackHandler = async (address?: string) => {
    if (!address) {
        const fallbackHandlerDeployment = await deployments.get("CompatibilityFallbackHandler");
        address = fallbackHandlerDeployment.address;
    }

    const fallbackHandler = await hre.ethers.getContractAt("CompatibilityFallbackHandler", address);

    return fallbackHandler;
};

export const getExtensibleFallbackHandler = async (address?: string) => {
    if (!address) {
        const extensibleFallbackHandlerAddress = await deployments.get("ExtensibleFallbackHandler");
        address = extensibleFallbackHandlerAddress.address;
    }

    const extensibleFallbackHandler = await hre.ethers.getContractAt("ExtensibleFallbackHandler", address);

    return extensibleFallbackHandler;
};

export const getSafeProxyRuntimeCode = async (): Promise<string> => {
    const proxyArtifact = await hre.artifacts.readArtifact("SafeProxy");

    return proxyArtifact.deployedBytecode;
};

export const getDelegateCaller = async () => {
    const DelegateCaller = await hre.ethers.getContractFactory("DelegateCaller");
    return await DelegateCaller.deploy();
};

export const compile = async (source: string) => {
    const input = JSON.stringify({
        language: "Solidity",
        settings: {
            outputSelection: {
                "*": {
                    "*": ["abi", "evm.bytecode"],
                },
            },
        },
        sources: {
            "tmp.sol": {
                content: source,
            },
        },
    });
    const solcData = await solc.compile(input);
    const output = JSON.parse(solcData);
    if (!output["contracts"]) {
        console.log(output);
        throw Error("Could not compile contract");
    }
    const fileOutput = output["contracts"]["tmp.sol"];
    const contractOutput = fileOutput[Object.keys(fileOutput)[0]];
    const abi = contractOutput["abi"];
    const data = "0x" + contractOutput["evm"]["bytecode"]["object"];
    return {
        data: data,
        interface: abi,
    };
};

export const deployContractFromSource = async (deployer: Signer, source: string): Promise<ethers.Contract> => {
    if (!hre.network.zksync) {
        const output = await compile(source);
        const transaction = await deployer.sendTransaction({ data: output.data, gasLimit: 6000000 });
        const receipt = await transaction.wait();

        if (!receipt?.contractAddress) {
            throw Error("Could not deploy contract");
        }

        return new Contract(receipt.contractAddress, output.interface, deployer);
    } else {
        const output = await zkCompile(hre, source);
        const signers = await hre.ethers.getSigners();
        const factory = new zk.ContractFactory(output.abi, output.bytecode, signers[0], "create");
        const contract = await factory.deploy();

        return contract as ethers.Contract;
    }
};

export const getSignMessageLib = async () => {
    const SignMessageLibDeployment = await deployments.get("SignMessageLib");
    const SignMessageLib = await hre.ethers.getContractAt("SignMessageLib", SignMessageLibDeployment.address);

    return SignMessageLib;
};

export const getAbi = async (name: string) => {
    const artifact = await hre.artifacts.readArtifact(name);
    if (!artifact) {
        throw Error(`Could not read artifact for ${name}`);
    }

    return artifact.abi;
};
