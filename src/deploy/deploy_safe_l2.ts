import { DeployFunction } from "@elvis-krop/hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import getZkDeployer from "../zk-utils/getZkDeployer";

const deploy: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment,
) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  await deploy("GnosisSafeL2", {
    from: network.zksync ? getZkDeployer(hre).zkWallet.privateKey : deployer,
    args: [],
    log: true,
    deterministicDeployment: !network.zksync,
  });

  // Deploy GnosisSafeL2Zk with a fix for send() => call() to run tests
  if (network.zksync) {
    await deploy("GnosisSafeL2Zk", {
      from: network.zksync ? getZkDeployer(hre).zkWallet.privateKey : deployer,
      args: [],
      log: true,
      deterministicDeployment: !network.zksync,
    });
  }
};

deploy.tags = ['l2', 'l2-suite']
export default deploy;
