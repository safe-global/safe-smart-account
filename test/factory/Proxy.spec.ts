import { expect } from "chai";
import { AddressZero } from "@ethersproject/constants";
import { getContractFactoryByName } from "../utils/setup";

describe("Proxy", () => {
    describe("constructor", () => {
        it("should revert with invalid singleton address", async () => {
            const Proxy = await getContractFactoryByName("SafeProxy");
            await expect(Proxy.deploy(AddressZero)).to.be.revertedWith("Invalid singleton address provided");
        });
    });
});
