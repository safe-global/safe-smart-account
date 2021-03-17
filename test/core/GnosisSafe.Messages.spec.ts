import { expect } from "chai";
import { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { getSafeWithOwners } from "../utils/setup";
import { executeContractCallWithSigners, calculateSafeMessageHash } from "../utils/execution";
import { chainId } from "../utils/encoding";

describe("GnosisSafe", async () => {

    const [user1, user2] = waffle.provider.getWallets()

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        return {
            safe: await getSafeWithOwners([user1.address, user2.address])
        }
    })

    describe("getMessageHash", async () => {
        it('should generate the correct hash', async () => {
            const { safe } = await setupTests()
            expect(
                await safe.getMessageHash("0xdead")
            ).to.be.eq(calculateSafeMessageHash(safe, "0xdead", await chainId()))
        })
    })

    describe("signMessage", async () => {

        it('can only be called from Safe itself', async () => {
            const { safe } = await setupTests()
            await expect(safe.signMessage("0xbaddad")).to.be.revertedWith("GS031")
        })

        it('should emit event', async () => {
            const { safe } = await setupTests()
            await expect(
                executeContractCallWithSigners(safe, safe, "signMessage", ["0xbaddad"], [user1, user2])
            ).to.emit(safe, "SignMsg").withArgs(calculateSafeMessageHash(safe, "0xbaddad", await chainId()))
        })
    })
})