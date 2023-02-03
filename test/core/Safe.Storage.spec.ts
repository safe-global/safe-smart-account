import { expect } from "chai";
import hre from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { getContractStorageLayout } from "../utils/storage";

describe("Safe", async () => {
    it("follows storage layout defined by SafeStorage library", async () => {
        const safeStorageLayout = await getContractStorageLayout(hre, "SafeStorage");
        const safeSingletonStorageLayout = await getContractStorageLayout(hre, "Safe");

        // Chai doesn't have built-in matcher for deep object equality
        // For the sake of simplicity I decided just to convert the object to a string and compare the strings
        expect(JSON.stringify(safeSingletonStorageLayout).startsWith(JSON.stringify(safeStorageLayout))).to.be.true;
    });
});
