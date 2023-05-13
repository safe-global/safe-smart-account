import { expect } from "chai";
import hre, { deployments } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { getContractFactoryByName, getMock, getSafeWithOwners, getWallets } from "../utils/setup";
import { buildSafeTransaction, buildSignatureBytes, executeContractCallWithSigners, executeTx, executeTxWithSigners, safeSignTypedData } from "../../src/utils/execution";

describe("ReentrancyTransactionGuard", async () => {

    const [user1] = getWallets(hre);

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const safe = await getSafeWithOwners([user1.address])
        const guardFactory = await getContractFactoryByName("ReentrancyTransactionGuard");
        const guard = await guardFactory.deploy()
        await guard.deployed()
        const mock = await getMock()
        await (
            await executeContractCallWithSigners(safe, safe, "setGuard", [guard.address], [user1])
        ).wait();

        return {
            safe,
            mock,
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

    describe("checkTransaction", async () => {
        it('should revert if Safe tries to reenter execTransaction', async () => {
            const { safe, mock } = await setupTests()
            const nonce = await safe.nonce()
            const safeTx = buildSafeTransaction({ to: mock.address, data: "0xbaddad42", nonce: nonce.add(1) })
            const signatures = [await safeSignTypedData(user1, safe, safeTx)]
            const signatureBytes = buildSignatureBytes(signatures)

            // We should revert with GS013 as the internal tx is reverted because of the reentrancy guard
            await expect(
                executeContractCallWithSigners(safe, safe, "execTransaction", [
                    safeTx.to,
                    safeTx.value,
                    safeTx.data,
                    safeTx.operation,
                    safeTx.safeTxGas,
                    safeTx.baseGas,
                    safeTx.gasPrice,
                    safeTx.gasToken,
                    safeTx.refundReceiver,
                    signatureBytes
                ], [user1])
            ).to.be.revertedWith("GS013")

            expect(await mock.callStatic.invocationCount()).to.be.eq(0);
        })

        it('should be able to execute without nesting', async () => {
            const { safe, mock } = await setupTests()
            const nonce = await safe.nonce()
            const safeTx = buildSafeTransaction({ to: mock.address, data: "0xbaddad42", nonce: nonce.add(1) })
            const signatures = [await safeSignTypedData(user1, safe, safeTx)]

            await (await executeTxWithSigners(safe, buildSafeTransaction({ to: safe.address, data: "0x", nonce: nonce }), [user1])).wait()
            await (await executeTx(safe, safeTx, signatures)).wait()

            expect(await mock.callStatic.invocationCount()).to.be.eq(1);
            expect(await mock.callStatic.invocationCountForCalldata("0xbaddad42")).to.be.eq(1);
        })
    })
})
