import { expect } from "chai";
import hre from "hardhat";
import { AddressZero } from "@ethersproject/constants";
import { defaultTokenCallbackHandlerDeployment, getContractFactoryByName, getSafeTemplate, getWallets } from "../utils/setup";

describe("Safe", () => {
    const setupWithTemplate = hre.deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const signers = await getWallets();

        const mockErc1155 = await (await getContractFactoryByName("ERC1155Token")).deploy();
        await mockErc1155.deployed();

        return {
            safe: await getSafeTemplate(),
            token: mockErc1155,
            signers,
        };
    });

    describe("ERC1155", () => {
        it("should reject if callback not accepted", async () => {
            const {
                safe,
                token,
                signers: [user1, user2],
            } = await setupWithTemplate();
            const safeAddress = await safe.getAddress();

            // Setup Safe
            await (await safe.setup([user1.address, user2.address], 1, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero)).wait();

            // Mint test tokens
            await (await token.mint(user1.address, 23, 1337, "0x")).wait();
            await expect(await token.balanceOf(user1.address, 23)).to.be.deep.eq(1337n);

            await expect(token.mint(safeAddress, 23, 1337, "0x"), "Should not accept minted token if handler not set").to.be.reverted;

            await expect(
                token.safeTransferFrom(user1.address, safeAddress, 23, 1337, "0x"),
                "Should not accept sent token if handler not set",
            ).to.be.reverted;
        });

        it("should not reject if callback is accepted", async () => {
            const {
                safe,
                token,
                signers: [user1, user2],
            } = await setupWithTemplate();
            const safeAddress = await safe.getAddress();
            const handler = await defaultTokenCallbackHandlerDeployment();

            // Setup Safe
            await (
                await safe.setup([user1.address, user2.address], 1, AddressZero, "0x", handler.address, AddressZero, 0, AddressZero)
            ).wait();

            await (await token.mint(safeAddress, 23, 1337, "0x")).wait();
            await expect(await token.balanceOf(safeAddress, 23)).to.be.deep.eq(1337n);

            await (await token.mint(user1.address, 23, 23, "0x")).wait();
            await expect(await token.balanceOf(user1.address, 23)).to.be.deep.eq(23n);

            await (await token.safeTransferFrom(user1.address, safeAddress, 23, 23, "0x")).wait();
            await expect(await token.balanceOf(user1.address, 23)).to.be.deep.eq(0n);
            await expect(await token.balanceOf(safeAddress, 23)).to.be.deep.eq(1360n);
        });
    });
});
