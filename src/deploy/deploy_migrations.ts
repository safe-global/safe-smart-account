import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployer: deployerAccount } = await hre.getNamedAccounts();

    const Safe = await hre.deployments.get("Safe");
    const SafeL2 = await hre.deployments.get("SafeL2");
    const CompatibilityFallbackHandler = await hre.deployments.get("CompatibilityFallbackHandler");

    await hre.deployments.deploy("SafeMigration", {
        from: deployerAccount,
        args: [Safe.address, SafeL2.address, CompatibilityFallbackHandler.address],
        log: true,
        deterministicDeployment: true,
    });
};

deploy.tags = ["not-l2-to-l2-migration", "migration"];
deploy.dependencies = ["singleton", "l2", "handlers"];
export default deploy;
