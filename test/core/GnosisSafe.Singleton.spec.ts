import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { getSafeWithOwners, getSafeSingleton } from "../utils/setup";
import { executeContractCallWithSigners } from "../utils/execution";

describe("Singleton", async () => {

    const [user1, user2] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        return {
            singleton: await getSafeSingleton(),
            safe: await getSafeWithOwners([user1.address])
        }
    })

    describe("changeMasterCopy", async () => {
        it('can only be called from Safe itself', async () => {
            const { safe } = await setupTests()
            await expect(safe.changeMasterCopy(user2.address)).to.be.revertedWith("Method can only be called from this contract")
        })

        it('can not set 0 Address', async () => {
            const { safe } = await setupTests()

            await expect(
                executeContractCallWithSigners(safe, safe, "changeMasterCopy", [AddressZero], [user1])
            ).to.emit(safe, "ExecutionFailure")
        })

        it('emits event for new master copy', async () => {
            const { safe, singleton } = await setupTests()
            
            expect(
                await hre.ethers.provider.getStorageAt(safe.address, 0)
            ).to.be.eq("0x" + singleton.address.toLowerCase().slice(2).padStart(64, "0"))

            await expect(
                executeContractCallWithSigners(safe, safe, "changeMasterCopy", [user2.address], [user1])
            ).to.emit(safe, "ChangedMasterCopy").withArgs(user2.address)

            expect(
                await hre.ethers.provider.getStorageAt(safe.address, 0)
            ).to.be.eq("0x" + user2.address.toLowerCase().slice(2).padStart(64, "0"))
        })
    })
})