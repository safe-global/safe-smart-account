import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployer: deployerAccount } = await hre.getNamedAccounts();

    await hre.deployments.deploy("SafeL2", {
        from: deployerAccount,
        args: [],
        log: true,
        deterministicDeployment: true,
    });
};

deploy.tags = ["l2", "l2-suite", "main-suite"];
export default deploy;
