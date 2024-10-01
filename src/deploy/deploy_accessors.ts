import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getDeployerAccount } from "../utils/deploy";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments } = hre;
    const deployerAccount = await getDeployerAccount(hre);
    const { deploy } = deployments;

    await deploy("SimulateTxAccessor", {
        from: deployerAccount,
        args: [],
        log: true,
        deterministicDeployment: true,
    });
};

deploy.tags = ["accessors", "l2-suite", "main-suite"];
export default deploy;
