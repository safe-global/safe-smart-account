import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployer: deployerAccount } = await hre.getNamedAccounts();

    await hre.deployments.deploy("CreateCall", {
        from: deployerAccount,
        args: [],
        log: true,
        deterministicDeployment: true,
    });

    await hre.deployments.deploy("MultiSend", {
        from: deployerAccount,
        args: [],
        log: true,
        deterministicDeployment: true,
    });

    await hre.deployments.deploy("MultiSendCallOnly", {
        from: deployerAccount,
        args: [],
        log: true,
        deterministicDeployment: true,
    });

    await hre.deployments.deploy("SignMessageLib", {
        from: deployerAccount,
        args: [],
        log: true,
        deterministicDeployment: true,
    });

    await hre.deployments.deploy("SafeToL2Setup", {
        from: deployerAccount,
        args: [],
        log: true,
        deterministicDeployment: true,
    });
};

deploy.tags = ["libraries", "l2-suite", "main-suite"];
export default deploy;
