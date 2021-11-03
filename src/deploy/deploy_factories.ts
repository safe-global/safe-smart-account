import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment,
) {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  await deploy("GnosisSafeProxyFactory", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: false,
    gasLimit: 9000000,
  });
};

deploy.tags = ['factory', 'l2-suite', 'main-suite']
export default deploy;
