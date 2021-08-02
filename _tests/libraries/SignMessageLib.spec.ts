import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { getSafeWithOwners } from "../utils/setup";
import { executeContractCallWithSigners, calculateSafeMessageHash } from "../../src/utils/execution";
import { chainId } from "../utils/encoding";

describe("SignMessageLib", async () => {

    const [user1, user2] = waffle.provider.getWallets()

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const lib = await (await hre.ethers.getContractFactory("SignMessageLib")).deploy();
        return {
            safe: await getSafeWithOwners([user1.address, user2.address]),
            lib
        }
    })

    describe("signMessage", async () => {

        it('can only if msg.sender provides domain separator', async () => {
            const { lib } = await setupTests()
            await expect(lib.signMessage("0xbaddad")).to.be.reverted
        })

        it('should emit event', async () => {
            const { safe, lib } = await setupTests()
            // Required to check that the event was emitted from the right address
            const libSafe = lib.attach(safe.address)
            const messageHash = calculateSafeMessageHash(safe, "0xbaddad", await chainId())
            
            expect(
                await safe.signedMessages(messageHash)
            ).to.be.eq(0)

            await expect(
                executeContractCallWithSigners(safe, lib, "signMessage", ["0xbaddad"], [user1, user2], true)
            ).to.emit(libSafe, "SignMsg").withArgs(messageHash)

            expect(
                await safe.signedMessages(messageHash)
            ).to.be.eq(1)
        })
    })
})