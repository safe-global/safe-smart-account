import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment,
) {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  await deploy("GnosisSafeL2", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: false,
    gasLimit: 9000000,
  });
};

deploy.tags = ['l2', 'l2-suite']
export default deploy;
