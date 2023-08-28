import { expect } from "chai";
import hre, { deployments, ethers } from "hardhat";
import { AddressZero } from "@ethersproject/constants";
import { getMock, getSafeWithOwners } from "../utils/setup";
import {
    buildContractCall,
    buildSafeTransaction,
    buildSignatureBytes,
    calculateSafeTransactionHash,
    executeContractCallWithSigners,
    executeTx,
    safeApproveHash,
} from "../../src/utils/execution";
import crypto from "crypto";
import { chainId } from "../utils/encoding";

describe("GuardManager", () => {
    const GUARD_STORAGE_SLOT = ethers.keccak256(ethers.toUtf8Bytes("guard_manager.guard.address"));

    const setupWithTemplate = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const validGuardMock = await getMock();
        const validGuardMockAddress = await validGuardMock.getAddress();
        const signers = await ethers.getSigners();
        const [, user2] = signers;

        const guardContract = await hre.ethers.getContractAt("Guard", AddressZero);
        const guardEip165Calldata = guardContract.interface.encodeFunctionData("supportsInterface", ["0x945b8148"]);
        await validGuardMock.givenCalldataReturnBool(guardEip165Calldata, true);
        const safe = await getSafeWithOwners([user2.address]);
        await executeContractCallWithSigners(safe, safe, "setGuard", [validGuardMockAddress], [user2]);

        return {
            safe,
            validGuardMock,
            guardEip165Calldata,
            signers,
        };
    });

    describe("setGuard", () => {
        it("reverts if the guard does not implement the ERC165 Guard Interface", async () => {
            const {
                signers: [user1, user2],
            } = await setupWithTemplate();
            const safe = await getSafeWithOwners([user1.address]);

            await expect(executeContractCallWithSigners(safe, safe, "setGuard", [user2.address], [user1])).to.be.revertedWith("GS013");
        });

        it("emits an event when the guard is changed", async () => {
            const {
                validGuardMock,
                signers: [user1],
            } = await setupWithTemplate();
            const validGuardMockAddress = await validGuardMock.getAddress();
            const safe = await getSafeWithOwners([user1.address]);

            await expect(executeContractCallWithSigners(safe, safe, "setGuard", [validGuardMockAddress], [user1]))
                .to.emit(safe, "ChangedGuard")
                .withArgs(validGuardMockAddress);

            await expect(executeContractCallWithSigners(safe, safe, "setGuard", [AddressZero], [user1]))
                .to.emit(safe, "ChangedGuard")
                .withArgs(AddressZero);
        });

        it("is not called when setting initially", async () => {
            const {
                validGuardMock,
                signers: [user1],
            } = await setupWithTemplate();
            const validGuardMockAddress = await validGuardMock.getAddress();
            const safe = await getSafeWithOwners([user1.address]);

            await executeContractCallWithSigners(safe, safe, "setGuard", [validGuardMockAddress], [user1]);

            // Check guard
            await expect(await hre.ethers.provider.getStorage(await safe.getAddress(), GUARD_STORAGE_SLOT)).to.be.eq(
                "0x" + validGuardMockAddress.toLowerCase().slice(2).padStart(64, "0"),
            );

            // Guard should not be called, as it was not set before the transaction execution
            expect(await validGuardMock.invocationCount()).to.be.eq(0);
        });

        it("is called when removed", async () => {
            const {
                safe,
                validGuardMock,
                signers: [user1, user2],
            } = await setupWithTemplate();
            const validGuardMockAddress = await validGuardMock.getAddress();
            const safeAddress = await safe.getAddress();

            // Check guard
            await expect(await hre.ethers.provider.getStorage(await safe.getAddress(), GUARD_STORAGE_SLOT)).to.be.eq(
                "0x" + validGuardMockAddress.toLowerCase().slice(2).padStart(64, "0"),
            );

            const safeTx = await buildContractCall(safe, "setGuard", [AddressZero], await safe.nonce());
            const signature = await safeApproveHash(user2, safe, safeTx);
            const signatureBytes = buildSignatureBytes([signature]);

            await expect(executeTx(safe, safeTx, [signature]))
                .to.emit(safe, "ChangedGuard")
                .withArgs(AddressZero);

            // Check guard
            await expect(await hre.ethers.provider.getStorage(await safe.getAddress(), GUARD_STORAGE_SLOT)).to.be.eq(
                "0x" + "".padStart(64, "0"),
            );

            expect(await validGuardMock.invocationCount()).to.be.eq(2);
            const guardInterface = (await hre.ethers.getContractAt("Guard", validGuardMockAddress)).interface;
            const checkTxData = guardInterface.encodeFunctionData("checkTransaction", [
                safeTx.to,
                safeTx.value,
                safeTx.data,
                safeTx.operation,
                safeTx.safeTxGas,
                safeTx.baseGas,
                safeTx.gasPrice,
                safeTx.gasToken,
                safeTx.refundReceiver,
                signatureBytes,
                user1.address,
            ]);
            expect(await validGuardMock.invocationCountForCalldata.staticCall(checkTxData)).to.be.eq(1);
            // Guard should also be called for post exec check, even if it is removed with the Safe tx
            const checkExecData = guardInterface.encodeFunctionData("checkAfterExecution", [
                calculateSafeTransactionHash(safeAddress, safeTx, await chainId()),
                true,
            ]);
            expect(await validGuardMock.invocationCountForCalldata.staticCall(checkExecData)).to.be.eq(1);
        });
    });

    describe("execTransaction", () => {
        it("reverts if the pre hook of the guard reverts", async () => {
            const {
                safe,
                validGuardMock,
                signers: [user1, user2],
            } = await setupWithTemplate();
            const validGuardMockAddress = await validGuardMock.getAddress();
            const safeAddress = await safe.getAddress();

            const safeTx = buildSafeTransaction({ to: validGuardMockAddress, data: "0xbaddad42", nonce: 1 });
            const signature = await safeApproveHash(user2, safe, safeTx);
            const signatureBytes = buildSignatureBytes([signature]);
            const guardInterface = (await hre.ethers.getContractAt("Guard", validGuardMockAddress)).interface;
            const checkTxData = guardInterface.encodeFunctionData("checkTransaction", [
                safeTx.to,
                safeTx.value,
                safeTx.data,
                safeTx.operation,
                safeTx.safeTxGas,
                safeTx.baseGas,
                safeTx.gasPrice,
                safeTx.gasToken,
                safeTx.refundReceiver,
                signatureBytes,
                user1.address,
            ]);
            await validGuardMock.givenCalldataRevertWithMessage(checkTxData, "Computer says Nah");
            const checkExecData = guardInterface.encodeFunctionData("checkAfterExecution", [
                calculateSafeTransactionHash(safeAddress, safeTx, await chainId()),
                true,
            ]);

            await expect(executeTx(safe, safeTx, [signature])).to.be.revertedWith("Computer says Nah");

            await validGuardMock.reset();

            await expect(executeTx(safe, safeTx, [signature])).to.emit(safe, "ExecutionSuccess");

            expect(await validGuardMock.invocationCount()).to.eq(3n);
            expect(await validGuardMock.invocationCountForCalldata(checkTxData)).to.eq(1n);
            expect(await validGuardMock.invocationCountForCalldata(checkExecData)).to.eq(1n);
            expect(await validGuardMock.invocationCountForCalldata("0xbaddad42")).to.eq(1n);
        });

        it("reverts if the post hook of the guard reverts", async () => {
            const {
                safe,
                validGuardMock,
                signers: [user1, user2],
            } = await setupWithTemplate();
            const validGuardMockAddress = await validGuardMock.getAddress();
            const safeAddress = await safe.getAddress();

            const safeTx = buildSafeTransaction({ to: validGuardMockAddress, data: "0xbaddad42", nonce: 1 });
            const signature = await safeApproveHash(user2, safe, safeTx);
            const signatureBytes = buildSignatureBytes([signature]);
            const guardInterface = (await hre.ethers.getContractAt("Guard", validGuardMockAddress)).interface;
            const checkTxData = guardInterface.encodeFunctionData("checkTransaction", [
                safeTx.to,
                safeTx.value,
                safeTx.data,
                safeTx.operation,
                safeTx.safeTxGas,
                safeTx.baseGas,
                safeTx.gasPrice,
                safeTx.gasToken,
                safeTx.refundReceiver,
                signatureBytes,
                user1.address,
            ]);
            const checkExecData = guardInterface.encodeFunctionData("checkAfterExecution", [
                calculateSafeTransactionHash(safeAddress, safeTx, await chainId()),
                true,
            ]);
            await validGuardMock.givenCalldataRevertWithMessage(checkExecData, "Computer says Nah");

            await expect(executeTx(safe, safeTx, [signature])).to.be.revertedWith("Computer says Nah");

            await validGuardMock.reset();

            await expect(executeTx(safe, safeTx, [signature])).to.emit(safe, "ExecutionSuccess");

            expect(await validGuardMock.invocationCount()).to.eq(3n);
            expect(await validGuardMock.invocationCountForCalldata(checkTxData)).to.eq(1n);
            expect(await validGuardMock.invocationCountForCalldata(checkExecData)).to.eq(1n);
            expect(await validGuardMock.invocationCountForCalldata("0xbaddad42")).to.eq(1n);
        });
    });

    describe("execTransactionFromModule", () => {
        it("reverts if the pre hook of the guard reverts", async () => {
            const {
                safe,
                validGuardMock,
                signers: [user1, user2],
            } = await setupWithTemplate();
            const validGuardMockAddress = await validGuardMock.getAddress();
            await executeContractCallWithSigners(safe, safe, "enableModule", [user1.address], [user2]);

            const guardInterface = (await hre.ethers.getContractAt("Guard", validGuardMockAddress)).interface;
            const checkModuleTxData = guardInterface.encodeFunctionData("checkModuleTransaction", [
                user1.address,
                0,
                "0xbeef73",
                1,
                user1.address,
            ]);

            await validGuardMock.givenCalldataRevertWithMessage(checkModuleTxData, "Computer says Nah");

            await expect(safe.execTransactionFromModule(user1.address, 0, "0xbeef73", 1)).to.be.reverted;
        });

        it("reverts if the post hook of the guard reverts", async () => {
            const {
                safe,
                validGuardMock,
                signers: [user1, user2],
            } = await setupWithTemplate();
            const validGuardMockAddress = await validGuardMock.getAddress();

            await executeContractCallWithSigners(safe, safe, "enableModule", [user1.address], [user2]);

            const guardInterface = (await hre.ethers.getContractAt("Guard", validGuardMockAddress)).interface;
            const checkAfterExecutionTxData = guardInterface.encodeFunctionData("checkAfterExecution", [`0x${"0".repeat(64)}`, true]);

            await validGuardMock.givenCalldataRevertWithMessage(checkAfterExecutionTxData, "Computer says Nah");

            await expect(safe.execTransactionFromModule(user1.address, 0, "0xbeef73", 1)).to.be.reverted;
        });

        it("preserves the hash returned by checkModuleTransaction and passes it to checkAfterExecution", async () => {
            const {
                safe,
                validGuardMock,
                signers: [user1, user2],
            } = await setupWithTemplate();
            const validGuardMockAddress = await validGuardMock.getAddress();
            const hash = "0x" + crypto.randomBytes(32).toString("hex");

            await executeContractCallWithSigners(safe, safe, "enableModule", [user1.address], [user2]);

            const guardInterface = (await hre.ethers.getContractAt("Guard", validGuardMockAddress)).interface;
            const checkModuleTxData = guardInterface.encodeFunctionData("checkModuleTransaction", [
                user1.address,
                0,
                "0xbeef73",
                1,
                user1.address,
            ]);

            const checkAfterExecutionTxData = guardInterface.encodeFunctionData("checkAfterExecution", [hash, true]);
            await validGuardMock.givenCalldataReturnBytes32(checkModuleTxData, hash);

            await safe.execTransactionFromModule(user1.address, 0, "0xbeef73", 1);

            expect(await validGuardMock.invocationCountForCalldata(checkAfterExecutionTxData)).to.equal(1);
        });
    });

    describe("execTransactionFromModuleReturnData", () => {
        it("reverts if the pre hook of the guard reverts", async () => {
            const {
                safe,
                validGuardMock,
                signers: [user1, user2],
            } = await setupWithTemplate();
            const validGuardMockAddress = await validGuardMock.getAddress();
            await executeContractCallWithSigners(safe, safe, "enableModule", [user1.address], [user2]);

            const guardInterface = (await hre.ethers.getContractAt("Guard", validGuardMockAddress)).interface;
            const checkModuleTxData = guardInterface.encodeFunctionData("checkModuleTransaction", [
                user1.address,
                0,
                "0xbeef73",
                1,
                user1.address,
            ]);

            await validGuardMock.givenCalldataRevertWithMessage(checkModuleTxData, "Computer says Nah");

            await expect(safe.execTransactionFromModuleReturnData(user1.address, 0, "0xbeef73", 1)).to.be.reverted;
        });

        it("reverts if the post hook of the guard reverts", async () => {
            const {
                safe,
                validGuardMock,
                signers: [user1, user2],
            } = await setupWithTemplate();
            const validGuardMockAddress = await validGuardMock.getAddress();
            await executeContractCallWithSigners(safe, safe, "enableModule", [user1.address], [user2]);

            const guardInterface = (await hre.ethers.getContractAt("Guard", validGuardMockAddress)).interface;
            const checkAfterExecutionTxData = guardInterface.encodeFunctionData("checkAfterExecution", [`0x${"0".repeat(64)}`, true]);

            await validGuardMock.givenCalldataRevertWithMessage(checkAfterExecutionTxData, "Computer says Nah");

            await expect(safe.execTransactionFromModuleReturnData(user1.address, 0, "0xbeef73", 1)).to.be.reverted;
        });

        it("preserves the hash returned by checkModuleTransaction and passes it to checkAfterExecution", async () => {
            const {
                safe,
                validGuardMock,
                signers: [user1, user2],
            } = await setupWithTemplate();
            const validGuardMockAddress = await validGuardMock.getAddress();
            const hash = "0x" + crypto.randomBytes(32).toString("hex");

            await executeContractCallWithSigners(safe, safe, "enableModule", [user1.address], [user2]);

            const guardInterface = (await hre.ethers.getContractAt("Guard", validGuardMockAddress)).interface;
            const checkModuleTxData = guardInterface.encodeFunctionData("checkModuleTransaction", [
                user1.address,
                0,
                "0xbeef73",
                1,
                user1.address,
            ]);

            const checkAfterExecutionTxData = guardInterface.encodeFunctionData("checkAfterExecution", [hash, true]);
            await validGuardMock.givenCalldataReturnBytes32(checkModuleTxData, hash);

            await safe.execTransactionFromModuleReturnData(user1.address, 0, "0xbeef73", 1);

            expect(await validGuardMock.invocationCountForCalldata(checkAfterExecutionTxData)).to.equal(1);
        });
    });
});
