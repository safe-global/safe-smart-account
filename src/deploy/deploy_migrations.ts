import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getDeployerAccount } from "../utils/deploy";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments } = hre;
    const deployerAccount = await getDeployerAccount(hre);
    const { deploy } = deployments;

    const Safe = await deployments.get("Safe");
    const SafeL2 = await deployments.get("SafeL2");
    const CompatibilityFallbackHandler = await deployments.get("CompatibilityFallbackHandler");

    await deploy("SafeToL2Migration", {
        from: deployerAccount,
        args: [],
        log: true,
        deterministicDeployment: true,
    });

    await deploy("SafeMigration", {
        from: deployerAccount,
        args: [Safe.address, SafeL2.address, CompatibilityFallbackHandler.address],
        log: true,
        deterministicDeployment: true,
    });
};

deploy.tags = ["not-l2-to-l2-migration", "migration"];
deploy.dependencies = ["singleton", "l2", "handlers"];
export default deploy;
