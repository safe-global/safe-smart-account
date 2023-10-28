import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;

    await deploy("TokenCallbackHandler", {
        from: deployer,
        args: [],
        log: true,
        deterministicDeployment: true,
    }).catch(async (e) => {
        const tokenCallbackHandler = await hre.ethers.getContractFactory("TokenCallbackHandler");
        const deployed = await tokenCallbackHandler.deploy();
        const instance = await deployed.waitForDeployment();
        console.log("TokenCallbackHandler deployed at:\n", await instance.getAddress());
    });

    await deploy("CompatibilityFallbackHandler", {
        from: deployer,
        args: [],
        log: true,
        deterministicDeployment: true,
    }).catch(async (e) => {
        const compatibilityFallbackHandler = await hre.ethers.getContractFactory("CompatibilityFallbackHandler");
        const deployed = await compatibilityFallbackHandler.deploy();
        const instance = await deployed.waitForDeployment();
        console.log("================ CompatibilityFallbackHandler ====================");
        console.log("CompatibilityFallbackHandler deployed at:\n", await instance.getAddress());
        console.log("================ CompatibilityFallbackHandler ====================");
    });
};

deploy.tags = ["handlers", "l2-suite", "main-suite"];
export default deploy;
