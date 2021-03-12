import { expect } from "chai";
import hre, { deployments, waffle, ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { getSafeWithOwners } from "../utils/setup";
import { executeContractCallWithSigners } from "../utils/execution";
import { AddressOne } from "../utils/constants";

describe("DelegateCallTransactionGuard", async () => {

    const [user1] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const safe = await getSafeWithOwners([user1.address])
        const guardFactory = await hre.ethers.getContractFactory("DelegateCallTransactionGuard");
        const guard = await guardFactory.deploy(AddressZero)
        await executeContractCallWithSigners(safe, safe, "setGuard", [guard.address], [user1])
        return {
            safe,
            guardFactory,
            guard
        }
    })

    describe("fallback", async () => {
        it('must NOT revert on fallback without value', async () => {
            const { guard } = await setupTests()
            await user1.sendTransaction({
                to: guard.address,
                data: "0xbaddad"
            })
        })
        it('should revert on fallback with value', async () => {
            const { guard } = await setupTests()
            await expect(
                user1.sendTransaction({
                    to: guard.address,
                    data: "0xbaddad",
                    value: 1
                })
            ).to.be.reverted
        })
    })

    describe("checkCalldata", async () => {

        it('must NOT revert on empty calldata', async () => {
            const { safe, guard } = await setupTests()

            await guard.checkCalldata("0x", safe.address)
        })

        it('must NOT revert on unknown calldata', async () => {
            const { guard } = await setupTests()

            await guard.checkCalldata("0xbaddad42", user1.address)
        })

        it('should on delegate call', async () => {
            const { safe } = await setupTests()
            await expect(
                executeContractCallWithSigners(safe, safe, "setGuard", [AddressZero], [user1], true)
            ).to.be.revertedWith("This call is restricted")

            await executeContractCallWithSigners(safe, safe, "setGuard", [AddressZero], [user1])
        })

        it('can set allowed target', async () => {
            const { safe, guardFactory } = await setupTests()
            const guard = await guardFactory.deploy(AddressOne)
            await executeContractCallWithSigners(safe, safe, "setGuard", [guard.address], [user1])

            expect(
                await guard.allowedTarget()
            ).to.be.eq(AddressOne)
            const allowedTarget = safe.attach(AddressOne)
            await expect(
                executeContractCallWithSigners(safe, safe, "setFallbackHandler", [AddressZero], [user1], true)
            ).to.be.revertedWith("This call is restricted")

            await executeContractCallWithSigners(safe, allowedTarget, "setFallbackHandler", [AddressZero], [user1], true)
        })
    })
})