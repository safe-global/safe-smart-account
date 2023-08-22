import { expect } from "chai";
import hre, { deployments, ethers } from "hardhat";
import { getSafeWithOwners } from "../utils/setup";
import { AddressOne } from "../../src/utils/constants";

describe("Safe - Reserved Addresses", async () => {
    const [user1] = await ethers.getSigners();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        return {
            safe: await getSafeWithOwners([user1.address]),
        };
    });

    it("sentinels should not be owners or modules", async () => {
        const { safe } = await setupTests();
        const readOnlySafe = safe.connect(hre.ethers.provider);

        expect(await safe.isOwner(AddressOne)).to.be.false;

        const sig =
            "0x" +
            "0000000000000000000000000000000000000000000000000000000000000001" +
            "0000000000000000000000000000000000000000000000000000000000000000" +
            "01";
        await expect(
            readOnlySafe.execTransaction.staticCall(AddressOne, 0, "0x", 0, 0, 0, 0, ethers.ZeroAddress, ethers.ZeroAddress, sig, {
                from: "0x0000000000000000000000000000000000000001",
            }),
            "Should not be able to execute transaction from sentinel as owner",
        ).to.be.reverted;

        await expect(
            readOnlySafe.execTransactionFromModule.staticCall(AddressOne, 0, "0x", 0, {
                from: "0x0000000000000000000000000000000000000001",
            }),
            "Should not be able to execute transaction from sentinel as module",
        ).to.be.reverted;
    });
});
