import { expect } from "chai";
import { ethers, deployments } from "hardhat";
import { AddressZero } from "@ethersproject/constants";
import { getSafe, getTokenCallbackHandler } from "../utils/setup";

describe("TokenCallbackHandler", () => {
    const setupTests = deployments.createFixture(async () => {
        await deployments.fixture();

        const handler = await getTokenCallbackHandler();
        const [user] = await ethers.getSigners();
        const safe = await getSafe({ owners: [user.address], threshold: 1, fallbackHandler: await handler.getAddress() });

        const erc721 = await ethers.deployContract("ERC721Token");
        const erc1155 = await ethers.deployContract("ERC1155Token");

        return { handler, user, safe, erc721, erc1155 };
    });

    describe("ERC1155", () => {
        it("should support ERC1155 interface", async () => {
            const { handler } = await setupTests();
            await expect(await handler.supportsInterface.staticCall("0x4e2312e0")).to.be.eq(true);
        });

        it("to handle onERC1155Received", async () => {
            const { handler, safe } = await setupTests();
            const result = await handler
                .connect(ethers.provider)
                .onERC1155Received(AddressZero, AddressZero, 0, 0, "0x", { from: await safe.getAddress() });
            await expect(result).to.be.eq("0xf23a6e61");
        });

        it("to handle onERC1155BatchReceived", async () => {
            const { handler, safe } = await setupTests();
            const result = await handler
                .connect(ethers.provider)
                .onERC1155BatchReceived(AddressZero, AddressZero, [], [], "0x", { from: await safe.getAddress() });
            await expect(result).to.be.eq("0xbc197c81");
        });

        it("should allow a Safe to receive ERC-1155 tokens", async () => {
            const { safe, user, erc1155 } = await setupTests();
            await erc1155.mintBatch(await user.getAddress(), [1, 2, 3], [100, 100, 100], "0x");

            await expect(erc1155.connect(user).safeTransferFrom(await user.getAddress(), await safe.getAddress(), 1, 100, "0x")).to.not.be
                .reverted;
            await expect(
                erc1155.connect(user).safeBatchTransferFrom(await user.getAddress(), await safe.getAddress(), [2, 3], [100, 100], "0x"),
            ).to.not.be.reverted;
        });

        it("should revert when tokens are transferred directly to the handler", async () => {
            const { handler, user, erc1155 } = await setupTests();
            await erc1155.mintBatch(await user.getAddress(), [1, 2, 3], [100, 100, 100], "0x");

            await expect(
                erc1155.connect(user).safeTransferFrom(await user.getAddress(), await handler.getAddress(), 1, 100, "0x"),
            ).to.be.revertedWith("not a fallback call");
            await expect(
                erc1155.connect(user).safeBatchTransferFrom(await user.getAddress(), await handler.getAddress(), [2, 3], [100, 100], "0x"),
            ).to.be.revertedWith("not a fallback call");
        });

        it("can be tricked into sending tokens to the fallback handler", async () => {
            // demonstrate that the `onERC*Received` methods are best effort, and that they can be
            // tricked to send tokens to the fallback handler.
            const { handler, user, erc1155 } = await setupTests();

            await erc1155.mint(await user.getAddress(), 1, 100, "0x");
            await erc1155.trickFallbackHandler(await handler.getAddress());

            await expect(erc1155.connect(user).safeTransferFrom(await user.getAddress(), await handler.getAddress(), 1, 100, "0x")).to.not
                .be.reverted;
        });
    });

    describe("ERC721", () => {
        it("should support ERC721 interface", async () => {
            const { handler } = await setupTests();
            await expect(await handler.supportsInterface.staticCall("0x150b7a02")).to.be.eq(true);
        });

        it("to handle onERC721Received", async () => {
            const { handler, safe } = await setupTests();

            const result = await handler
                .connect(ethers.provider)
                .onERC721Received(AddressZero, AddressZero, 0, "0x", { from: await safe.getAddress() });
            await expect(result).to.be.eq("0x150b7a02");
        });

        it("should allow a Safe to receive ERC-721 tokens", async () => {
            const { safe, user, erc721 } = await setupTests();
            await erc721.mint(await user.getAddress(), 1);

            await expect(
                erc721.connect(user)["safeTransferFrom(address,address,uint256)"](await user.getAddress(), await safe.getAddress(), 1),
            ).to.not.be.reverted;
        });

        it("should revert when tokens are transferred directly to the handler", async () => {
            const { handler, user, erc721 } = await setupTests();
            await erc721.mint(await user.getAddress(), 1);

            await expect(
                erc721.connect(user)["safeTransferFrom(address,address,uint256)"](await user.getAddress(), await handler.getAddress(), 1),
            ).to.be.revertedWith("not a fallback call");
        });

        it("can be tricked into sending tokens to the fallback handler", async () => {
            // demonstrate that the `onERC*Received` methods are best effort, and that they can be
            // tricked to send tokens to the fallback handler.
            const { handler, user, erc721 } = await setupTests();

            await erc721.mint(await user.getAddress(), 1);
            await erc721.trickFallbackHandler(await handler.getAddress());

            await expect(
                erc721
                    .connect(user)
                    ["safeTransferFrom(address,address,uint256,bytes)"](await user.getAddress(), await handler.getAddress(), 1, "0x"),
            ).to.not.be.reverted;
        });
    });

    describe("ERC777", () => {
        it("to handle tokensReceived", async () => {
            const { handler } = await setupTests();
            await handler.tokensReceived.staticCall(AddressZero, AddressZero, AddressZero, 0, "0x", "0x");
        });
    });

    describe("ERC165", () => {
        it("should support ERC165 interface", async () => {
            const { handler } = await setupTests();
            await expect(await handler.supportsInterface.staticCall("0x01ffc9a7")).to.be.eq(true);
        });

        it("should not support random interface", async () => {
            const { handler } = await setupTests();
            await expect(await handler.supportsInterface.staticCall("0xbaddad42")).to.be.eq(false);
        });

        it("should not support invalid interface", async () => {
            const { handler } = await setupTests();
            await expect(await handler.supportsInterface.staticCall("0xffffffff")).to.be.eq(false);
        });
    });
});
