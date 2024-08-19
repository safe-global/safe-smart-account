import hre, { deployments } from "hardhat";
import { Contract, Signer } from "ethers";
import { AddressZero } from "@ethersproject/constants";
import solc from "solc";
import { logGas } from "../../src/utils/execution";
import { safeContractUnderTest } from "./config";
import { getRandomIntAsString } from "./numbers";
import { Safe, SafeL2, SafeMigration } from "../../typechain-types";

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
    return await deployments.get("TokenCallbackHandler");
};

export const defaultTokenCallbackHandlerContract = async () => {
    return await hre.ethers.getContractFactory("TokenCallbackHandler");
};

export const compatFallbackHandlerDeployment = async () => {
    return await deployments.get("CompatibilityFallbackHandler");
};

export const compatFallbackHandlerContract = async () => {
    return await hre.ethers.getContractFactory("CompatibilityFallbackHandler");
};

export const getSafeSingleton = async () => {
    const SafeDeployment = await deployments.get(safeContractUnderTest());
    const Safe = await hre.ethers.getContractAt(safeContractUnderTest(), SafeDeployment.address);
    return Safe;
};

export const getSafeSingletonContractFactory = async () => {
    const safeSingleton = await hre.ethers.getContractFactory("Safe");

    return safeSingleton;
};

export const getSafeSingletonContract = async (): Promise<Safe> => {
    const safeSingletonDeployment = await deployments.get("Safe");
    const Safe = await hre.ethers.getContractAt("Safe", safeSingletonDeployment.address);
    return Safe;
};

export const getSafeL2SingletonContract = async (): Promise<SafeL2> => {
    const safeSingletonDeployment = await deployments.get("SafeL2");
    const Safe = await hre.ethers.getContractAt("SafeL2", safeSingletonDeployment.address);
    return Safe;
};

export const getSafeL2SingletonContractFactory = async () => {
    const safeSingleton = await hre.ethers.getContractFactory("SafeL2");

    return safeSingleton;
};

export const getSafeSingletonAt = async (address: string) => {
    const safe = await hre.ethers.getContractAt(safeContractUnderTest(), address);
    return safe as unknown as Safe | SafeL2;
};

export const getFactoryContract = async () => {
    const factory = await hre.ethers.getContractFactory("SafeProxyFactory");

    return factory;
};

export const getFactory = async () => {
    const FactoryDeployment = await deployments.get("SafeProxyFactory");
    const Factory = await hre.ethers.getContractAt("SafeProxyFactory", FactoryDeployment.address);
    return Factory;
};

export const getFactoryAt = async (address: string) => {
    const Factory = await hre.ethers.getContractAt("SafeProxyFactory", address);
    return Factory;
};

export const getSimulateTxAccessor = async () => {
    const SimulateTxAccessorDeployment = await deployments.get("SimulateTxAccessor");
    const SimulateTxAccessor = await hre.ethers.getContractAt("SimulateTxAccessor", SimulateTxAccessorDeployment.address);
    return SimulateTxAccessor;
};

export const getMultiSend = async () => {
    const MultiSendDeployment = await deployments.get("MultiSend");
    const MultiSend = await hre.ethers.getContractAt("MultiSend", MultiSendDeployment.address);
    return MultiSend;
};

export const getMultiSendCallOnly = async () => {
    const MultiSendDeployment = await deployments.get("MultiSendCallOnly");
    const MultiSend = await hre.ethers.getContractAt("MultiSendCallOnly", MultiSendDeployment.address);
    return MultiSend;
};

export const getCreateCall = async () => {
    const CreateCallDeployment = await deployments.get("CreateCall");
    const CreateCall = await hre.ethers.getContractAt("CreateCall", CreateCallDeployment.address);
    return CreateCall;
};

export const migrationContract = async () => {
    return await hre.ethers.getContractFactory("Migration");
};

export const safeMigrationContract = async (): Promise<SafeMigration> => {
    const SafeMigrationDeployment = await deployments.get("SafeMigration");
    const SafeMigration = await hre.ethers.getContractAt("SafeMigration", SafeMigrationDeployment.address);
    return SafeMigration;
};

export const getMock = async () => {
    const Mock = await hre.ethers.getContractFactory("MockContract");
    return await Mock.deploy();
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
    const tokenCallbackHandler = await hre.ethers.getContractAt(
        "TokenCallbackHandler",
        address || (await defaultTokenCallbackHandlerDeployment()).address,
    );

    return tokenCallbackHandler;
};

export const getCompatFallbackHandler = async (address?: string) => {
    const fallbackHandler = await hre.ethers.getContractAt(
        "CompatibilityFallbackHandler",
        address || (await compatFallbackHandlerDeployment()).address,
    );

    return fallbackHandler;
};

export const getSafeProxyRuntimeCode = async () => {
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

export const deployContract = async (deployer: Signer, source: string): Promise<Contract> => {
    const output = await compile(source);
    const transaction = await deployer.sendTransaction({ data: output.data, gasLimit: 6000000 });
    const receipt = await transaction.wait();

    if (!receipt?.contractAddress) {
        throw Error("Could not deploy contract");
    }

    return new Contract(receipt.contractAddress, output.interface, deployer);
};
