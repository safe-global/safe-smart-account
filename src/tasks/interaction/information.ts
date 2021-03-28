import { task, types } from "hardhat/config";
import { HardhatRuntimeEnvironment as HRE } from "hardhat/types";
import { getAddress } from "@ethersproject/address";
import { AddressOne } from "../../utils/constants";
import { Contract } from "@ethersproject/contracts";
import { contractFactory } from "./contracts";

const getSingletonAddress = async (hre: HRE, address: string): Promise<string> => {
    const result = await hre.ethers.provider.getStorageAt(address, 0)
    return getAddress("0x" + result.slice(26))
}

const getModules = async (hre: HRE, safe: Contract): Promise<string[]> => {
    try {
        return (await safe.getModulesPaginated(AddressOne, 10))[0]
    } catch (e) {
    }
    try {
        const compat = await contractFactory(hre, "CompatibilityFallbackHandler")
        return await compat.attach(safe.address).getModules()
    } catch (e) {
    }
    return ["Could not load modules"]
}

task("safe-info", "Returns information about a Safe")
    .addParam("address", "Address or ENS name of the Safe to check", undefined, types.string)
    .setAction(async (taskArgs, hre) => {
        const safe = (await contractFactory(hre, "GnosisSafe")).attach(taskArgs.address)
        const safeAddress = await safe.resolvedAddress
        console.log(`Checking Safe at ${safeAddress}`)
        console.log(`Singleton: ${await getSingletonAddress(hre, safeAddress)}`)
        console.log(`Version: ${await safe.VERSION()}`)
        console.log(`Owners: ${await safe.getOwners()}`)
        console.log(`Threshold: ${await safe.getThreshold()}`)
        console.log(`Modules: ${await getModules(hre, safe)}`)
    });