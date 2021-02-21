import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import { BigNumber } from "ethers";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { defaultCallbackHandlerContract, defaultCallbackHandlerDeployment, getSafeTemplate } from "../utils/setup";
import { executeContractCallWithSigners } from "../utils/execution";

describe("FallbackManager", async () => {

    const setupWithTemplate = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        return await getSafeTemplate()
    })

    const [user1, user2] = waffle.provider.getWallets();

    describe("setFallbackManager", async () => {
        it('is correctly set on deployment', async () => {
            const safe = await setupWithTemplate()
            const handler = await defaultCallbackHandlerDeployment()

            // Check fallback handler
            await expect(
                await hre.ethers.provider.getStorageAt(safe.address, "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5")
            ).to.be.eq("0x" + "".padStart(64, "0"))

            // Setup Safe
            await safe.setup([user1.address, user2.address], 1, AddressZero, "0x", handler.address, AddressZero, 0, AddressZero)

            // Check fallback handler
            await expect(
                await hre.ethers.provider.getStorageAt(safe.address, "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5")
            ).to.be.eq("0x" + handler.address.toLowerCase().slice(2).padStart(64, "0"))

        })

        it('is correctly set', async () => {
            const safe = await setupWithTemplate()
            const handler = await defaultCallbackHandlerDeployment()

            // Setup Safe
            await safe.setup([user1.address, user2.address], 1, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero)

            // Check fallback handler
            await expect(
                await hre.ethers.provider.getStorageAt(safe.address, "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5")
            ).to.be.eq("0x" + "".padStart(64, "0"))

            await executeContractCallWithSigners(safe, safe, "setFallbackHandler", [handler.address], [user1])

            // Check fallback handler
            await expect(
                await hre.ethers.provider.getStorageAt(safe.address, "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5")
            ).to.be.eq("0x" + handler.address.toLowerCase().slice(2).padStart(64, "0"))

        })

        it('is called when set', async () => {
            const safe = await setupWithTemplate()
            const handler = await defaultCallbackHandlerDeployment()
            const safeHandler = (await defaultCallbackHandlerContract()).attach(safe.address)
            // Check that Safe is NOT setup
            await expect(await safe.getThreshold()).to.be.deep.eq(BigNumber.from(0))

            // Check unset callbacks
            await expect(
                safeHandler.callStatic.onERC1155Received(AddressZero, AddressZero, 0, 0, "0x")
            ).to.be.reverted

            // Setup Safe
            await safe.setup([user1.address, user2.address], 1, AddressZero, "0x", handler.address, AddressZero, 0, AddressZero)

            // Check callbacks
            await expect(
                await safeHandler.callStatic.onERC1155Received(AddressZero, AddressZero, 0, 0, "0x")
            ).to.be.eq("0xf23a6e61")
        })
    })
})