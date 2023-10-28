import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;

    await deploy("CreateCall", {
        from: deployer,
        args: [],
        log: true,
        deterministicDeployment: true,
    }).catch(async (e) => {
        const createCall = await hre.ethers.getContractFactory("CreateCall");
        const deployed = await createCall.deploy();
        const instance = await deployed.waitForDeployment();
        console.log("\n==================== CreateCall ====================");
        console.log("CreateCall deployed at:", await instance.getAddress());
        console.log("==================== CreateCall ====================");
    });

    await deploy("MultiSend", {
        from: deployer,
        args: [],
        log: true,
        deterministicDeployment: true,
    }).catch(async (e) => {
        const multiSend = await hre.ethers.getContractFactory("MultiSend");
        const deployed = await multiSend.deploy();
        const instance = await deployed.waitForDeployment();
        console.log("\n==================== MultiSend ====================");
        console.log("MultiSend deployed at:", await instance.getAddress());
        console.log("==================== MultiSend ====================");
    });

    await deploy("MultiSendCallOnly", {
        from: deployer,
        args: [],
        log: true,
        deterministicDeployment: true,
    }).catch(async (e) => {
        const multiSendCallOnly = await hre.ethers.getContractFactory("MultiSendCallOnly");
        const deployed = await multiSendCallOnly.deploy();
        const instance = await deployed.waitForDeployment();
        console.log("\n==================== MultiSendCallOnly ====================");
        console.log("MultiSendCallOnly deployed at:", await instance.getAddress());
        console.log("==================== MultiSendCallOnly ====================");
    });

    await deploy("SignMessageLib", {
        from: deployer,
        args: [],
        log: true,
        deterministicDeployment: true,
    }).catch(async (e) => {
        const signMessageLib = await hre.ethers.getContractFactory("SignMessageLib");
        const deployed = await signMessageLib.deploy();
        const instance = await deployed.waitForDeployment();
        console.log("\n==================== SignMessageLib ====================");
        console.log("SignMessageLib deployed at:", await instance.getAddress());
        console.log("==================== SignMessageLib ====================");
    });
};

deploy.tags = ["libraries", "l2-suite", "main-suite"];
export default deploy;
