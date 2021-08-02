import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import { BigNumber } from "ethers";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { getSafeWithOwners, getMock } from "../utils/setup";
import { executeContractCallWithSigners } from "../../src/utils/execution";
import { AddressOne } from "../../src/utils/constants";

describe("ModuleManager", async () => {

    const [user1, user2] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        return {
            safe: await getSafeWithOwners([user1.address]),
            mock: await getMock()
        }
    })

    describe("enableModule", async () => {
        it('can only be called from Safe itself', async () => {
            const { safe } = await setupTests()
            await expect(safe.enableModule(user2.address)).to.be.revertedWith("GS031")
        })

        it('can not set sentinel', async () => {
            const { safe } = await setupTests()

            await expect(
                executeContractCallWithSigners(safe, safe, "enableModule", [AddressOne], [user1])
            ).to.revertedWith("GS013")
        })

        it('can not set 0 Address', async () => {
            const { safe } = await setupTests()
            await expect(
                executeContractCallWithSigners(safe, safe, "enableModule", [AddressZero], [user1])
            ).to.revertedWith("GS013")
        })

        it('can not add module twice', async () => {
            const { safe } = await setupTests()
            // Use module for execution to see error 
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1])

            await expect(
                executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1])
            ).to.revertedWith("GS013")
        })

        it('emits event for new module', async () => {
            const { safe } = await setupTests()
            await expect(
                executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1])
            ).to.emit(safe, "EnabledModule").withArgs(user2.address)

            await expect(
                await safe.isModuleEnabled(user2.address)
            ).to.be.true

            await expect(
                await safe.getModulesPaginated(AddressOne, 10)
            ).to.be.deep.equal([[user2.address], AddressOne])
        })

        it('can enable multiple', async () => {
            const { safe } = await setupTests()
            await expect(
                executeContractCallWithSigners(safe, safe, "enableModule", [user1.address], [user1])
            ).to.emit(safe, "EnabledModule").withArgs(user1.address)

            await expect(await safe.isModuleEnabled(user1.address)).to.be.true
            await expect(await safe.getModulesPaginated(AddressOne, 10)).to.be.deep.equal([[user1.address], AddressOne])

            await expect(
                executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1])
            ).to.emit(safe, "EnabledModule").withArgs(user2.address)

            await expect(await safe.isModuleEnabled(user2.address)).to.be.true
            await expect(await safe.getModulesPaginated(AddressOne, 10)).to.be.deep.equal([[user2.address, user1.address], AddressOne])
        })
    })

    describe("disableModule", async () => {
        it('can only be called from Safe itself', async () => {
            const { safe } = await setupTests()
            await expect(safe.disableModule(AddressOne, user2.address)).to.be.revertedWith("GS031")
        })

        it('can not set sentinel', async () => {
            const { safe } = await setupTests()

            await expect(
                executeContractCallWithSigners(safe, safe, "disableModule", [AddressOne, AddressOne], [user1])
            ).to.revertedWith("GS013")
        })

        it('can not set 0 Address', async () => {
            const { safe } = await setupTests()
            await expect(
                executeContractCallWithSigners(safe, safe, "disableModule", [AddressOne, AddressZero], [user1])
            ).to.revertedWith("GS013")
        })

        it('Invalid prevModule, module pair provided - Invalid target', async () => {
            const { safe } = await setupTests()
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1])
            await expect(
                executeContractCallWithSigners(safe, safe, "disableModule", [AddressOne, user1.address], [user1])
            ).to.revertedWith("GS013")
        })

        it('Invalid prevModule, module pair provided - Invalid sentinel', async () => {
            const { safe } = await setupTests()
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1])
            await expect(
                executeContractCallWithSigners(safe, safe, "disableModule", [AddressZero, user2.address], [user1])
            ).to.revertedWith("GS013")
        })

        it('Invalid prevModule, module pair provided - Invalid source', async () => {
            const { safe } = await setupTests()
            await executeContractCallWithSigners(safe, safe, "enableModule", [user1.address], [user1])
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1])
            await expect(
                executeContractCallWithSigners(safe, safe, "disableModule", [user1.address, user2.address], [user1])
            ).to.revertedWith("GS013")
        })

        it('emits event for disabled module', async () => {
            const { safe } = await setupTests()
            await executeContractCallWithSigners(safe, safe, "enableModule", [user1.address], [user1])
            await expect(await safe.isModuleEnabled(user1.address)).to.be.true
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1])
            await expect(await safe.isModuleEnabled(user2.address)).to.be.true
            await expect(await safe.getModulesPaginated(AddressOne, 10)).to.be.deep.equal([[user2.address, user1.address], AddressOne])

            await expect(
                executeContractCallWithSigners(safe, safe, "disableModule", [user2.address, user1.address], [user1])
            ).to.emit(safe, "DisabledModule").withArgs(user1.address)
            await expect(await safe.isModuleEnabled(user1.address)).to.be.false
            await expect(await safe.getModulesPaginated(AddressOne, 10)).to.be.deep.equal([[user2.address], AddressOne])

            await expect(
                executeContractCallWithSigners(safe, safe, "disableModule", [AddressOne, user2.address], [user1])
            ).to.emit(safe, "DisabledModule").withArgs(user2.address)
            await expect(await safe.isModuleEnabled(user2.address)).to.be.false
            await expect(await safe.getModulesPaginated(AddressOne, 10)).to.be.deep.equal([[], AddressOne])
        })
    })

    describe("execTransactionFromModule", async () => {
        it('can not be called from sentinel', async () => {
            const { safe, mock } = await setupTests()
            const readOnlySafe = safe.connect(hre.ethers.provider)
            await expect(readOnlySafe.callStatic.execTransactionFromModule(mock.address, 0, "0xbaddad", 0, { from: AddressOne })).to.be.revertedWith("GS104")
        })

        it('can only be called from enabled module', async () => {
            const { safe, mock } = await setupTests()
            const user2Safe = safe.connect(user2)
            await expect(user2Safe.execTransactionFromModule(mock.address, 0, "0xbaddad", 0)).to.be.revertedWith("GS104")
        })

        it('emits event on execution success', async () => {
            const { safe, mock } = await setupTests()
            const user2Safe = safe.connect(user2)
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1])

            await expect(
                user2Safe.execTransactionFromModule(mock.address, 0, "0xbaddad", 0)
            ).to.emit(safe, "ExecutionFromModuleSuccess").withArgs(user2.address)
            expect(await mock.callStatic.invocationCountForCalldata("0xbaddad")).to.be.deep.equals(BigNumber.from(1));
        })

        it('emits event on execution failure', async () => {
            const { safe, mock } = await setupTests()
            const user2Safe = safe.connect(user2)
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1])

            await mock.givenAnyRevert()
            await expect(
                user2Safe.execTransactionFromModule(mock.address, 0, "0xbaddad", 0)
            ).to.emit(safe, "ExecutionFromModuleFailure").withArgs(user2.address)
        })
    })

    describe("execTransactionFromModuleReturnData", async () => {
        it('can not be called from sentinel', async () => {
            const { safe, mock } = await setupTests()
            const readOnlySafe = safe.connect(hre.ethers.provider)
            await expect(readOnlySafe.callStatic.execTransactionFromModuleReturnData(mock.address, 0, "0xbaddad", 0, { from: AddressOne })).to.be.revertedWith("GS104")
        })

        it('can only be called from enabled module', async () => {
            const { safe, mock } = await setupTests()
            const user2Safe = safe.connect(user2)
            await expect(user2Safe.execTransactionFromModuleReturnData(mock.address, 0, "0xbaddad", 0)).to.be.revertedWith("GS104")
        })

        it('emits event on execution failure', async () => {
            const { safe, mock } = await setupTests()
            const user2Safe = safe.connect(user2)
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1])

            await mock.givenAnyRevert()
            await expect(
                user2Safe.execTransactionFromModuleReturnData(mock.address, 0, "0xbaddad", 0)
            ).to.emit(safe, "ExecutionFromModuleFailure").withArgs(user2.address)
        })

        it('emits event on execution success', async () => {
            const { safe, mock } = await setupTests()
            const user2Safe = safe.connect(user2)
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1])

            await expect(
                user2Safe.execTransactionFromModuleReturnData(mock.address, 0, "0xbaddad", 0)
            ).to.emit(safe, "ExecutionFromModuleSuccess").withArgs(user2.address)
            expect(await mock.callStatic.invocationCountForCalldata("0xbaddad")).to.be.deep.equals(BigNumber.from(1));
        })

        it('Returns expected from contract on successs', async () => {
            const { safe, mock } = await setupTests()
            const user2Safe = safe.connect(user2)
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1])

            await mock.givenCalldataReturn("0xbaddad", "0xdeaddeed")
            await expect(
                await user2Safe.callStatic.execTransactionFromModuleReturnData(mock.address, 0, "0xbaddad", 0)
            ).to.be.deep.eq([true, "0xdeaddeed"])
        })

        it('Returns expected from contract on failure', async () => {
            const { safe, mock } = await setupTests()
            const user2Safe = safe.connect(user2)
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1])

            await mock.givenCalldataRevertWithMessage("0xbaddad", "Some random message")
            await expect(
                await user2Safe.callStatic.execTransactionFromModuleReturnData(mock.address, 0, "0xbaddad", 0)
            ).to.be.deep.eq([false, "0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000013536f6d652072616e646f6d206d65737361676500000000000000000000000000"])
        })
    })
})