import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { getSafeTemplate } from "../utils/setup";

describe("HandlerContext", async () => {

    const [user1, user2] = waffle.provider.getWallets();

    const setup = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const TestHandler = await hre.ethers.getContractFactory("TestHandler");
        const handler = await TestHandler.deploy();
        return {
            safe: await getSafeTemplate(),
            handler
        }
    })

    it('parses information correctly', async () => {
        const { handler } = await setup();
        const response = await user1.call({
            to: handler.address,
            data: handler.interface.encodeFunctionData("dudududu") + user2.address.slice(2)
        })
        expect(
            handler.interface.decodeFunctionResult("dudududu", response)
        ).to.be.deep.eq([user2.address, user1.address])
    })

    it('works with the Safe', async () => {
        const { safe, handler } = await setup();
        await safe.setup([user1.address, user2.address], 1, AddressZero, "0x", handler.address, AddressZero, 0, AddressZero)
        
        const response = await user1.call({
            to: safe.address,
            data: handler.interface.encodeFunctionData("dudududu")
        })

        expect(
            handler.interface.decodeFunctionResult("dudududu", response)
        ).to.be.deep.eq([user1.address, safe.address])
    })
})