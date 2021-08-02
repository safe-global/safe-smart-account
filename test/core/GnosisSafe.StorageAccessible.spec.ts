import { expect } from "chai";
import { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { getSafeSingleton, getDefaultCallbackHandler, getSafeWithOwners } from "../utils/setup";
import { utils } from "ethers";
import { killLibContract } from "../utils/contracts";

describe("StorageAccessible", async () => {

    const [user1, user2] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const handler = await getDefaultCallbackHandler()
        const killLib = await killLibContract(user1);
        return {
            safe: await getSafeWithOwners([user1.address, user2.address], 1, handler.address),
            killLib,
            handler
        }
    })

    describe("getStorageAt", async () => {

        it('can read singleton', async () => {
            await setupTests()
            const singleton = await getSafeSingleton()
            expect(
                await singleton.getStorageAt(3, 2)
            ).to.be.eq(utils.solidityPack(['uint256', 'uint256'], [0, 1]))
        })

        it('can read instantiated Safe', async () => {
            const { safe } = await setupTests()
            const singleton = await getSafeSingleton()
            // Read singleton address, empty slots for module and owner linked lists, owner count and threshold
            expect(
                await safe.getStorageAt(0, 5)
            ).to.be.eq(utils.solidityPack(['uint256', 'uint256', 'uint256', 'uint256', 'uint256'], [singleton.address, 0, 0, 2, 1]))
        })
    })

    describe("simulateAndRevert", async () => {

        it('should revert changes', async () => {
            const { safe, killLib } = await setupTests()
            await expect(
                safe.callStatic.simulateAndRevert(killLib.address, killLib.interface.encodeFunctionData("killme"))
            ).to.be.reverted
        })

        it('should revert the revert with message', async () => {
            const { safe, killLib } = await setupTests()
            await expect(
                safe.callStatic.simulateAndRevert(killLib.address, killLib.interface.encodeFunctionData("trever"))
            ).to.be.reverted
        })

        it('should return estimate in revert', async () => {
            const { safe, killLib } = await setupTests()
            await expect(
                safe.callStatic.simulateAndRevert(killLib.address, killLib.interface.encodeFunctionData("estimate", [safe.address, "0x"]))
            ).to.be.reverted
        })
    })
})