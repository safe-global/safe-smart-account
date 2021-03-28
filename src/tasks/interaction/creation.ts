import { task, types } from "hardhat/config";
import { AddressZero } from "@ethersproject/constants";
import { getAddress } from "@ethersproject/address";
import { calculateProxyAddress } from "../../utils/proxies";
import { safeSingleton, proxyFactory } from "./contracts";

const parseSigners = (rawSigners: string): string[] => {
    return rawSigners.split(",").map(address => getAddress(address))
}

task("create-safe", "Deploys and verifies Safe contracts")
    .addFlag("l2", "Should use version of the Safe contract that is more event heave")
    .addParam("signers", "Comma separated list of signer addresses (dafault is the address of linked account)", undefined, types.string, true)
    .addParam("threshold", "Threshold that should be used", 1, types.int, true)
    .addParam("fallback", "Fallback handler address", AddressZero, types.string, true)
    .addParam("nonce", "Nonce used with factory", new Date().getTime(), types.int, true)
    .setAction(async (taskArgs, hre) => {
        const singleton = await safeSingleton(hre, taskArgs.l2)
        const factory = await proxyFactory(hre)
        const signers: string[] = taskArgs.signers ? parseSigners(taskArgs.signers) : [(await hre.getNamedAccounts()).deployer]
        const fallbackHandler = getAddress(taskArgs.fallback)
        const setupData = singleton.interface.encodeFunctionData(
            "setup",
            [signers, taskArgs.threshold, AddressZero, "0x", fallbackHandler, AddressZero, 0, AddressZero]
        )
        const predictedAddress = await calculateProxyAddress(factory, singleton.address, setupData, taskArgs.nonce)
        console.log(`Deploy Safe to ${predictedAddress}`)
        await factory.createProxyWithNonce(singleton.address, setupData, taskArgs.nonce).then((tx: any) => tx.wait())
        // TODO verify deployment
    });

export { }