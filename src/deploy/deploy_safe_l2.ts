import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;

    await deploy("SafeL2", {
        from: deployer,
        args: [],
        log: true,
        deterministicDeployment: true,
    }).catch(async (e) => {
        const safeL2 = await hre.ethers.getContractFactory("SafeL2");
        const deployed = await safeL2.deploy();
        const instance = await deployed.waitForDeployment();
        console.log("==================== SafeL2 ====================");
        console.log("SafeL2 deployed at:\n", await instance.getAddress());
        console.log("==================== SafeL2 ====================");
    });
};

deploy.tags = ["l2", "l2-suite"];
export default deploy;
