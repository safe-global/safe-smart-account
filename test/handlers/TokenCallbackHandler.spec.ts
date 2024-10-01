import { expect } from "chai";
import { deployments } from "hardhat";
import { AddressZero } from "@ethersproject/constants";
import { getTokenCallbackHandler } from "../utils/setup";

describe("TokenCallbackHandler", () => {
    beforeEach(async () => {
        await deployments.fixture();
    });

    describe("ERC1155", () => {
        it("should support ERC1155 interface", async () => {
            const handler = await getTokenCallbackHandler();
            await expect(await handler.supportsInterface.staticCall("0x4e2312e0")).to.be.eq(true);
        });

        it("to handle onERC1155Received", async () => {
            const handler = await getTokenCallbackHandler();
            await expect(await handler.onERC1155Received.staticCall(AddressZero, AddressZero, 0, 0, "0x")).to.be.eq("0xf23a6e61");
        });

        it("to handle onERC1155BatchReceived", async () => {
            const handler = await getTokenCallbackHandler();
            await expect(await handler.onERC1155BatchReceived.staticCall(AddressZero, AddressZero, [], [], "0x")).to.be.eq("0xbc197c81");
        });
    });

    describe("ERC721", () => {
        it("should support ERC721 interface", async () => {
            const handler = await getTokenCallbackHandler();
            await expect(await handler.supportsInterface.staticCall("0x150b7a02")).to.be.eq(true);
        });

        it("to handle onERC721Received", async () => {
            const handler = await getTokenCallbackHandler();
            await expect(await handler.onERC721Received.staticCall(AddressZero, AddressZero, 0, "0x")).to.be.eq("0x150b7a02");
        });
    });

    describe("ERC777", () => {
        it("to handle tokensReceived", async () => {
            const handler = await getTokenCallbackHandler();
            await handler.tokensReceived.staticCall(AddressZero, AddressZero, AddressZero, 0, "0x", "0x");
        });
    });

    describe("ERC165", () => {
        it("should support ERC165 interface", async () => {
            const handler = await getTokenCallbackHandler();
            await expect(await handler.supportsInterface.staticCall("0x01ffc9a7")).to.be.eq(true);
        });

        it("should not support random interface", async () => {
            const handler = await getTokenCallbackHandler();
            await expect(await handler.supportsInterface.staticCall("0xbaddad42")).to.be.eq(false);
        });

        it("should not support invalid interface", async () => {
            const handler = await getTokenCallbackHandler();
            await expect(await handler.supportsInterface.staticCall("0xffffffff")).to.be.eq(false);
        });
    });
});
