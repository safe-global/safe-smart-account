import { expect } from "chai";
import { deployments } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { getDefaultCallbackHandler } from "../utils/setup";

describe("DefaultCallbackHandler", async () => {
    beforeEach(async () => {
        await deployments.fixture();
    });

    describe("ERC1155", async () => {
        it('to handle onERC1155Received', async () => {
            const handler = await getDefaultCallbackHandler()
            await expect(
                await handler.callStatic.onERC1155Received(AddressZero, AddressZero, 0, 0, "0x")
            ).to.be.eq("0xf23a6e61")
        })

        it('to handle onERC1155BatchReceived', async () => {
            const handler = await getDefaultCallbackHandler()
            await expect(
                await handler.callStatic.onERC1155BatchReceived(AddressZero, AddressZero, [], [], "0x")
            ).to.be.eq("0xbc197c81")
        })
    })

    describe("ERC721", async () => {
        it('to handle onERC721Received', async () => {
            const handler = await getDefaultCallbackHandler()
            await expect(
                await handler.callStatic.onERC721Received(AddressZero, AddressZero, 0, "0x")
            ).to.be.eq("0x150b7a02")
        })
    })

    describe("ERC777", async () => {
        it('to handle tokensReceived', async () => {
            const handler = await getDefaultCallbackHandler()
            await handler.callStatic.tokensReceived(AddressZero, AddressZero, AddressZero, 0, "0x", "0x")
        })
    })
})