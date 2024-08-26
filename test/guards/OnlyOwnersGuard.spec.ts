import { expect } from "chai";
import hre from "hardhat";
import { getMock, getSafe } from "../utils/setup";
import {
    buildSafeTransaction,
    executeContractCallWithSigners,
    executeTx,
    executeTxWithSigners,
    safeSignTypedData,
} from "../../src/utils/execution";

describe("OnlyOwnersGuard", () => {
    const setupTests = hre.deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const signers = await hre.ethers.getSigners();
        const [user1] = signers;
        const safe = await getSafe({ owners: [user1.address] });
        const guardFactory = await hre.ethers.getContractFactory("OnlyOwnersGuard");
        const guard = await guardFactory.deploy();
        const guardAddress = await guard.getAddress();
        const mock = await getMock();
        await executeContractCallWithSigners(safe, safe, "setGuard", [guardAddress], [user1]);

        return {
            safe,
            mock,
            signers,
        };
    });

    describe("only owners should be able to exec transactions", () => {
        it("should allow an owner to exec", async () => {
            const {
                safe,
                mock,
                signers: [user1],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const nonce = await safe.nonce();
            const safeTx = buildSafeTransaction({ to: mockAddress, data: "0xbaddad42", nonce });

            await executeTxWithSigners(safe.connect(user1), safeTx, [user1]);
        });

        it("should not allow a random user exec", async () => {
            const {
                safe,
                mock,
                signers: [user1, user2],
            } = await setupTests();
            const nonce = await safe.nonce();
            const mockAddress = await mock.getAddress();
            const safeTx = buildSafeTransaction({ to: mockAddress, data: "0xbaddad42", nonce });
            const signature = await safeSignTypedData(user1, await safe.getAddress(), safeTx);
            const safeUser2 = await safe.connect(user2);

            await expect(executeTx(safeUser2, safeTx, [signature])).to.be.revertedWith("msg sender is not allowed to exec");
        });
    });
});
