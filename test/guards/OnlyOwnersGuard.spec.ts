import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { getMock, getSafeWithOwners } from "../utils/setup";
import { buildSafeTransaction, executeContractCallWithSigners, executeTxWithSigners } from "../../src/utils/execution";

describe("OnlyOwnersGuard", async () => {
    const [user1, user2] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const safe = await getSafeWithOwners([user1.address]);
        const guardFactory = await hre.ethers.getContractFactory("OnlyOwnersGuard");
        const guard = await guardFactory.deploy();
        const mock = await getMock();
        await executeContractCallWithSigners(safe, safe, "setGuard", [guard.address], [user1]);

        return {
            safe,
            mock,
        };
    });

    describe("only owners should be able to exec transactions", async () => {
        it("should allow an owner to exec", async () => {
            const { safe, mock } = await setupTests();
            const nonce = await safe.nonce();
            const safeTx = buildSafeTransaction({ to: mock.address, data: "0xbaddad42", nonce });

            executeTxWithSigners(safe, safeTx, [user1]);
        });

        it("should not allow a random user exec", async () => {
            const { safe, mock } = await setupTests();
            const nonce = await safe.nonce();
            const safeTx = buildSafeTransaction({ to: mock.address, data: "0xbaddad42", nonce });

            await expect(executeTxWithSigners(safe, safeTx, [user2])).to.be.reverted;
        });
    });
});
