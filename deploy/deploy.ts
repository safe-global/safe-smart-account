import { Wallet, Provider, utils } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment, HttpNetworkConfig } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

const factoryABI = '[{"inputs":[{"internalType":"bytes32","name":"salt","type":"bytes32"},{"internalType":"bytes32","name":"bytecodeHash","type":"bytes32"},{"internalType":"bytes","name":"input","type":"bytes"}],"name":"deployContract","outputs":[{"internalType":"address","name":"contractAddress","type":"address"}],"stateMutability":"payable","type":"function"}]';

export default async function deployContracts(hre: HardhatRuntimeEnvironment) {
  console.log(`Running deploy script`);
  console.log(hre.network.config as HttpNetworkConfig);

  const provider = new Provider((hre.network.config as HttpNetworkConfig).url);
  const wallet = new Wallet((hre.network.config as HttpNetworkConfig).accounts[0]).connect(provider);

  let deterministicDeploymentInfo;
  if (typeof hre.config.deterministicDeployment === 'function') {
    deterministicDeploymentInfo = hre.config.deterministicDeployment((await provider.getNetwork()).chainId.toString());
  } else {
    throw new Error('deterministicDeployment is not a function');
  }
  const factoryAddress = deterministicDeploymentInfo.factory;

  let bytecode = await provider.getCode(factoryAddress);
  if (bytecode == "0x") {
    process.stdout.write(`   sending eth to create2 contract deployer address (${deterministicDeploymentInfo.deployer})`);
    //const txFee = deterministicDeploymentInfo.gasPrice * deterministicDeploymentInfo.gasLimit;
    const transferTx = await wallet.sendTransaction({
        to: deterministicDeploymentInfo.deployer,
        value: ethers.utils.parseEther(ethers.utils.formatEther(deterministicDeploymentInfo.funding.toString())),
      })
    process.stdout.write(` (tx: ${transferTx.hash})...\n`);
    await transferTx.wait();

    process.stdout.write(`deploying create2 deployer contract (at ${deterministicDeploymentInfo.factory}) using deterministic deployment`);
    const sentTx = await provider.sendTransaction(deterministicDeploymentInfo.signedTx);
    process.stdout.write(` (tx: ${sentTx.hash})...\n`);
    await sentTx.wait();

    const receipt = await provider.getTransactionReceipt(sentTx.hash);
    const deployedAddress = receipt.contractAddress;
    
    if(deployedAddress !== factoryAddress) {
      throw new Error("Failed to deploy deployer factory: deployed address is not the same as expected factory address");
    }
  } else {
    console.log(`   create2 deployer contract already deployed at ${deterministicDeploymentInfo.factory}`)
  }

  const factory = new ethers.Contract(factoryAddress, factoryABI, wallet);

  const salt = ethers.constants.HashZero;
  const deployer = new Deployer(hre, wallet);
  const artifacts = [
    await deployer.loadArtifact("SimulateTxAccessor"),
    await deployer.loadArtifact("SafeProxyFactory"),
    await deployer.loadArtifact("TokenCallbackHandler"),
    await deployer.loadArtifact("CompatibilityFallbackHandler"),
    await deployer.loadArtifact("CreateCall"),
    await deployer.loadArtifact("MultiSend"),
    await deployer.loadArtifact("MultiSendCallOnly"),
    await deployer.loadArtifact("SignMessageLib"),
    await deployer.loadArtifact("SafeL2"),
    await deployer.loadArtifact("Safe"),
  ];

  const deployments = {};
  for (const artifact of artifacts) {
    const bytecodeHash = utils.hashBytecode(artifact.bytecode);
    const input = new ethers.utils.AbiCoder().encode([], []);
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
        factoryDeps: [artifact.bytecode],
      },
    });
    process.stdout.write(` (tx: ${tx.hash})...`);

    await tx.wait();
    const receipt = await provider.getTransactionReceipt(tx.hash);
    bytecode = await provider.getCode(contractAddress);

    if (bytecode !== artifact.bytecode || receipt?.contractAddress !== contractAddress) {
      throw new Error(`Failed to deploy ${contractName}`);
    }

    process.stdout.write(
      `: deployed at ${receipt?.contractAddress} with ${receipt?.gasUsed} gas\n`
    );
    deployments[contractName] = contractAddress;
  }
}