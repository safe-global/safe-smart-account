import { BigNumber } from "ethers";
import { Contract } from "@ethersproject/contracts"
import { parseEther } from "@ethersproject/units"
import { expect } from "chai";
import hre, { ethers, waffle } from "hardhat";
import { AddressOne } from "../../src/utils/constants";
import { buildSafeTransaction, executeContractCallWithSigners, executeTxWithSigners, MetaTransaction } from "../../src/utils/execution"
import { buildMultiSendSafeTx } from "../../src/utils/multisend";

interface TestSetup {
    migratedSafe: Contract,
    mock: Contract,
    multiSend: Contract
}

export const verificationTests = (setupTests: () => Promise<TestSetup>) => {

    const [user1, user2, user3] = waffle.provider.getWallets();

    describe("execTransaction", async () => {
        it('should be able to transfer ETH', async () => {
            const { migratedSafe } = await setupTests()
            await user1.sendTransaction({ to: migratedSafe.address, value: parseEther("1") })
            const nonce = await migratedSafe.nonce()
            const tx = buildSafeTransaction({ to: user2.address, value: parseEther("1"), nonce })

            const userBalance = await ethers.provider.getBalance(user2.address)
            await expect(await ethers.provider.getBalance(migratedSafe.address)).to.be.deep.eq(parseEther("1"))

            await executeTxWithSigners(migratedSafe, tx, [user1])

            await expect(await ethers.provider.getBalance(user2.address)).to.be.deep.eq(userBalance.add(parseEther("1")))
            await expect(await ethers.provider.getBalance(migratedSafe.address)).to.be.deep.eq(parseEther("0"))
        })
    })

    describe("addOwner", async () => {
        it('should add owner and change treshold', async () => {
            const { migratedSafe } = await setupTests()

            await expect(
                executeContractCallWithSigners(migratedSafe, migratedSafe, "addOwnerWithThreshold", [user2.address, 2], [user1])
            ).to.emit(migratedSafe, "AddedOwner").withArgs(user2.address).and.to.emit(migratedSafe, "ChangedThreshold")

            await expect(await migratedSafe.getThreshold()).to.be.deep.eq(BigNumber.from(2))
            await expect(await migratedSafe.getOwners()).to.be.deep.equal([user2.address, user1.address])

            await expect(
                executeContractCallWithSigners(migratedSafe, migratedSafe, "addOwnerWithThreshold", [user3.address, 1], [user1, user2])
            ).to.emit(migratedSafe, "AddedOwner").withArgs(user3.address).and.to.emit(migratedSafe, "ChangedThreshold")

            await expect(await migratedSafe.getThreshold()).to.be.deep.eq(BigNumber.from(1))
            await expect(await migratedSafe.getOwners()).to.be.deep.equal([user3.address, user2.address, user1.address])

            await expect(await migratedSafe.isOwner(user1.address)).to.be.true
            await expect(await migratedSafe.isOwner(user2.address)).to.be.true
            await expect(await migratedSafe.isOwner(user3.address)).to.be.true
        })
    })

    describe("enableModule", async () => {
        it('should enabled module and be able to use it', async () => {
            const { migratedSafe, mock } = await setupTests()

            await expect(
                executeContractCallWithSigners(migratedSafe, migratedSafe, "enableModule", [user2.address], [user1])
            ).to.emit(migratedSafe, "EnabledModule").withArgs(user2.address)

            await expect(await migratedSafe.isModuleEnabled(user2.address)).to.be.true
            await expect(await migratedSafe.getModulesPaginated(AddressOne, 10)).to.be.deep.equal([[user2.address], AddressOne])

            const user2Safe = migratedSafe.connect(user2)
            await expect(
                user2Safe.execTransactionFromModule(mock.address, 0, "0xbaddad", 0)
            ).to.emit(migratedSafe, "ExecutionFromModuleSuccess").withArgs(user2.address)
            expect(await mock.callStatic.invocationCountForCalldata("0xbaddad")).to.be.deep.equals(BigNumber.from(1));
        })
    })

    describe("multiSend", async () => {
        it('execute multisend via delegatecall', async () => {
            const { migratedSafe, mock, multiSend } = await setupTests()

            await user1.sendTransaction({to: migratedSafe.address, value: parseEther("1")})
            const userBalance = await hre.ethers.provider.getBalance(user2.address)
            await expect(await hre.ethers.provider.getBalance(migratedSafe.address)).to.be.deep.eq(parseEther("1"))

            const txs: MetaTransaction[] = [
                buildSafeTransaction({to: user2.address, value: parseEther("1"), nonce: 0}),
                buildSafeTransaction({to: mock.address, data: "0xbaddad", nonce: 0})
            ]
            const safeTx = buildMultiSendSafeTx(multiSend, txs, await migratedSafe.nonce())
            await expect(
                executeTxWithSigners(migratedSafe, safeTx, [ user1 ])
            ).to.emit(migratedSafe, "ExecutionSuccess")
            
            await expect(await hre.ethers.provider.getBalance(migratedSafe.address)).to.be.deep.eq(parseEther("0"))
            await expect(await hre.ethers.provider.getBalance(user2.address)).to.be.deep.eq(userBalance.add(parseEther("1")))
            expect(await mock.callStatic.invocationCountForCalldata("0xbaddad")).to.be.deep.equals(BigNumber.from(1));
        })
    })

    describe("fallbackHandler", async () => {
        it('should be correctly set', async () => {
            const { migratedSafe, mock } = await setupTests()
            // Check fallback handler
            await expect(
                await ethers.provider.getStorageAt(migratedSafe.address, "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5")
            ).to.be.eq("0x" + mock.address.toLowerCase().slice(2).padStart(64, "0"))
        })
    })
}