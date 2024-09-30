import { expect } from "chai";
import hre from "hardhat";
import { AddressZero } from "@ethersproject/constants";

describe("Proxy", () => {
    describe("constructor", () => {
        it("should revert with invalid singleton address", async () => {
            const Proxy = await hre.ethers.getContractFactory("SafeProxy");
            await expect(Proxy.deploy(AddressZero)).to.be.revertedWith("Invalid singleton address provided");
        });
    });
});
