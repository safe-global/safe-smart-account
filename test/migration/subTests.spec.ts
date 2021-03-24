import { Contract } from "@ethersproject/contracts"
import { parseEther } from "@ethersproject/units"
import { expect } from "chai";
import hre, { ethers, waffle } from "hardhat";
import { buildSafeTransaction, executeTx, executeTxWithSigners } from "../utils/execution"

interface TestSetup {
    migratedSafe: Contract,
    mock: Contract
}

export const verificationTests = (setupTests: () => Promise<TestSetup>) => {

    const [user1, user2] = waffle.provider.getWallets();

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
}