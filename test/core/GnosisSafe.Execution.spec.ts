import { expect } from "chai";
import { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { getSafeTemplate, getSafeWithOwners } from "../utils/setup";
import { safeSignTypedData, executeTx, safeSignMessage, calculateSafeTransactionHash, safeApproveHash, buildSignatureBytes } from "../utils/execution";

describe("GnosisSafe", async () => {

    const [user1, user2, user3, user4] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        return {
            safe: await getSafeWithOwners([user1.address, user2.address])
        }
    })

    describe("execTransactions", async () => {

        it('should revert if too little gas is provided', async () => {
            const { safe } = await setupTests()
            const tx = {
                to: safe.address,
                value: 0,
                data: "0x",
                operation: 0,
                safeTxGas: 1000000,
                baseGas: 0,
                gasPrice: 0,
                gasToken: AddressZero,
                refundReceiver: AddressZero,
                nonce: await safe.nonce()
            }

            const signatureBytes = buildSignatureBytes([
                await safeApproveHash(user1, safe, tx, true),
                await safeSignTypedData(user2, safe, tx)
            ])
            await expect(
                safe.execTransaction(
                    tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken, tx.refundReceiver, signatureBytes,
                    { gasLimit: 1000000 }
                )
            ).to.be.revertedWith("Not enough gas to execute safe transaction")
        })

        it.skip('should be able to mix all signature types', async () => {
            await setupTests()
            const safe = await getSafeWithOwners([user1.address, user2.address, user3.address, user4.address])
            const tx = {
                to: safe.address,
                value: 0,
                data: "0x",
                operation: 0,
                safeTxGas: 0,
                baseGas: 0,
                gasPrice: 0,
                gasToken: AddressZero,
                refundReceiver: AddressZero,
                nonce: await safe.nonce()
            }
            await expect(
                executeTx(safe, tx, [
                    await safeApproveHash(user1, safe, tx, true),
                    await safeApproveHash(user4, safe, tx),
                    await safeSignTypedData(user2, safe, tx),
                    await safeSignTypedData(user3, safe, tx)
                ])
            ).to.emit(safe, "ExecutionSuccess")
        })
    })
})