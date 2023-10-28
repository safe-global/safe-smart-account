import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import "@nomicfoundation/hardhat-ethers";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;

    await deploy("SimulateTxAccessor", {
        from: deployer,
        args: [],
        log: true,
        deterministicDeployment: true,
    }).catch(async (e) => {
        const simulateTxAccessor = await ethers.getContractFactory("SimulateTxAccessor");
        const deployed = await simulateTxAccessor.deploy();
        const instance = await deployed.waitForDeployment();
        console.log(`\n================ SimulateTxAccessor ====================`);
        console.log("SimulateTxAccessor deployed at:", await instance.getAddress());
        console.log(`================ SimulateTxAccessor ====================`);
    });
};

deploy.tags = ["accessors", "l2-suite", "main-suite"];
export default deploy;
