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
    deterministicDeployment: false,
  });

  await deploy("MultiSend", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: false,
  });

  await deploy("MultiSendCallOnly", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: false,
  });

  await deploy("SignMessageLib", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: false,
  });
};

deploy.tags = ['libraries', 'l2-suite', 'main-suite']
export default deploy;
