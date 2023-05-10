import { Wallet, utils } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {
  console.log(`Running non-deterministic deploy script`);
  // Initialize the wallet.
  const { accounts } = hre.network.config;
  const wallet = new Wallet((<string[]>accounts)[0]);

  // Create deployer object and load the artifact of the contract to deploy.
  const deployer = new Deployer(hre, wallet);

    // Deploy SimulateTxAccessor contract
  const simulateTxAccessorArtifact = await deployer.loadArtifact("SimulateTxAccessor");
  const deployedSimulateTxAccessorContract = await deployer.deploy(simulateTxAccessorArtifact, []);
  const simulateTxAccessorContractAddress = deployedSimulateTxAccessorContract.address;
  console.log(`${simulateTxAccessorArtifact.contractName} was deployed to ${simulateTxAccessorContractAddress}`);

  // Deploy GnosisSafeProxyFactory contract
  const gnosisSafeProxyFactoryArtifact = await deployer.loadArtifact("GnosisSafeProxyFactory");
  const deployedGnosisSafeProxyFactoryContract = await deployer.deploy(gnosisSafeProxyFactoryArtifact, []);
  const gnosisSafeProxyFactoryContractAddress = deployedGnosisSafeProxyFactoryContract.address;
  console.log(`${gnosisSafeProxyFactoryArtifact.contractName} was deployed to ${gnosisSafeProxyFactoryContractAddress}`);

  // Deploy DefaultCallbackHandler contract
  const defaultCallbackHandlerArtifact = await deployer.loadArtifact("DefaultCallbackHandler");
  const deployedDefaultCallbackHandlerContract = await deployer.deploy(defaultCallbackHandlerArtifact, []);
  const defaultCallbackHandlerContractAddress = deployedDefaultCallbackHandlerContract.address;
  console.log(`${defaultCallbackHandlerArtifact.contractName} was deployed to ${defaultCallbackHandlerContractAddress}`);

  // Deploy CompatibilityFallbackHandler contract
  const compatibilityFallbackHandlerArtifact = await deployer.loadArtifact("CompatibilityFallbackHandler");
  const deployedCompatibilityFallbackHandlerContract = await deployer.deploy(compatibilityFallbackHandlerArtifact, []);
  const compatibilityFallbackHandlerContractAddress = deployedCompatibilityFallbackHandlerContract.address;
  console.log(`${compatibilityFallbackHandlerArtifact.contractName} was deployed to ${compatibilityFallbackHandlerContractAddress}`);

  // Deploy CreateCall contract
  const createCallArtifact = await deployer.loadArtifact("CreateCall");
  const deployedCreateCallContract = await deployer.deploy(createCallArtifact, []);
  const createCallContractAddress = deployedCreateCallContract.address;
  console.log(`${createCallArtifact.contractName} was deployed to ${createCallContractAddress}`);

  // Deploy MultiSend contract
  const multiSendArtifact = await deployer.loadArtifact("MultiSend");
  const deployedMultiSendContract = await deployer.deploy(multiSendArtifact, []);
  const multiSendContractAddress = deployedMultiSendContract.address;
  console.log(`${multiSendArtifact.contractName} was deployed to ${multiSendContractAddress}`);

  // Deploy MultiSendCallOnly contract
  const multiSendCallOnlyArtifact = await deployer.loadArtifact("MultiSendCallOnly");
  const deployedMultiSendCallOnlyContract = await deployer.deploy(multiSendCallOnlyArtifact, []);
  const multiSendCallOnlyContractAddress = deployedMultiSendCallOnlyContract.address;
  console.log(`${multiSendCallOnlyArtifact.contractName} was deployed to ${multiSendCallOnlyContractAddress}`);

  // Deploy SignMessageLib contract
  const signMessageLibArtifact = await deployer.loadArtifact("SignMessageLib");
  const deployedSignMessageLibContract = await deployer.deploy(signMessageLibArtifact, []);
  const signMessageLibContractAddress = deployedSignMessageLibContract.address;
  console.log(`${signMessageLibArtifact.contractName} was deployed to ${signMessageLibContractAddress}`);

  // Deploy GnosisSafeL2 contract
  const gnosisSafeL2Artifact = await deployer.loadArtifact("GnosisSafeL2");
  const deployedGnosisSafeL2Contract = await deployer.deploy(gnosisSafeL2Artifact, []);
  const gnosisSafeL2ContractAddress = deployedGnosisSafeL2Contract.address;
  console.log(`${gnosisSafeL2Artifact.contractName} was deployed to ${gnosisSafeL2ContractAddress}`);

  // Deploy GnosisSafe contract
  const gnosisSafeArtifact = await deployer.loadArtifact("GnosisSafe");
  const deployedGnosisSafeContract = await deployer.deploy(gnosisSafeArtifact, []);
  const gnosisSafeContractAddress = deployedGnosisSafeContract.address;
  console.log(`${gnosisSafeArtifact.contractName} was deployed to ${gnosisSafeContractAddress}`);

}