import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment,
) {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  await deploy("SimulateTxAccessor", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true,
  });
};

deploy.tags = ['accessors']
export default deploy;
