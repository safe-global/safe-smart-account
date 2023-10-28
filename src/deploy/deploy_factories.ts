import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import "@nomicfoundation/hardhat-ethers";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;

    await deploy("SafeProxyFactory", {
        from: ethers.provider.getSigner(deployer),
        args: [],
        log: true,
        deterministicDeployment: true,
    }).catch(async (e) => {
        const safeProxyFactory = await ethers.getContractFactory("SafeProxyFactory");
        const deployed = await safeProxyFactory.deploy();
        const instance = await deployed.waitForDeployment();
        console.log("\n================ SafeProxyFactory ====================");
        console.log("SafeProxyFactory deployed at:", await instance.getAddress());
        console.log("================ SafeProxyFactory ====================");
    });
};

deploy.tags = ["factory", "l2-suite", "main-suite"];
export default deploy;
