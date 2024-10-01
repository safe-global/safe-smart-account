import { expect } from "chai";
import hre, { deployments, ethers } from "hardhat";
import { AddressZero } from "@ethersproject/constants";
import { getMock, getSafe } from "../utils/setup";
import {
    buildContractCall,
    buildSafeTransaction,
    buildSignatureBytes,
    calculateSafeTransactionHash,
    executeContractCallWithSigners,
    executeTx,
    safeApproveHash,
} from "../../src/utils/execution";
import { chainId } from "../utils/encoding";

describe("GuardManager", () => {
    const setupWithTemplate = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const [user1, user2] = await hre.ethers.getSigners();

        const mock = await getMock();
        const mockAddress = await mock.getAddress();

        const guardContract = await hre.ethers.getContractAt("Guard", AddressZero);
        const guardEip165Calldata = guardContract.interface.encodeFunctionData("supportsInterface", ["0xe6d7a83a"]);
        await mock.givenCalldataReturnBool(guardEip165Calldata, true);
        const safe = await getSafe({ owners: [user2.address] });
        await executeContractCallWithSigners(safe, safe, "setGuard", [mockAddress], [user2]);
        return {
            safe,
            mock,
            guardEip165Calldata,
            user1,
            user2,
        };
    });

    describe("setGuard", async () => {
        it("is not called when setting initially", async () => {
            const { safe, mock, guardEip165Calldata, user2 } = await setupWithTemplate();
            const safeAddress = await safe.getAddress();
            const mockAddress = await mock.getAddress();

            const slot = ethers.keccak256(ethers.toUtf8Bytes("guard_manager.guard.address"));

            await executeContractCallWithSigners(safe, safe, "setGuard", [AddressZero], [user2]);

            // Check guard
            await expect(await hre.ethers.provider.getStorage(safeAddress, slot)).to.be.eq("0x" + "".padStart(64, "0"));

            await mock.reset();

            await expect(await hre.ethers.provider.getStorage(safeAddress, slot)).to.be.eq("0x" + "".padStart(64, "0"));

            // Reverts if it doesn't implement ERC165 Guard Interface
            await expect(executeContractCallWithSigners(safe, safe, "setGuard", [mockAddress], [user2])).to.be.revertedWith("GS013");

            await mock.givenCalldataReturnBool(guardEip165Calldata, true);
            await expect(executeContractCallWithSigners(safe, safe, "setGuard", [mockAddress], [user2]))
                .to.emit(safe, "ChangedGuard")
                .withArgs(mockAddress);

            // Check guard
            await expect(await hre.ethers.provider.getStorage(safeAddress, slot)).to.be.eq(
                "0x" + mockAddress.toLowerCase().slice(2).padStart(64, "0"),
            );

            // Guard should not be called, as it was not set before the transaction execution
            expect(await mock.invocationCount()).to.be.eq(0);
        });

        it("is called when removed", async () => {
            const { safe, mock, user1, user2 } = await setupWithTemplate();
            const safeAddress = await safe.getAddress();
            const mockAddress = await mock.getAddress();

            const slot = ethers.keccak256(ethers.toUtf8Bytes("guard_manager.guard.address"));

            // Check guard
            await expect(await hre.ethers.provider.getStorage(safeAddress, slot)).to.be.eq(
                "0x" + mockAddress.toLowerCase().slice(2).padStart(64, "0"),
            );

            const safeTx = await buildContractCall(safe, "setGuard", [AddressZero], await safe.nonce());
            const signature = await safeApproveHash(user2, safe, safeTx);
            const signatureBytes = buildSignatureBytes([signature]);

            await expect(executeTx(safe, safeTx, [signature]))
                .to.emit(safe, "ChangedGuard")
                .withArgs(AddressZero);

            // Check guard
            await expect(await hre.ethers.provider.getStorage(safeAddress, slot)).to.be.eq("0x" + "".padStart(64, "0"));
            expect(await mock.invocationCount()).to.be.eq(2);
            const guardInterface = (await hre.ethers.getContractAt("Guard", mockAddress)).interface;
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

            expect(await mock.invocationCountForCalldata(checkTxData)).to.be.eq(1);
            // Guard should also be called for post exec check, even if it is removed with the Safe tx
            const checkExecData = guardInterface.encodeFunctionData("checkAfterExecution", [
                calculateSafeTransactionHash(safeAddress, safeTx, await chainId()),
                true,
            ]);
            expect(await mock.invocationCountForCalldata(checkExecData)).to.be.eq(1);
        });
    });

    describe("execTransaction", async () => {
        it("reverts if the pre hook of the guard reverts", async () => {
            const { safe, mock, user1, user2 } = await setupWithTemplate();

            const safeAddress = await safe.getAddress();
            const mockAddress = await mock.getAddress();

            const safeTx = buildSafeTransaction({ to: mockAddress, data: "0xbaddad42", nonce: 1 });
            const signature = await safeApproveHash(user2, safe, safeTx);
            const signatureBytes = buildSignatureBytes([signature]);
            const guardInterface = (await hre.ethers.getContractAt("Guard", mockAddress)).interface;
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
            await mock.givenCalldataRevertWithMessage(checkTxData, "Computer says Nah");
            const checkExecData = guardInterface.encodeFunctionData("checkAfterExecution", [
                calculateSafeTransactionHash(safeAddress, safeTx, await chainId()),
                true,
            ]);

            await expect(executeTx(safe, safeTx, [signature])).to.be.revertedWith("Computer says Nah");

            await mock.reset();

            await expect(executeTx(safe, safeTx, [signature])).to.emit(safe, "ExecutionSuccess");

            expect(await mock.invocationCount()).to.equal(3n);
            expect(await mock.invocationCountForCalldata(checkTxData)).to.equal(1n);
            expect(await mock.invocationCountForCalldata(checkExecData)).to.equal(1n);
            expect(await mock.invocationCountForCalldata("0xbaddad42")).to.equal(1n);
        });

        it("reverts if the post hook of the guard reverts", async () => {
            const { safe, mock, user1, user2 } = await setupWithTemplate();
            const safeAddress = await safe.getAddress();
            const mockAddress = await mock.getAddress();

            const safeTx = buildSafeTransaction({ to: mockAddress, data: "0xbaddad42", nonce: 1 });
            const signature = await safeApproveHash(user2, safe, safeTx);
            const signatureBytes = buildSignatureBytes([signature]);
            const guardInterface = (await hre.ethers.getContractAt("Guard", mockAddress)).interface;
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
            await mock.givenCalldataRevertWithMessage(checkExecData, "Computer says Nah");

            await expect(executeTx(safe, safeTx, [signature])).to.be.revertedWith("Computer says Nah");

            await mock.reset();

            await expect(executeTx(safe, safeTx, [signature])).to.emit(safe, "ExecutionSuccess");

            expect(await mock.invocationCount()).to.equal(3n);
            expect(await mock.invocationCountForCalldata(checkTxData)).to.equal(1n);
            expect(await mock.invocationCountForCalldata(checkExecData)).to.equal(1n);
            expect(await mock.invocationCountForCalldata("0xbaddad42")).to.equal(1n);
        });
    });
});
