import { DeployFunction } from "@elvis-krop/hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import getZkDeployer from "../zk-utils/getZkDeployer";

const deploy: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment,
) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  await deploy("SimulateTxAccessor", {
    from: network.zksync ? getZkDeployer(hre).zkWallet.privateKey : deployer,
    args: [],
    log: true,
    // FIXME: enable deterministicDeployment for zkSync after hardhat-deploy will support it
    deterministicDeployment: !network.zksync,
  });
};

deploy.tags = ['accessors', 'l2-suite', 'main-suite']
export default deploy;
