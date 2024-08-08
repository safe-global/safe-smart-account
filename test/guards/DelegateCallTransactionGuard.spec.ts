import { expect } from "chai";
import hre, { deployments, ethers } from "hardhat";
import { AddressZero } from "@ethersproject/constants";
import { getSafe } from "../utils/setup";
import { buildContractCall, executeContractCallWithSigners } from "../../src/utils/execution";
import { AddressOne } from "../../src/utils/constants";

describe("DelegateCallTransactionGuard", () => {
    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const signers = await ethers.getSigners();
        const [user1] = signers;
        const safe = await getSafe({ owners: [user1.address] });
        const guardFactory = await hre.ethers.getContractFactory("DelegateCallTransactionGuard");
        const guard = await guardFactory.deploy(AddressZero);
        const guardAddress = await guard.getAddress();
        await executeContractCallWithSigners(safe, safe, "setGuard", [guardAddress], [user1]);
        return {
            safe,
            guardFactory,
            guard,
            signers,
        };
    });

    describe("fallback", () => {
        it("must NOT revert on fallback without value", async () => {
            const {
                guard,
                signers: [user1],
            } = await setupTests();
            const guardAddress = await guard.getAddress();
            await user1.sendTransaction({
                to: guardAddress,
                data: "0xbaddad",
            });
        });
        it("should revert on fallback with value", async () => {
            const {
                guard,
                signers: [user1],
            } = await setupTests();
            const guardAddress = await guard.getAddress();
            await expect(
                user1.sendTransaction({
                    to: guardAddress,
                    data: "0xbaddad",
                    value: 1,
                }),
            ).to.be.reverted;
        });
    });

    describe("checkTransaction", () => {
        it("should revert delegate call", async () => {
            const {
                safe,
                guard,
                signers: [user1],
            } = await setupTests();
            const tx = await buildContractCall(safe, "setGuard", [AddressZero], 0, true);
            await expect(
                guard.checkTransaction(
                    tx.to,
                    tx.value,
                    tx.data,
                    tx.operation,
                    tx.safeTxGas,
                    tx.baseGas,
                    tx.gasPrice,
                    tx.gasToken,
                    tx.refundReceiver,
                    "0x",
                    user1.address,
                ),
            ).to.be.revertedWith("This call is restricted");
        });

        it("must NOT revert normal call", async () => {
            const {
                safe,
                guard,
                signers: [user1],
            } = await setupTests();
            const tx = await buildContractCall(safe, "setGuard", [AddressZero], 0);
            await guard.checkTransaction(
                tx.to,
                tx.value,
                tx.data,
                tx.operation,
                tx.safeTxGas,
                tx.baseGas,
                tx.gasPrice,
                tx.gasToken,
                tx.refundReceiver,
                "0x",
                user1.address,
            );
        });

        it("should revert on delegate call via Safe", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            await expect(executeContractCallWithSigners(safe, safe, "setGuard", [AddressZero], [user1], true)).to.be.revertedWith(
                "This call is restricted",
            );

            await executeContractCallWithSigners(safe, safe, "setGuard", [AddressZero], [user1]);
        });

        it("can set allowed target via Safe", async () => {
            const {
                safe,
                guardFactory,
                signers: [user1],
            } = await setupTests();
            const guard = await guardFactory.deploy(AddressOne);
            const guardAddress = await guard.getAddress();
            await executeContractCallWithSigners(safe, safe, "setGuard", [guardAddress], [user1]);

            expect(await guard.ALLOWED_TARGET()).to.be.eq(AddressOne);
            const allowedTarget = safe.attach(AddressOne);
            await expect(executeContractCallWithSigners(safe, safe, "setFallbackHandler", [AddressZero], [user1], true)).to.be.revertedWith(
                "This call is restricted",
            );

            await executeContractCallWithSigners(safe, allowedTarget, "setFallbackHandler", [AddressZero], [user1], true);
        });
    });
});
