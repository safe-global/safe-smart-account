import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import { BigNumber } from "ethers";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { defaultCallbackHandlerContract, defaultCallbackHandlerDeployment, deployContract, getMock, getSafeTemplate } from "../utils/setup";
import { executeContractCallWithSigners } from "../../src/utils/execution";

describe("FallbackManager", async () => {

    const setupWithTemplate = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const source = `
        contract Mirror {
            function lookAtMe() public returns (bytes memory) {
                return msg.data;
            }

            function nowLookAtYou(address you, string memory howYouLikeThat) public returns (bytes memory) {
                return msg.data;
            }
        }`
        const mirror = await deployContract(user1, source);
        return {
            safe: await getSafeTemplate(),
            mirror
        }
    })

    const [user1, user2] = waffle.provider.getWallets();

    describe("setFallbackManager", async () => {
        it('is correctly set on deployment', async () => {
            const { safe } = await setupWithTemplate()
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
            const { safe } = await setupWithTemplate()
            const handler = await defaultCallbackHandlerDeployment()

            // Setup Safe
            await safe.setup([user1.address, user2.address], 1, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero)

            // Check fallback handler
            await expect(
                await hre.ethers.provider.getStorageAt(safe.address, "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5")
            ).to.be.eq("0x" + "".padStart(64, "0"))

            await expect(
                executeContractCallWithSigners(safe, safe, "setFallbackHandler", [handler.address], [user1])
            ).to.emit(safe, "ChangedFallbackHandler").withArgs(handler.address)

            // Check fallback handler
            await expect(
                await hre.ethers.provider.getStorageAt(safe.address, "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5")
            ).to.be.eq("0x" + handler.address.toLowerCase().slice(2).padStart(64, "0"))

        })

        it('emits event when is set', async () => {
            const { safe } = await setupWithTemplate()
            const handler = await defaultCallbackHandlerDeployment()

            // Setup Safe
            await safe.setup([user1.address, user2.address], 1, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero)

            // Check event
            await expect(
                executeContractCallWithSigners(safe, safe, "setFallbackHandler", [handler.address], [user1])
            ).to.emit(safe, "ChangedFallbackHandler").withArgs(handler.address)
        })

        it('is called when set', async () => {
            const { safe } = await setupWithTemplate()
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

        it('sends along msg.sender on simple call', async () => {
            const { safe, mirror } = await setupWithTemplate()
            // Setup Safe
            await safe.setup([user1.address, user2.address], 1, AddressZero, "0x", mirror.address, AddressZero, 0, AddressZero)

            const tx = {
                to: safe.address,
                data: mirror.interface.encodeFunctionData("lookAtMe")
            }
            // Check that mock works as handler
            const response = await user1.call(tx)
            expect(response).to.be.eq(
                "0x" +
                "0000000000000000000000000000000000000000000000000000000000000020" +
                "0000000000000000000000000000000000000000000000000000000000000018" +
                "7f8dc53c" + user1.address.slice(2).toLowerCase() + "0000000000000000"
            )
        })

        it('sends along msg.sender on more complex call', async () => {
            const { safe, mirror } = await setupWithTemplate()
            // Setup Safe
            await safe.setup([user1.address, user2.address], 1, AddressZero, "0x", mirror.address, AddressZero, 0, AddressZero)

            const tx = {
                to: safe.address,
                data: mirror.interface.encodeFunctionData("nowLookAtYou", [user2.address, "pink<>black"])
            }
            // Check that mock works as handler
            const response = await user1.call(tx)
            expect(response).to.be.eq(
                "0x" +
                "0000000000000000000000000000000000000000000000000000000000000020" +
                "0000000000000000000000000000000000000000000000000000000000000098" +
                // Function call
                "b2a88d99" +
                "000000000000000000000000" + user2.address.slice(2).toLowerCase() +
                "0000000000000000000000000000000000000000000000000000000000000040" +
                "000000000000000000000000000000000000000000000000000000000000000b" +
                "70696e6b3c3e626c61636b000000000000000000000000000000000000000000" +
                user1.address.slice(2).toLowerCase() + "0000000000000000"
            )
        })
    })
})