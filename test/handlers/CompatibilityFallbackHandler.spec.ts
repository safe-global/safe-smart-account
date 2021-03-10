import { expect } from "chai";
import { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { compatFallbackHandlerContract, getCompatFallbackHandler, getSafeWithOwners } from "../utils/setup";
import { buildSignatureBytes, executeContractCallWithSigners, calculateSafeMessageHash, EIP712_SAFE_MESSAGE_TYPE, signHash } from "../utils/execution";
import { chainId } from "../utils/encoding";

describe("CompatibilityFallbackHandler", async () => {

    const [user1, user2] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const handler = await getCompatFallbackHandler()
        const safe = await getSafeWithOwners([user1.address, user2.address], 2, handler.address)
        const validator = (await compatFallbackHandlerContract()).attach(safe.address)
        return {
            safe,
            validator,
            handler
        }
    })

    describe("ERC1155", async () => {
        it('to handle onERC1155Received', async () => {
            const { handler } = await setupTests()
            await expect(
                await handler.callStatic.onERC1155Received(AddressZero, AddressZero, 0, 0, "0x")
            ).to.be.eq("0xf23a6e61")
        })

        it('to handle onERC1155BatchReceived', async () => {
            const { handler } = await setupTests()
            await expect(
                await handler.callStatic.onERC1155BatchReceived(AddressZero, AddressZero, [], [], "0x")
            ).to.be.eq("0xbc197c81")
        })
    })

    describe("ERC721", async () => {
        it('to handle onERC721Received', async () => {
            const { handler } = await setupTests()
            await expect(
                await handler.callStatic.onERC721Received(AddressZero, AddressZero, 0, "0x")
            ).to.be.eq("0x150b7a02")
        })
    })

    describe("ERC777", async () => {
        it('to handle tokensReceived', async () => {
            const { handler } = await setupTests()
            await handler.callStatic.tokensReceived(AddressZero, AddressZero, AddressZero, 0, "0x", "0x")
        })
    })
    
    describe("isValidsignature", async () => {

        it('should revert if called directly', async () => {
            const { handler } = await setupTests()
            await expect(handler.callStatic.isValidSignature("0xbaddad", "0x")).to.be.revertedWith("function call to a non-contract account")
        })

        it('should revert if message was not signed', async () => {
            const { validator } = await setupTests()
            await expect(validator.callStatic.isValidSignature("0xbaddad", "0x")).to.be.revertedWith("Hash not approved")
        })

        it('should revert if signature is not valid', async () => {
            const { validator } = await setupTests()
            await expect(validator.callStatic.isValidSignature("0xbaddad", "0xdeaddeaddeaddead")).to.be.reverted
        })

        it('should return magic value if message was signed', async () => {
            const { safe, validator } = await setupTests()
            await executeContractCallWithSigners(safe, safe, "signMessage", ["0xbaddad"], [user1, user2])
            expect(await validator.callStatic.isValidSignature("0xbaddad", "0x")).to.be.eq("0x20c13b0b")
        })

        it('should return magic value if enough owners signed', async () => {
            const { validator } = await setupTests()
            const sig1 = {
                signer: user1.address,
                data: await user1._signTypedData({ verifyingContract: validator.address, chainId: await chainId() }, EIP712_SAFE_MESSAGE_TYPE, { message: "0xbaddad" })
            }
            const sig2 = await signHash(user2, calculateSafeMessageHash(validator, "0xbaddad", await chainId()))
            expect(await validator.callStatic.isValidSignature("0xbaddad", buildSignatureBytes([sig1, sig2]))).to.be.eq("0x20c13b0b")
        })
    })
})