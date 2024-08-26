import hre from "hardhat";
import { expect } from "chai";
import { AddressZero } from "@ethersproject/constants";
import { getFactory, getSafeSingletonAt } from "../utils/setup";
import { calculateProxyAddress } from "../../src/utils/proxies";

const nonEmptyString = (value?: string) => typeof value !== "undefined" && value !== "";

const ERC4337_TEST_ENV_VARIABLES_DEFINED =
    nonEmptyString(process.env.ERC4337_TEST_BUNDLER_URL) &&
    nonEmptyString(process.env.ERC4337_TEST_NODE_URL) &&
    nonEmptyString(process.env.ERC4337_TEST_SAFE_FACTORY_ADDRESS) &&
    nonEmptyString(process.env.ERC4337_TEST_SINGLETON_ADDRESS) &&
    nonEmptyString(process.env.MNEMONIC);

const itif = ERC4337_TEST_ENV_VARIABLES_DEFINED ? it : it.skip;
const SAFE_FACTORY_ADDRESS = process.env.ERC4337_TEST_SAFE_FACTORY_ADDRESS;
const SINGLETON_ADDRESS = process.env.ERC4337_TEST_SINGLETON_ADDRESS;
const BUNDLER_URL = process.env.ERC4337_TEST_BUNDLER_URL;
const NODE_URL = process.env.ERC4337_TEST_NODE_URL;
const MNEMONIC = process.env.MNEMONIC;

type UserOperation = {
    sender: string;
    nonce: string;
    initCode: string;
    callData: string;
    callGasLimit: string;
    verificationGasLimit: string;
    preVerificationGas: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    paymasterAndData: string;
    signature: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Safe.ERC4337", () => {
    const setupTests = async () => {
        const factory = await getFactory(SAFE_FACTORY_ADDRESS as string);
        const singleton = await getSafeSingletonAt(SINGLETON_ADDRESS as string);
        const bundlerProvider = new hre.ethers.JsonRpcProvider(BUNDLER_URL);
        const provider = new hre.ethers.JsonRpcProvider(NODE_URL);
        const userWallet = hre.ethers.HDNodeWallet.fromMnemonic(hre.ethers.Mnemonic.fromPhrase(MNEMONIC as string)).connect(provider);

        const entryPoints = await bundlerProvider.send("eth_supportedEntryPoints", []);
        if (entryPoints.length === 0) {
            throw new Error("No entry points found");
        }

        return {
            factory: factory.connect(userWallet),
            singleton: singleton.connect(provider),
            bundlerProvider,
            provider,
            userWallet,
            entryPoints,
        };
    };

    /**
     * This test verifies the ERC4337 based on gas estimation for a user operation
     * The user operation deploys a Safe with the ERC4337 module and a handler
     * and executes a transaction, thus verifying two things:
     * 1. Deployment of the Safe with the ERC4337 module and handler is possible
     * 2. Executing a transaction is possible
     */
    itif("should pass the ERC4337 validation", async () => {
        const { singleton, factory, provider, bundlerProvider, userWallet, entryPoints } = await setupTests();
        const factoryAddress = await factory.getAddress();
        const ENTRYPOINT_ADDRESS = entryPoints[0];

        const erc4337ModuleAndHandlerFactory = (await hre.ethers.getContractFactory("Test4337ModuleAndHandler")).connect(userWallet);
        const erc4337ModuleAndHandler = await erc4337ModuleAndHandlerFactory.deploy(ENTRYPOINT_ADDRESS);
        const erc4337ModuleAndHandlerAddress = await erc4337ModuleAndHandler.getAddress();
        // The bundler uses a different node, so we need to allow it sometime to sync
        await sleep(10000);

        const feeData = await provider.getFeeData();
        const maxFeePerGas = feeData.maxFeePerGas?.toString(16);
        const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas?.toString(16);

        if (!maxFeePerGas || !maxPriorityFeePerGas) {
            throw new Error("Could not get fee data");
        }

        const moduleInitializer = erc4337ModuleAndHandler.interface.encodeFunctionData("enableMyself");
        const encodedInitializer = singleton.interface.encodeFunctionData("setup", [
            [userWallet.address],
            1,
            erc4337ModuleAndHandlerAddress,
            moduleInitializer,
            erc4337ModuleAndHandlerAddress,
            AddressZero,
            0,
            AddressZero,
        ]);
        const deployedAddress = await calculateProxyAddress(factory, SINGLETON_ADDRESS as string, encodedInitializer, 73);

        // The initCode contains 20 bytes of the factory address and the rest is the calldata to be forwarded
        const initCode = hre.ethers.concat([
            factoryAddress,
            factory.interface.encodeFunctionData("createProxyWithNonce", [SINGLETON_ADDRESS as string, encodedInitializer, 73]),
        ]);
        const userOpCallData = erc4337ModuleAndHandler.interface.encodeFunctionData("execTransaction", [userWallet.address, 0, "0x"]);

        // Native tokens for the pre-fund 💸
        await userWallet.sendTransaction({ to: deployedAddress, value: hre.ethers.parseEther("0.005") });
        // The bundler uses a different node, so we need to allow it sometime to sync
        await sleep(10000);

        const userOperation: UserOperation = {
            sender: deployedAddress,
            nonce: "0x0",
            initCode,
            callData: userOpCallData,
            callGasLimit: "0x1",
            verificationGasLimit: "0x1",
            preVerificationGas: "0x1",
            maxFeePerGas,
            maxPriorityFeePerGas,
            paymasterAndData: "0x",
            signature: "0x",
        };

        const DEBUG_MESSAGE = `
            Using entry point: ${ENTRYPOINT_ADDRESS}
            Deployed Safe address: ${deployedAddress}
            Module/Handler address: ${erc4337ModuleAndHandlerAddress}
            User operation: 
            ${JSON.stringify(userOperation, null, 2)}
        `;
        console.log(DEBUG_MESSAGE);

        const estimatedGas = await bundlerProvider.send("eth_estimateUserOperationGas", [userOperation, ENTRYPOINT_ADDRESS]);
        console.log({ estimatedGas });
        expect(estimatedGas).to.not.be.undefined;
    });
});
