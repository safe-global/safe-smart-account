import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;

    await deploy("Safe", {
        from: deployer,
        args: [],
        log: true,
        deterministicDeployment: true,
    }).catch(async (e) => {
        const safe = await hre.ethers.getContractFactory("Safe");
        const deployed = await safe.deploy();
        const instance = await deployed.waitForDeployment();
        console.log("==================== Safe ====================");
        console.log("Safe Singleton deployed at:\n", await instance.getAddress());
        console.log("==================== Safe ====================");
    });
};

deploy.tags = ["singleton", "main-suite"];
export default deploy;
