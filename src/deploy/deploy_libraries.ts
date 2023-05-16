import { DeployFunction } from "@elvis-krop/hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import getZkDeployer from "../zk-utils/getZkDeployer";

const deploy: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment,
) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;


  await deploy("CreateCall", {
    from: network.zksync ? getZkDeployer(hre).zkWallet.privateKey : deployer,
    args: [],
    log: true,
    deterministicDeployment: !network.zksync,
  });

  await deploy("MultiSend", {
    from: network.zksync ? getZkDeployer(hre).zkWallet.privateKey : deployer,
    args: [],
    log: true,
    deterministicDeployment: !network.zksync,
  });

  await deploy("MultiSendCallOnly", {
    from: network.zksync ? getZkDeployer(hre).zkWallet.privateKey : deployer,
    args: [],
    log: true,
    deterministicDeployment: !network.zksync,
  });

  await deploy("SignMessageLib", {
    from: network.zksync ? getZkDeployer(hre).zkWallet.privateKey : deployer,
    args: [],
    log: true,
    deterministicDeployment: !network.zksync,
  });
};

deploy.tags = ['libraries', 'l2-suite', 'main-suite']
export default deploy;
