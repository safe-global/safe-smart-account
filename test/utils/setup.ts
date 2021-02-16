import hre, { deployments } from "hardhat"
import { Wallet, Contract } from "ethers"
import { AddressZero } from "@ethersproject/constants";
import solc from "solc"

export const defaultCallbackHandlerDeployment = async () => {
    return await deployments.get("DefaultCallbackHandler");
}

export const defaultCallbackHandlerContract = async () => {
    return await hre.ethers.getContractFactory("DefaultCallbackHandler");
}

export const getSafeSingleton = async () => {
    const SafeDeployment = await deployments.get("GnosisSafe");
    const Safe = await hre.ethers.getContractFactory("GnosisSafe");
    return Safe.attach(SafeDeployment.address);
}

export const getFactory = async () => {
    const FactoryDeployment = await deployments.get("GnosisSafeProxyFactory");
    const Factory = await hre.ethers.getContractFactory("GnosisSafeProxyFactory");
    return Factory.attach(FactoryDeployment.address);
}

export const getSafeTemplate = async () => {
    const singleton = await getSafeSingleton()
    const factory = await getFactory()
    const template = await factory.callStatic.createProxy(singleton.address, "0x")
    await factory.createProxy(singleton.address, "0x").then((tx: any) => tx.wait())
    const Safe = await hre.ethers.getContractFactory("GnosisSafe");
    return Safe.attach(template);
}

export const getSafeWithOwners = async (owners: string[], threhsold?: number) => {
    const template = await getSafeTemplate()
    await template.setup(owners, threhsold || owners.length, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero)
    return template
}

export const getDefaultCallbackHandler = async () => {
    return (await defaultCallbackHandlerContract()).attach((await defaultCallbackHandlerDeployment()).address);
}

export const compile = async (source: string) => {
    const input = JSON.stringify({
        'language': 'Solidity',
        'settings': {
            'outputSelection': {
            '*': {
                '*': [ 'abi', 'evm.bytecode' ]
            }
            }
        },
        'sources': {
            'tmp.sol': {
                'content': source
            }
        }
    });
    const solcData = await solc.compile(input)
    const output = JSON.parse(solcData);
    if (!output['contracts']) {
        console.log(output)
        throw Error("Could not compile contract")
    }
    const fileOutput = output['contracts']['tmp.sol']
    const contractOutput = fileOutput[Object.keys(fileOutput)[0]]
    const abi = contractOutput['abi']
    const data = '0x' + contractOutput['evm']['bytecode']['object']
    return {
        "data": data,
        "interface": abi
    }
}

export const deployContract = async (deployer: Wallet, source: string): Promise<Contract> => {
    const output = await compile(source)
    const contractInterface = output.interface
    const contractBytecode = output.data
    const transaction = await deployer.sendTransaction({ data: contractBytecode, gasLimit: 6000000 })
    const receipt = await transaction.wait()
    return new Contract(receipt.contractAddress, contractInterface, deployer)
}