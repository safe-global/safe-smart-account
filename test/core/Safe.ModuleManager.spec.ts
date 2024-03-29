import { expect } from "chai";
import hre, { deployments, ethers } from "hardhat";
import { AddressZero } from "@ethersproject/constants";
import { getSafeWithOwners, getMock } from "../utils/setup";
import { executeContractCallWithSigners } from "../../src/utils/execution";
import { AddressOne } from "../../src/utils/constants";

describe("ModuleManager", () => {
    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const signers = await ethers.getSigners();
        const [user1] = signers;

        return {
            safe: await getSafeWithOwners([user1.address]),
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

            await expect(executeContractCallWithSigners(safe, safe, "enableModule", [AddressOne], [user1])).to.revertedWith("GS013");
        });

        it("can not set 0 Address", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            await expect(executeContractCallWithSigners(safe, safe, "enableModule", [AddressZero], [user1])).to.revertedWith("GS013");
        });

        it("can not add module twice", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            // Use module for execution to see error
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            await expect(executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1])).to.revertedWith("GS013");
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
                "GS013",
            );
        });

        it("can not set 0 Address", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            await expect(executeContractCallWithSigners(safe, safe, "disableModule", [AddressOne, AddressZero], [user1])).to.revertedWith(
                "GS013",
            );
        });

        it("Invalid prevModule, module pair provided - Invalid target", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);
            await expect(executeContractCallWithSigners(safe, safe, "disableModule", [AddressOne, user1.address], [user1])).to.revertedWith(
                "GS013",
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
            ).to.revertedWith("GS013");
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
            ).to.revertedWith("GS013");
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
});
