import { expect } from "chai";
import hre, { deployments, ethers } from "hardhat";
import { AddressZero } from "@ethersproject/constants";
import { getSafe, getMock } from "../utils/setup";
import { executeContractCallWithSigners } from "../../src/utils/execution";
import { AddressOne } from "../../src/utils/constants";

describe("ModuleManager", () => {
    const MODULE_GUARD_STORAGE_SLOT = ethers.keccak256(ethers.toUtf8Bytes("module_manager.module_guard.address"));

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const signers = await ethers.getSigners();
        const [user1] = signers;

        const safe = await getSafe({ owners: [user1.address] });

        const validModuleGuardMock = await getMock();
        const moduleGuardContract = await hre.ethers.getContractAt("IModuleGuard", AddressZero);
        const moduleGuardEip165Calldata = moduleGuardContract.interface.encodeFunctionData("supportsInterface", ["0x58401ed8"]);
        await validModuleGuardMock.givenCalldataReturnBool(moduleGuardEip165Calldata, true);

        return {
            safe,
            validModuleGuardMock,
            mock: await getMock(),
            signers,
        };
    });

    describe("enableModule", () => {
        it("can only be called from Safe itself", async () => {
            const {
                safe,
                signers: [, user2],
            } = await setupTests();
            await expect(safe.enableModule(user2.address)).to.be.revertedWith("GS031");
        });

        it("can not set sentinel", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();

            await expect(executeContractCallWithSigners(safe, safe, "enableModule", [AddressOne], [user1])).to.revertedWith("GS101");
        });

        it("can not set 0 Address", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            await expect(executeContractCallWithSigners(safe, safe, "enableModule", [AddressZero], [user1])).to.revertedWith("GS101");
        });

        it("can not add module twice", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            // Use module for execution to see error
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            await expect(executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1])).to.revertedWith("GS102");
        });

        it("emits event for a new module", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await expect(executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]))
                .to.emit(safe, "EnabledModule")
                .withArgs(user2.address);

            await expect(await safe.isModuleEnabled(user2.address)).to.be.true;

            await expect(await safe.getModulesPaginated(AddressOne, 10)).to.be.deep.equal([[user2.address], AddressOne]);
        });

        it("can enable multiple", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await expect(executeContractCallWithSigners(safe, safe, "enableModule", [user1.address], [user1]))
                .to.emit(safe, "EnabledModule")
                .withArgs(user1.address);

            await expect(await safe.isModuleEnabled(user1.address)).to.be.true;
            await expect(await safe.getModulesPaginated(AddressOne, 10)).to.be.deep.equal([[user1.address], AddressOne]);

            await expect(executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]))
                .to.emit(safe, "EnabledModule")
                .withArgs(user2.address);

            await expect(await safe.isModuleEnabled(user2.address)).to.be.true;
            await expect(await safe.getModulesPaginated(AddressOne, 10)).to.be.deep.equal([[user2.address, user1.address], AddressOne]);
        });
    });

    describe("disableModule", () => {
        it("can only be called from Safe itself", async () => {
            const {
                safe,
                signers: [, user2],
            } = await setupTests();
            await expect(safe.disableModule(AddressOne, user2.address)).to.be.revertedWith("GS031");
        });

        it("can not set sentinel", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();

            await expect(executeContractCallWithSigners(safe, safe, "disableModule", [AddressOne, AddressOne], [user1])).to.revertedWith(
                "GS101",
            );
        });

        it("can not set 0 Address", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            await expect(executeContractCallWithSigners(safe, safe, "disableModule", [AddressOne, AddressZero], [user1])).to.revertedWith(
                "GS101",
            );
        });

        it("Invalid prevModule, module pair provided - Invalid target", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);
            await expect(executeContractCallWithSigners(safe, safe, "disableModule", [AddressOne, user1.address], [user1])).to.revertedWith(
                "GS103",
            );
        });

        it("Invalid prevModule, module pair provided - Invalid sentinel", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);
            await expect(
                executeContractCallWithSigners(safe, safe, "disableModule", [AddressZero, user2.address], [user1]),
            ).to.revertedWith("GS103");
        });

        it("Invalid prevModule, module pair provided - Invalid source", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await executeContractCallWithSigners(safe, safe, "enableModule", [user1.address], [user1]);
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);
            await expect(
                executeContractCallWithSigners(safe, safe, "disableModule", [user1.address, user2.address], [user1]),
            ).to.revertedWith("GS103");
        });

        it("emits event for disabled module", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await executeContractCallWithSigners(safe, safe, "enableModule", [user1.address], [user1]);
            await expect(await safe.isModuleEnabled(user1.address)).to.be.true;
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);
            await expect(await safe.isModuleEnabled(user2.address)).to.be.true;
            await expect(await safe.getModulesPaginated(AddressOne, 10)).to.be.deep.equal([[user2.address, user1.address], AddressOne]);

            await expect(executeContractCallWithSigners(safe, safe, "disableModule", [user2.address, user1.address], [user1]))
                .to.emit(safe, "DisabledModule")
                .withArgs(user1.address);
            await expect(await safe.isModuleEnabled(user1.address)).to.be.false;
            await expect(await safe.getModulesPaginated(AddressOne, 10)).to.be.deep.equal([[user2.address], AddressOne]);

            await expect(executeContractCallWithSigners(safe, safe, "disableModule", [AddressOne, user2.address], [user1]))
                .to.emit(safe, "DisabledModule")
                .withArgs(user2.address);
            await expect(await safe.isModuleEnabled(user2.address)).to.be.false;
            await expect(await safe.getModulesPaginated(AddressOne, 10)).to.be.deep.equal([[], AddressOne]);
        });
    });

    describe("execTransactionFromModule", () => {
        it("can not be called from sentinel", async () => {
            const { safe, mock } = await setupTests();
            const mockAddress = await mock.getAddress();
            const readOnlySafe = safe.connect(hre.ethers.provider);
            await expect(
                readOnlySafe.execTransactionFromModule.staticCall(mockAddress, 0, "0xbaddad", 0, { from: AddressOne }),
            ).to.be.revertedWith("GS104");
        });

        it("can only be called from enabled module", async () => {
            const {
                safe,
                mock,
                signers: [, user2],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const user2Safe = safe.connect(user2);
            await expect(user2Safe.execTransactionFromModule(mockAddress, 0, "0xbaddad", 0)).to.be.revertedWith("GS104");
        });

        it("emits event on execution success", async () => {
            const {
                safe,
                mock,
                signers: [user1, user2],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const user2Safe = safe.connect(user2);
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            await expect(user2Safe.execTransactionFromModule(mockAddress, 0, "0xbaddad", 0))
                .to.emit(safe, "ExecutionFromModuleSuccess")
                .withArgs(user2.address);
            expect(await mock.invocationCountForCalldata.staticCall("0xbaddad")).to.equal(1n);
        });

        it("emits event on execution failure", async () => {
            const {
                safe,
                mock,
                signers: [user1, user2],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const user2Safe = safe.connect(user2);
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            await mock.givenAnyRevert();
            await expect(user2Safe.execTransactionFromModule(mockAddress, 0, "0xbaddad", 0))
                .to.emit(safe, "ExecutionFromModuleFailure")
                .withArgs(user2.address);
        });

        it("reverts if the pre hook of the module guard reverts", async () => {
            const {
                safe,
                validModuleGuardMock,
                signers: [user1, user2],
            } = await setupTests();
            const validModuleGuardMockAddress = await validModuleGuardMock.getAddress();
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            const moduleGuardInterface = (await hre.ethers.getContractAt("IModuleGuard", validModuleGuardMockAddress)).interface;
            const checkModuleTxData = moduleGuardInterface.encodeFunctionData("checkModuleTransaction", [
                user1.address,
                0,
                "0xbeef73",
                1,
                user2.address,
            ]);

            await validModuleGuardMock.givenCalldataRevertWithMessage(checkModuleTxData, "Computer says Nah");

            await expect(safe.execTransactionFromModule(user2.address, 0, "0xbeef73", 1)).to.be.reverted;
        });

        it("reverts if the post hook of the module guard reverts", async () => {
            const {
                safe,
                validModuleGuardMock,
                signers: [user1, user2],
            } = await setupTests();
            const validModuleGuardMockAddress = await validModuleGuardMock.getAddress();

            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            const guardInterface = (await hre.ethers.getContractAt("IModuleGuard", validModuleGuardMockAddress)).interface;
            const checkAfterModuleExecutionTxData = guardInterface.encodeFunctionData("checkAfterModuleExecution", [
                `0x${"0".repeat(64)}`,
                true,
            ]);

            await validModuleGuardMock.givenCalldataRevertWithMessage(checkAfterModuleExecutionTxData, "Computer says Nah");

            await expect(safe.execTransactionFromModule(user2.address, 0, "0xbeef73", 1)).to.be.reverted;
        });

        it("preserves the hash returned by checkModuleTransaction and passes it to checkAfterModuleExecution", async () => {
            const {
                safe,
                validModuleGuardMock,
                signers: [user1, user2],
            } = await setupTests();
            const validModuleGuardMockAddress = await validModuleGuardMock.getAddress();
            await executeContractCallWithSigners(safe, safe, "setModuleGuard", [validModuleGuardMockAddress], [user1]);

            const hash = ethers.hexlify(ethers.randomBytes(32));

            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            const moduleGuardInterface = (await hre.ethers.getContractAt("IModuleGuard", validModuleGuardMockAddress)).interface;
            const checkModuleTxData = moduleGuardInterface.encodeFunctionData("checkModuleTransaction", [
                user2.address,
                0,
                "0xbeef73",
                1,
                user2.address,
            ]);

            const checkAfterModuleExecutionTxData = moduleGuardInterface.encodeFunctionData("checkAfterModuleExecution", [hash, true]);
            await validModuleGuardMock.givenCalldataReturnBytes32(checkModuleTxData, hash);

            await safe.connect(user2).execTransactionFromModule(user2.address, 0, "0xbeef73", 1);

            expect(await validModuleGuardMock.invocationCountForCalldata(checkAfterModuleExecutionTxData)).to.equal(1);
        });
    });

    describe("execTransactionFromModuleReturnData", () => {
        it("can not be called from sentinel", async () => {
            const { safe, mock } = await setupTests();
            const mockAddress = await mock.getAddress();
            const readOnlySafe = safe.connect(hre.ethers.provider);
            await expect(
                readOnlySafe.execTransactionFromModuleReturnData.staticCall(mockAddress, 0, "0xbaddad", 0, { from: AddressOne }),
            ).to.be.revertedWith("GS104");
        });

        it("can only be called from enabled module", async () => {
            const {
                safe,
                mock,
                signers: [, user2],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const user2Safe = safe.connect(user2);
            await expect(user2Safe.execTransactionFromModuleReturnData(mockAddress, 0, "0xbaddad", 0)).to.be.revertedWith("GS104");
        });

        it("emits event on execution failure", async () => {
            const {
                safe,
                mock,
                signers: [user1, user2],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const user2Safe = safe.connect(user2);
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            await mock.givenAnyRevert();
            await expect(user2Safe.execTransactionFromModuleReturnData(mockAddress, 0, "0xbaddad", 0))
                .to.emit(safe, "ExecutionFromModuleFailure")
                .withArgs(user2.address);
        });

        it("emits event on execution success", async () => {
            const {
                safe,
                mock,
                signers: [user1, user2],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const user2Safe = safe.connect(user2);
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            await expect(user2Safe.execTransactionFromModuleReturnData(mockAddress, 0, "0xbaddad", 0))
                .to.emit(safe, "ExecutionFromModuleSuccess")
                .withArgs(user2.address);
            expect(await mock.invocationCountForCalldata.staticCall("0xbaddad")).to.equal(1n);
        });

        it("Returns expected from contract on success", async () => {
            const {
                safe,
                mock,
                signers: [user1, user2],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const user2Safe = safe.connect(user2);
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            await mock.givenCalldataReturn("0xbaddad", "0xdeaddeed");
            await expect(await user2Safe.execTransactionFromModuleReturnData.staticCall(mockAddress, 0, "0xbaddad", 0)).to.be.deep.eq([
                true,
                "0xdeaddeed",
            ]);
        });

        it("Returns expected from contract on failure", async () => {
            const {
                safe,
                mock,
                signers: [user1, user2],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const user2Safe = safe.connect(user2);
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            await mock.givenCalldataRevertWithMessage("0xbaddad", "Some random message");
            await expect(await user2Safe.execTransactionFromModuleReturnData.staticCall(mockAddress, 0, "0xbaddad", 0)).to.be.deep.eq([
                false,
                "0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000013536f6d652072616e646f6d206d65737361676500000000000000000000000000",
            ]);
        });

        it("correctly returns the return data if the module guard allows the transaction", async () => {
            const {
                safe,
                validModuleGuardMock,
                signers: [user1, user2],
            } = await setupTests();
            // Enabling the Module.
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            // Creating a MockContract and creating dummy calldata and return values.
            const mock = await getMock();
            const mockAddress = await mock.getAddress();
            const callData = "0xbeef73";
            const returnBytes = "0xdeaddeed";
            await mock.givenCalldataReturn(callData, returnBytes);

            // Getting the Module Guard Address and Interface.
            const validModuleGuardMockAddress = await validModuleGuardMock.getAddress();
            const moduleGuardInterface = (await hre.ethers.getContractAt("IModuleGuard", validModuleGuardMockAddress)).interface;

            // Creating the calldata for the Guard before & after Module TX Execution.
            const checkModuleTxDataByGuard = moduleGuardInterface.encodeFunctionData("checkModuleTransaction", [
                user2.address,
                0,
                callData,
                0,
                user2.address,
            ]);
            await validModuleGuardMock.givenCalldataReturnBytes32(checkModuleTxDataByGuard, ethers.ZeroHash);
            const checkAfterModuleExecutionTxDataByGuard = moduleGuardInterface.encodeFunctionData("checkAfterModuleExecution", [
                ethers.ZeroHash,
                true,
            ]);
            await validModuleGuardMock.givenCalldataReturn(checkAfterModuleExecutionTxDataByGuard, "0x1337");

            await expect(
                await safe.connect(user2).execTransactionFromModuleReturnData.staticCall(mockAddress, 0, callData, 0),
            ).to.be.deep.eq([true, returnBytes]);
        });

        it("reverts if the pre hook of the module guard reverts", async () => {
            const {
                safe,
                validModuleGuardMock,
                signers: [user1, user2],
            } = await setupTests();
            const validModuleGuardMockAddress = await validModuleGuardMock.getAddress();
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            const moduleGuardInterface = (await hre.ethers.getContractAt("IModuleGuard", validModuleGuardMockAddress)).interface;
            const checkModuleTxData = moduleGuardInterface.encodeFunctionData("checkModuleTransaction", [
                user2.address,
                0,
                "0xbeef73",
                1,
                user2.address,
            ]);

            await validModuleGuardMock.givenCalldataRevertWithMessage(checkModuleTxData, "Computer says Nah");

            await expect(safe.execTransactionFromModuleReturnData(user2.address, 0, "0xbeef73", 1)).to.be.reverted;
        });

        it("reverts if the post hook of the module guard reverts", async () => {
            const {
                safe,
                validModuleGuardMock,
                signers: [user1, user2],
            } = await setupTests();
            const validModuleGuardMockAddress = await validModuleGuardMock.getAddress();
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            const moduleGuardInterface = (await hre.ethers.getContractAt("IModuleGuard", validModuleGuardMockAddress)).interface;
            const checkAfterModuleExecutionTxData = moduleGuardInterface.encodeFunctionData("checkAfterModuleExecution", [
                `0x${"0".repeat(64)}`,
                true,
            ]);

            await validModuleGuardMock.givenCalldataRevertWithMessage(checkAfterModuleExecutionTxData, "Computer says Nah");

            await expect(safe.execTransactionFromModuleReturnData(user2.address, 0, "0xbeef73", 1)).to.be.reverted;
        });

        it("preserves the hash returned by checkModuleTransaction and passes it to checkAfterModuleExecution", async () => {
            const {
                safe,
                validModuleGuardMock,
                signers: [user1, user2],
            } = await setupTests();
            const validModuleGuardMockAddress = await validModuleGuardMock.getAddress();
            await executeContractCallWithSigners(safe, safe, "setModuleGuard", [validModuleGuardMockAddress], [user1]);

            const hash = ethers.hexlify(ethers.randomBytes(32));

            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            const moduleGuardInterface = (await hre.ethers.getContractAt("IModuleGuard", validModuleGuardMockAddress)).interface;
            const checkModuleTxData = moduleGuardInterface.encodeFunctionData("checkModuleTransaction", [
                user2.address,
                0,
                "0xbeef73",
                1,
                user2.address,
            ]);

            const checkAfterModuleExecutionTxData = moduleGuardInterface.encodeFunctionData("checkAfterModuleExecution", [hash, true]);
            await validModuleGuardMock.givenCalldataReturnBytes32(checkModuleTxData, hash);

            await safe.connect(user2).execTransactionFromModuleReturnData(user2.address, 0, "0xbeef73", 1);

            expect(await validModuleGuardMock.invocationCountForCalldata(checkAfterModuleExecutionTxData)).to.equal(1);
        });
    });

    describe("getModulesPaginated", () => {
        it("requires page size to be greater than 0", async () => {
            const { safe } = await setupTests();
            await expect(safe.getModulesPaginated(AddressOne, 0)).to.be.revertedWith("GS106");
        });

        it("requires start to be a module or start pointer", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();

            await expect(safe.getModulesPaginated(AddressZero, 1)).to.be.reverted;
            await executeContractCallWithSigners(safe, safe, "enableModule", [user1.address], [user1]);
            expect(await safe.getModulesPaginated(user1.address, 1)).to.be.deep.equal([[], AddressOne]);
            await expect(safe.getModulesPaginated(user2.address, 1)).to.be.revertedWith("GS105");
        });

        it("Returns all modules over multiple pages", async () => {
            const {
                safe,
                signers: [user1, user2, user3],
            } = await setupTests();
            await expect(executeContractCallWithSigners(safe, safe, "enableModule", [user1.address], [user1]))
                .to.emit(safe, "EnabledModule")
                .withArgs(user1.address);

            await expect(executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]))
                .to.emit(safe, "EnabledModule")
                .withArgs(user2.address);

            await expect(executeContractCallWithSigners(safe, safe, "enableModule", [user3.address], [user1]))
                .to.emit(safe, "EnabledModule")
                .withArgs(user3.address);

            await expect(await safe.isModuleEnabled(user1.address)).to.be.true;
            await expect(await safe.isModuleEnabled(user2.address)).to.be.true;
            await expect(await safe.isModuleEnabled(user3.address)).to.be.true;
            /*
            This will pass the test which is not correct
            await expect(await safe.getModulesPaginated(AddressOne, 1)).to.be.deep.equal([[user3.address], user2.address])
            await expect(await safe.getModulesPaginated(user2.address, 1)).to.be.deep.equal([[user1.address], AddressOne])
            */
            await expect(await safe.getModulesPaginated(AddressOne, 1)).to.be.deep.equal([[user3.address], user3.address]);
            await expect(await safe.getModulesPaginated(user3.address, 1)).to.be.deep.equal([[user2.address], user2.address]);
            await expect(await safe.getModulesPaginated(user2.address, 1)).to.be.deep.equal([[user1.address], AddressOne]);
        });

        it("returns an empty array and end pointer for a safe with no modules", async () => {
            const { safe } = await setupTests();
            expect(await safe.getModulesPaginated(AddressOne, 10)).to.be.deep.equal([[], AddressOne]);
        });
    });

    describe("setModuleGuard", () => {
        it("reverts if the module guard does not implement the ERC165 Module Guard Interface", async () => {
            const {
                signers: [user1, user2],
            } = await setupTests();
            const safe = await getSafe({ owners: [user1.address] });

            await expect(
                executeContractCallWithSigners(safe, safe, "setModuleGuard", [user2.address], [user1]),
            ).to.be.revertedWithoutReason();
        });

        it("emits an event when the module guard is changed", async () => {
            const {
                validModuleGuardMock,
                signers: [user1],
            } = await setupTests();
            const validGuardMockAddress = await validModuleGuardMock.getAddress();
            const safe = await getSafe({ owners: [user1.address] });

            await expect(executeContractCallWithSigners(safe, safe, "setModuleGuard", [validGuardMockAddress], [user1]))
                .to.emit(safe, "ChangedModuleGuard")
                .withArgs(validGuardMockAddress);

            await expect(executeContractCallWithSigners(safe, safe, "setModuleGuard", [AddressZero], [user1]))
                .to.emit(safe, "ChangedModuleGuard")
                .withArgs(AddressZero);
        });

        it("is not called when setting initially", async () => {
            const {
                validModuleGuardMock,
                signers: [user1],
            } = await setupTests();

            const invocationCountBefore = await validModuleGuardMock.invocationCount();
            const validModuleGuardMockAddress = await validModuleGuardMock.getAddress();
            const safe = await getSafe({ owners: [user1.address] });

            await executeContractCallWithSigners(safe, safe, "setModuleGuard", [validModuleGuardMockAddress], [user1]);

            // Check guard
            await expect(await hre.ethers.provider.getStorage(await safe.getAddress(), MODULE_GUARD_STORAGE_SLOT)).to.be.eq(
                "0x" + validModuleGuardMockAddress.toLowerCase().slice(2).padStart(64, "0"),
            );

            // Guard should not be called, as it was not set before the transaction execution
            expect(await validModuleGuardMock.invocationCount()).to.be.eq(invocationCountBefore);
        });

        it("is called when removed", async () => {
            const {
                safe,
                validModuleGuardMock,
                signers: [user1],
            } = await setupTests();
            const validModuleGuardMockAddress = await validModuleGuardMock.getAddress();
            await executeContractCallWithSigners(safe, safe, "setModuleGuard", [validModuleGuardMockAddress], [user1]);

            // Check module guard
            await expect(await hre.ethers.provider.getStorage(await safe.getAddress(), MODULE_GUARD_STORAGE_SLOT)).to.be.eq(
                "0x" + validModuleGuardMockAddress.toLowerCase().slice(2).padStart(64, "0"),
            );

            await executeContractCallWithSigners(safe, safe, "enableModule", [user1.address], [user1]);

            const data = safe.interface.encodeFunctionData("setModuleGuard", [AddressZero]);

            const moduleGuardInterface = (await hre.ethers.getContractAt("IModuleGuard", validModuleGuardMockAddress)).interface;
            const checkTxData = moduleGuardInterface.encodeFunctionData("checkModuleTransaction", [safe.target, 0, data, 0, user1.address]);

            const guardHash = ethers.randomBytes(32);

            await validModuleGuardMock.givenCalldataReturnBytes32(checkTxData, guardHash);

            await expect(await safe.connect(user1).execTransactionFromModule(safe, 0, data, 0))
                .to.emit(safe, "ChangedModuleGuard")
                .withArgs(AddressZero);

            // Check module guard
            await expect(await hre.ethers.provider.getStorage(await safe.getAddress(), MODULE_GUARD_STORAGE_SLOT)).to.be.eq(
                "0x" + "".padStart(64, "0"),
            );

            expect(await validModuleGuardMock.invocationCountForCalldata.staticCall(checkTxData)).to.be.eq(1);
            // Module Guard should also be called for post exec check, even if it is removed with the Safe tx
            const checkExecData = moduleGuardInterface.encodeFunctionData("checkAfterModuleExecution", [guardHash, true]);

            expect(await validModuleGuardMock.invocationCountForCalldata.staticCall(checkExecData)).to.be.eq(1);
        });
    });
});
