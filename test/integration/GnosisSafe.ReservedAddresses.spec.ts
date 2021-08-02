import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { getSafeWithOwners } from "../utils/setup";
import { AddressOne } from "../../src/utils/constants";

describe("GnosisSafe", async () => {

    const [user1] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        return {
            safe: await getSafeWithOwners([user1.address])
        }
    })

    describe("Reserved Addresses", async () => {

        it('sentinels should not be owners or modules', async () => {
            const { safe } = await setupTests()
            const readOnlySafe = safe.connect(hre.ethers.provider)

            expect(await safe.isOwner(AddressOne)).to.be.false

            let sig = "0x" + "0000000000000000000000000000000000000000000000000000000000000001" + "0000000000000000000000000000000000000000000000000000000000000000" + "01"
            await expect(
                readOnlySafe.callStatic.execTransaction("0x1", 0, "0x", 0, 0, 0, 0, 0, 0, sig, { from: "0x0000000000000000000000000000000000000001"} ),
                "Should not be able to execute transaction from sentinel as owner"
            ).to.be.reverted

            await expect(
                readOnlySafe.callStatic.execTransactionFromModule("0x1", 0, "0x", 0, { from: "0x0000000000000000000000000000000000000001"} ),
                "Should not be able to execute transaction from sentinel as module"
            ).to.be.reverted
        })
    })
})