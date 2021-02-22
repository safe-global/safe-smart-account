import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import { BigNumber } from "ethers";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { parseEther } from "@ethersproject/units";
import { deployContract, getMock, getSafeSingleton, getSafeTemplate } from "../utils/setup";
import { calculateSafeDomainHash } from "../utils/execution";
import { AddressOne } from "../utils/constants";
import { encodeTransfer } from "../utils/encoding";


describe("GnosisSafe", async () => {

    const [user1, user2, user3] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        return {
            template: await getSafeTemplate(),
            mock: await getMock()
        }
    })

    describe("Setup", async () => {
        it('should not allow to call setup on singleton', async () => {
            await deployments.fixture();
            const singleton = await getSafeSingleton()
            await expect(
                await singleton.getThreshold()
            ).to.be.deep.eq(BigNumber.from(1))
            await expect(
                await singleton.getModules()
            ).to.be.deep.eq([])

            // "Should not be able to retrieve owners (currently the contract will run in an endless loop when not initialized)"
            await expect(
                singleton.getOwners()
            ).to.be.reverted

            await expect(
                singleton.setup([user1.address, user2.address, user3.address], 2, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero),
            ).to.be.revertedWith("Owners have already been setup")
        })

        it('should set domain hash', async () => {
            const { template } = await setupTests()
            await template.setup([user1.address, user2.address, user3.address], 2, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero)
            await expect(await template.domainSeparator()).to.be.eq(calculateSafeDomainHash(template))
            await expect(await template.getOwners()).to.be.deep.eq([user1.address, user2.address, user3.address])
            await expect(await template.getThreshold()).to.be.deep.eq(BigNumber.from(2))
        })

        it('should revert if called twice', async () => {
            const { template } = await setupTests()
            await template.setup([user1.address, user2.address, user3.address], 2, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero)
            await expect(
                template.setup([user1.address, user2.address, user3.address], 2, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero)
            ).to.be.revertedWith("Domain Separator already set!")
        })

        it('should revert if same owner is included twice', async () => {
            const { template } = await setupTests()
            await expect(
                template.setup([user2.address, user1.address, user2.address], 2, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero)
            ).to.be.revertedWith("Duplicate owner address provided")
        })

        it('should revert if 0 address is used as an owner', async () => {
            const { template } = await setupTests()
            await expect(
                template.setup([user2.address, AddressZero], 2, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero)
            ).to.be.revertedWith("Invalid owner address provided")
        })

        it('should revert if Safe itself is used as an owner', async () => {
            const { template } = await setupTests()
            await expect(
                template.setup([user2.address, template.address], 2, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero)
            ).to.be.revertedWith("Invalid owner address provided")
        })

        it('should revert if sentinel is used as an owner', async () => {
            const { template } = await setupTests()
            await expect(
                template.setup([user2.address, AddressOne], 2, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero)
            ).to.be.revertedWith("Invalid owner address provided")
        })

        it.skip('should revert if same owner is included twice one after each other', async () => {
            const { template } = await setupTests()
            await expect(
                template.setup([user1.address, user2.address, user2.address], 2, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero)
            ).to.be.revertedWith("Domain Separator already set!")
        })

        it('should revert if threshold is too high', async () => {
            const { template } = await setupTests()
            await expect(
                template.setup([user1.address, user2.address, user3.address], 4, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero)
            ).to.be.revertedWith("Threshold cannot exceed owner count")
        })

        it('should revert if threshold is 0', async () => {
            const { template } = await setupTests()
            await expect(
                template.setup([user1.address, user2.address, user3.address], 0, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero)
            ).to.be.revertedWith("Threshold needs to be greater than 0")
        })

        it('should revert if owners are empty', async () => {
            const { template } = await setupTests()
            await expect(
                template.setup([], 0, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero)
            ).to.be.revertedWith("Threshold needs to be greater than 0")
        })

        it('should set fallback handler and call sub inititalizer', async () => {
            const { template } = await setupTests()
            const source = `
            contract Initializer {
                function init(bytes4 data) public {
                    bytes32 slot = 0x4242424242424242424242424242424242424242424242424242424242424242;
                    // solium-disable-next-line security/no-inline-assembly
                    assembly {
                        sstore(slot, data)
                    }
                }
            }`
            const testIntializer = await deployContract(user1, source);
            const initData = testIntializer.interface.encodeFunctionData("init", ["0x42baddad"])
            await template.setup([user1.address, user2.address, user3.address], 2, testIntializer.address, initData, AddressOne, AddressZero, 0, AddressZero)
            await expect(await template.domainSeparator()).to.be.eq(calculateSafeDomainHash(template))
            await expect(await template.getOwners()).to.be.deep.eq([user1.address, user2.address, user3.address])
            await expect(await template.getThreshold()).to.be.deep.eq(BigNumber.from(2))

            await expect(
                await hre.ethers.provider.getStorageAt(template.address, "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5")
            ).to.be.eq("0x" + "1".padStart(64, "0"))

            await expect(
                await hre.ethers.provider.getStorageAt(template.address, "0x4242424242424242424242424242424242424242424242424242424242424242")
            ).to.be.eq("0x" + "42baddad".padEnd(64, "0"))
        })

        it('should fail if sub initializer fails', async () => {
            const { template } = await setupTests()
            const source = `
            contract Initializer {
                function init(bytes4 data) public {
                    require(false, "Computer says nah");
                }
            }`
            const testIntializer = await deployContract(user1, source);
            const initData = testIntializer.interface.encodeFunctionData("init", ["0x42baddad"])
            await expect(
                template.setup([user1.address, user2.address, user3.address], 2, testIntializer.address, initData, AddressZero, AddressZero, 0, AddressZero)
            ).to.be.revertedWith("Could not finish initialization")
        })

        it('should fail if ether payment fails', async () => {
            const { template, mock } = await setupTests()
            const payment = 133742

            const transferData = encodeTransfer(user1.address, payment)
            await mock.givenCalldataRevert(transferData)
            await expect(
                template.setup([user1.address, user2.address, user3.address], 2, AddressZero, "0x", AddressZero, AddressZero, payment, AddressZero)
            ).to.be.revertedWith("Could not pay gas costs with ether")
        })

        it('should work with ether payment to deployer', async () => {
            const { template } = await setupTests()
            const payment = parseEther("10")
            await user1.sendTransaction({ to: template.address, value: payment })
            const userBalance = await hre.ethers.provider.getBalance(user1.address)
            await expect(await hre.ethers.provider.getBalance(template.address)).to.be.deep.eq(parseEther("10"))

            await template.setup([user1.address, user2.address, user3.address], 2, AddressZero, "0x", AddressZero, AddressZero, payment, AddressZero)
            
            await expect(await hre.ethers.provider.getBalance(template.address)).to.be.deep.eq(parseEther("0"))
            await expect(userBalance.lt(await hre.ethers.provider.getBalance(user1.address))).to.be.true
        })

        it('should work with ether payment to account', async () => {
            const { template } = await setupTests()
            const payment = parseEther("10")
            await user1.sendTransaction({ to: template.address, value: payment })
            const userBalance = await hre.ethers.provider.getBalance(user2.address)
            await expect(await hre.ethers.provider.getBalance(template.address)).to.be.deep.eq(parseEther("10"))

            await template.setup([user1.address, user2.address, user3.address], 2, AddressZero, "0x", AddressZero, AddressZero, payment, user2.address)
            
            await expect(await hre.ethers.provider.getBalance(template.address)).to.be.deep.eq(parseEther("0"))
            await expect(await hre.ethers.provider.getBalance(user2.address)).to.be.deep.eq(userBalance.add(payment))

            await expect(await template.getOwners()).to.be.deep.eq([user1.address, user2.address, user3.address])
        })

        it('should fail if token payment fails', async () => {
            const { template, mock } = await setupTests()
            const payment = 133742

            const transferData = encodeTransfer(user1.address, payment)
            await mock.givenCalldataRevert(transferData)
            await expect(
                template.setup([user1.address, user2.address, user3.address], 2, AddressZero, "0x", AddressZero, mock.address, payment, AddressZero)
            ).to.be.revertedWith("Could not pay gas costs with token")
        })

        it('should work with token payment to deployer', async () => {
            const { template, mock } = await setupTests()
            const payment = 133742

            const transferData = encodeTransfer(user1.address, payment)
            await mock.givenCalldataReturnBool(transferData, true)
            await template.setup([user1.address, user2.address, user3.address], 2, AddressZero, "0x", AddressZero, mock.address, payment, AddressZero)
            
            expect(await mock.callStatic.invocationCountForCalldata(transferData)).to.be.deep.equals(BigNumber.from(1));

            await expect(await template.getOwners()).to.be.deep.eq([user1.address, user2.address, user3.address])
        })

        it('should work with token payment to account', async () => {
            const { template, mock } = await setupTests()
            const payment = 133742

            const transferData = encodeTransfer(user2.address, payment)
            await mock.givenCalldataReturnBool(transferData, true)
            await template.setup([user1.address, user2.address, user3.address], 2, AddressZero, "0x", AddressZero, mock.address, payment, user2.address)
            
            expect(await mock.callStatic.invocationCountForCalldata(transferData)).to.be.deep.equals(BigNumber.from(1));

            await expect(await template.getOwners()).to.be.deep.eq([user1.address, user2.address, user3.address])
        })
    })
})