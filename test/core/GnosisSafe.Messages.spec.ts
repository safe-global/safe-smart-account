import { expect } from "chai";
import { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { getSafeWithOwners } from "../utils/setup";
import { buildSignatureBytes, executeContractCallWithSigners, calculateSafeMessageHash, EIP712_SAFE_MESSAGE_TYPE, signHash } from "../utils/execution";
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
            await expect(safe.signMessage("0xbaddad")).to.be.revertedWith("Method can only be called from this contract")
        })

        it('should emit event', async () => {
            const { safe } = await setupTests()
            await expect(
                executeContractCallWithSigners(safe, safe, "signMessage", ["0xbaddad"], [user1, user2])
            ).to.emit(safe, "SignMsg").withArgs(calculateSafeMessageHash(safe, "0xbaddad", await chainId()))
        })
    })

    describe("isValidsignature", async () => {

        it('should revert if message was not signed', async () => {
            const { safe } = await setupTests()
            await expect(safe.callStatic.isValidSignature("0xbaddad", "0x")).to.be.revertedWith("Hash not approved")
        })

        it('should revert if signature is not valid', async () => {
            const { safe } = await setupTests()
            await expect(safe.callStatic.isValidSignature("0xbaddad", "0xdeaddeaddeaddead")).to.be.reverted
        })

        it.skip('should not change state', async () => {
            // Call via contract with static call
            // Check that it doesn't revert
        })

        it('should return magic value if message was signed', async () => {
            const { safe } = await setupTests()
            await executeContractCallWithSigners(safe, safe, "signMessage", ["0xbaddad"], [user1, user2])
            expect(await safe.callStatic.isValidSignature("0xbaddad", "0x")).to.be.eq("0x20c13b0b")
        })

        it('should return magic value if enough owners signed', async () => {
            const { safe } = await setupTests()
            const sig1 = {
                signer: user1.address,
                data: await user1._signTypedData({ verifyingContract: safe.address, chainId: await chainId() }, EIP712_SAFE_MESSAGE_TYPE, { message: "0xbaddad" })
            }
            const sig2 = await signHash(user2, calculateSafeMessageHash(safe, "0xbaddad", await chainId()))
            expect(await safe.callStatic.isValidSignature("0xbaddad", buildSignatureBytes([sig1, sig2]))).to.be.eq("0x20c13b0b")
        })
    })
})