import { expect } from "chai";
import hre, { deployments, ethers, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { deployContract, getSafeSingleton, getSafeTemplate } from "../utils/setup";
import { executeContractCallWithSigners } from "../../src/utils/execution";
import { defaultAbiCoder } from "ethers/lib/utils";
import { BigNumber } from "ethers";

describe("TheXFix", async () => {

    const [user1, user2] = waffle.provider.getWallets();

    const setupWithTemplate = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const singleton = await getSafeSingleton()
        const theXSource = `
        contract TheX {

            address public owner;

            constructor() {
                owner = msg.sender;
            }

            fallback() payable external {
            }

            function withdraw(address daoWallet) public {
                require(msg.sender == owner, "Only owner can trigger this");
                uint256 balance = address(this).balance;
                require(balance > 0, "Nothing to withdraw");
                (bool success, ) = daoWallet.call{value: balance}("DAO");
                require(success, "DAO Transaction Unsuccessful");
            }
        }`
        const theX = await deployContract(user1, theXSource);
        const fixSource = `
        contract TheXFixSingleton {

            address public immutable fixSingleton;
            address public immutable expectedSingleton;

            address singleton;

            constructor(address _singleton) {
                fixSingleton = address(this);
                expectedSingleton = _singleton;
            }

            fallback() payable external {
                // Reset Singleton
                singleton = expectedSingleton;
            }

            function upgrade() public {
                require(address(this) != fixSingleton, "Call via delegatecall"); 
                require(singleton == expectedSingleton, "Unexpected Singleton");
                singleton = fixSingleton;
            }
        }`
        const fix = await deployContract(user1, fixSource, ethers.utils.defaultAbiCoder.encode(["address"], [singleton.address]).slice(2));
        await user1.sendTransaction({ to: theX.address, value: 10000000 })
        return {
            safe: await getSafeTemplate(),
            singleton,
            fix,
            theX
        }
    })

    describe("execute fix", async () => {
        it('upgrade to fix singleton and execute withdraw', async () => {
            const { safe, singleton, fix, theX } = await setupWithTemplate()
            // Setup Safe
            await safe.setup([user1.address, user2.address], 1, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero)

            await expect(
                await hre.ethers.provider.getStorageAt(safe.address, "0x0")
            ).to.be.eq(defaultAbiCoder.encode(["address"], [singleton.address]))
            await expect(await hre.ethers.provider.getBalance(safe.address)).to.be.eq(0)
            await executeContractCallWithSigners(safe, fix, "upgrade", [], [user1], true)

            await expect(
                await hre.ethers.provider.getStorageAt(safe.address, "0x0")
            ).to.be.eq(defaultAbiCoder.encode(["address"], [fix.address]))
            await expect(await hre.ethers.provider.getBalance(safe.address)).to.be.eq(0)
            await user1.sendTransaction({
                to: theX.address,
                data: theX.interface.encodeFunctionData("withdraw", [safe.address]),
            })

            await expect(
                await hre.ethers.provider.getStorageAt(safe.address, "0x0")
            ).to.be.eq(defaultAbiCoder.encode(["address"], [singleton.address]))
            await expect(await hre.ethers.provider.getBalance(safe.address)).to.be.eq(10000000)

            await expect(await safe.getThreshold()).to.be.deep.eq(BigNumber.from(1))
            await expect(await safe.getOwners()).to.be.deep.equal([user1.address, user2.address, ])
        })
    })
})