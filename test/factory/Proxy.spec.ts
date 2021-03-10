import { expect } from "chai";
import hre from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";

describe("Proxy", async () => {

    describe("contrcutor", async () => {

        it('should revert with invalid singleton address', async () => {
            const Proxy = await hre.ethers.getContractFactory("GnosisSafeProxy");
            await expect(
                Proxy.deploy(AddressZero)
            ).to.be.revertedWith("Invalid singleton address provided")
        })

    })
})