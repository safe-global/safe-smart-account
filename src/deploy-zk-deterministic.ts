import hre from "hardhat";
import zk from "zksync-web3";
import { factoryABI } from "./zk-utils/constants";
import { getDeployer } from "./zk-utils/getDeployer";

;(async () => {
  try {
    if (!hre.network.zksync) throw new Error("This script can work only on zksync networks!")

    console.log(`Running deploy script`);
    const deployer = getDeployer(hre);

    let deterministicDeploymentInfo;
    if (typeof hre.config.deterministicDeployment === "function") {
      const { chainId } = await hre.ethers.provider.getNetwork();
      deterministicDeploymentInfo = hre.config.deterministicDeployment(chainId.toString());
      if (deterministicDeploymentInfo === undefined) throw new Error(`Cannot find deterministic deployment for ${4}`);
    } else {
      throw new Error("deterministicDeployment is not a function");
    }
    const { factory: factoryAddress, deployer: factoryDeployerAddress, funding, signedTx } = deterministicDeploymentInfo;

    let bytecode = await deployer.zkWallet.provider.getCode(factoryAddress);
    if (bytecode == "0x") {
      process.stdout.write(`\tsending eth to create2 contract deployer address (${factoryDeployerAddress})`);
      //const txFee = deterministicDeploymentInfo.gasPrice * deterministicDeploymentInfo.gasLimit;
      const transferTx = await deployer.zkWallet.sendTransaction({
        to: factoryDeployerAddress,
        value: hre.ethers.utils.parseEther(hre.ethers.utils.formatEther(funding.toString()))
      });
      process.stdout.write(` (tx: ${transferTx.hash})...\n`);
      await transferTx.wait();

      process.stdout.write(`deploying create2 deployer contract (at ${factoryAddress}) using deterministic deployment`);
      const sentTx = await deployer.zkWallet.provider.sendTransaction(signedTx);
      process.stdout.write(` (tx: ${sentTx.hash})...\n`);
      await sentTx.wait();

      const receipt = await deployer.zkWallet.provider.getTransactionReceipt(sentTx.hash);
      const deployedAddress = receipt.contractAddress;

      if (deployedAddress !== factoryAddress) {
        console.table({ deployedAddress, factoryAddress });
        throw new Error("Failed to deploy deployer factory: deployed address is not the same as expected factory address");
      }
    } else {
      console.log(`   create2 deployer contract already deployed at ${factoryAddress}`);
    }

    const factory = new zk.Contract(factoryAddress, factoryABI, deployer.zkWallet);

    const salt = hre.ethers.constants.HashZero;
    const artifacts = [
      await deployer.loadArtifact("SimulateTxAccessor"),
      await deployer.loadArtifact("GnosisSafeProxyFactory"),
      await deployer.loadArtifact("DefaultCallbackHandler"),
      await deployer.loadArtifact("CompatibilityFallbackHandler"),
      await deployer.loadArtifact("CreateCall"),
      await deployer.loadArtifact("MultiSend"),
      await deployer.loadArtifact("MultiSendCallOnly"),
      await deployer.loadArtifact("SignMessageLib"),
      await deployer.loadArtifact("GnosisSafeL2"),
      await deployer.loadArtifact("GnosisSafe")
    ];

    const deployments: Record<string, string> = {};
    for (const artifact of artifacts) {
      const bytecodeHash = zk.utils.hashBytecode(artifact.bytecode);
      const input = new hre.ethers.utils.AbiCoder().encode([], []);
      const contractAddress = zk.utils.create2Address(factory.address, bytecodeHash, salt, input);
      const contractName = artifact.contractName;

      let bytecode = await deployer.zkWallet.provider.getCode(contractAddress);
      if (bytecode !== "0x") {
        console.log(`reusing ${contractName} at ${contractAddress}`);
        deployments[contractName] = contractAddress;
        continue;
      }

      process.stdout.write(`deploying ${contractName}`);
      const tx = await factory.deployContract(salt, bytecodeHash, input, {
        customData: {
          factoryDeps: [artifact.bytecode]
        }
      });
      process.stdout.write(` (tx: ${tx.hash})...`);

      await tx.wait();
      const receipt = await deployer.zkWallet.provider.getTransactionReceipt(tx.hash);
      bytecode = await deployer.zkWallet.provider.getCode(contractAddress);

      if (bytecode !== artifact.bytecode || receipt.contractAddress !== contractAddress) {
        throw new Error(`Failed to deploy ${contractName}`);
      }

      process.stdout.write(
        `: deployed at ${receipt.contractAddress} with ${receipt.gasUsed} gas\n`
      );
      deployments[contractName] = contractAddress;
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
