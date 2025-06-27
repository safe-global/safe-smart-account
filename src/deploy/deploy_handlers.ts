import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployer: deployerAccount } = await hre.getNamedAccounts();

    await hre.deployments.deploy("TokenCallbackHandler", {
        from: deployerAccount,
        args: [],
        log: true,
        deterministicDeployment: true,
    });

    await hre.deployments.deploy("CompatibilityFallbackHandler", {
        from: deployerAccount,
        args: [],
        log: true,
        deterministicDeployment: true,
    });

    await hre.deployments.deploy("ExtensibleFallbackHandler", {
        from: deployerAccount,
        args: [],
        log: true,
        deterministicDeployment: true,
    });
};

deploy.tags = ["handlers", "l2-suite", "main-suite"];
export default deploy;
