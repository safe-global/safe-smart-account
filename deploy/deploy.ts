import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { ethers } from "ethers";
import { HardhatRuntimeEnvironment, HttpNetworkConfig } from "hardhat/types";
import { Provider, utils, Wallet } from "zksync-web3";

const factoryABI = "[{\"inputs\":[{\"internalType\":\"bytes32\",\"name\":\"salt\",\"type\":\"bytes32\"},{\"internalType\":\"bytes32\",\"name\":\"bytecodeHash\",\"type\":\"bytes32\"},{\"internalType\":\"bytes\",\"name\":\"input\",\"type\":\"bytes\"}],\"name\":\"deployContract\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"contractAddress\",\"type\":\"address\"}],\"stateMutability\":\"payable\",\"type\":\"function\"}]";

export default async function deployContracts(hre: HardhatRuntimeEnvironment) {
  console.log(`Running deploy script`);

  const { url: rpcUrl, accounts } = hre.network.config as HttpNetworkConfig;
  const provider = new Provider(rpcUrl);
  const wallet = new Wallet((<string[]>accounts)[0]).connect(provider);

  let deterministicDeploymentInfo;
  if (typeof hre.config.deterministicDeployment === "function") {
    const { chainId } = await hre.ethers.provider.getNetwork();
    deterministicDeploymentInfo = hre.config.deterministicDeployment(chainId.toString());
    if (deterministicDeploymentInfo === undefined) throw new Error(`Cannot find deterministic deployment for ${4}`);
  } else {
    throw new Error("deterministicDeployment is not a function");
  }
  const { factory: factoryAddress, deployer: factoryDeployerAddress, funding, signedTx } = deterministicDeploymentInfo;

  let bytecode = await provider.getCode(factoryAddress);
  if (bytecode == "0x") {
    process.stdout.write(`\tsending eth to create2 contract deployer address (${factoryDeployerAddress})`);
    //const txFee = deterministicDeploymentInfo.gasPrice * deterministicDeploymentInfo.gasLimit;
    const transferTx = await wallet.sendTransaction({
      to: factoryDeployerAddress,
      value: hre.ethers.utils.parseEther(hre.ethers.utils.formatEther(funding.toString()))
    });
    process.stdout.write(` (tx: ${transferTx.hash})...\n`);
    await transferTx.wait();

    process.stdout.write(`deploying create2 deployer contract (at ${factoryAddress}) using deterministic deployment`);
    const sentTx = await provider.sendTransaction(signedTx);
    process.stdout.write(` (tx: ${sentTx.hash})...\n`);
    await sentTx.wait();

    const receipt = await provider.getTransactionReceipt(sentTx.hash);
    const deployedAddress = receipt.contractAddress;

    if (deployedAddress !== factoryAddress) {
      throw new Error("Failed to deploy deployer factory: deployed address is not the same as expected factory address");
    }
  } else {
    console.log(`   create2 deployer contract already deployed at ${factoryAddress}`);
  }

  const factory = new ethers.Contract(factoryAddress, factoryABI, wallet);

  const salt = hre.ethers.constants.HashZero;
  const deployer = new Deployer(hre, wallet);
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
    const bytecodeHash = utils.hashBytecode(artifact.bytecode);
    const input = new hre.ethers.utils.AbiCoder().encode([], []);
    const contractAddress = utils.create2Address(factory.address, bytecodeHash, salt, input);
    const contractName = artifact.contractName;

    let bytecode = await provider.getCode(contractAddress);
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
    const receipt = await provider.getTransactionReceipt(tx.hash);
    bytecode = await provider.getCode(contractAddress);

    if (bytecode !== artifact.bytecode || receipt.contractAddress !== contractAddress) {
      throw new Error(`Failed to deploy ${contractName}`);
    }

    process.stdout.write(
      `: deployed at ${receipt.contractAddress} with ${receipt.gasUsed} gas\n`
    );
    deployments[contractName] = contractAddress;
  }
}
