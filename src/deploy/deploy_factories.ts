import { DeployFunction } from "@elvis-krop/hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import getZkDeployer from "../zk-utils/getZkDeployer";

const deploy: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment,
) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  await deploy("GnosisSafeProxyFactory", {
    from: network.zksync ? getZkDeployer(hre).zkWallet.privateKey : deployer,
    args: [],
    log: true,
    deterministicDeployment: !network.zksync,
  });
};

deploy.tags = ['factory', 'l2-suite', 'main-suite']
export default deploy;
