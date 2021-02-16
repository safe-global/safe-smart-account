import { expect } from "chai";
import hre, { deployments, ethers, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { BigNumber } from "ethers";
import { _TypedDataEncoder } from "@ethersproject/hash";

describe("DaoModule", async () => {
    
    const [user1] = waffle.provider.getWallets();

    describe("constructor", async () => {
        it("throws if timeout is 0", async () => {
            const Module = await hre.ethers.getContractFactory("DaoModule");
            await expect(
                Module.deploy(user1.address, user1.address, 0, 0, 0, 0)
            ).to.be.revertedWith("Timeout has to be greater 0");
        })
    })
})