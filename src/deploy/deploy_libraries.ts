import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment,
) {
  const { deployments, hardhatArguments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  await deploy("CreateCall", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true,
  });

  await deploy("MultiSend", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true,
  });

  await deploy("MultiSendCallOnly", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true,
  });
};

deploy.tags = ['libraries']
export default deploy;
