import { expect } from "chai";
import { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { getSafeTemplate, getSafeWithOwners } from "../utils/setup";
import { safeSignTypedData, executeTx, safeSignMessage, calculateSafeTransactionHash, safeApproveHash } from "../utils/execution";

describe("checkSignatures", async () => {

    const [user1, user2, user3, user4] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        return {
            safe: await getSafeWithOwners([user1.address])
        }
    })

    describe("Contract signature", async () => {
        it('should fail if signature points into static part', async () => {
            const { safe } = await setupTests()
            let signatures = "0x" + "000000000000000000000000" + user1.address.slice(2) + "0000000000000000000000000000000000000000000000000000000000000020" + "00" + // r, s, v  
            "0000000000000000000000000000000000000000000000000000000000000000" // Some data to read
            await expect(
                safe.execTransaction(safe.address, 0, "0x", 0, 0, 0, 0, AddressZero, AddressZero, signatures)
            ).to.be.revertedWith("Invalid contract signature location: inside static part")
        })

        it('should fail if sigantures data is not present', async () => {
            const { safe } = await setupTests()

            let signatures = "0x" + "000000000000000000000000" + user1.address.slice(2) + "0000000000000000000000000000000000000000000000000000000000000041" + "00" // r, s, v
            
            await expect(
                safe.execTransaction(safe.address, 0, "0x", 0, 0, 0, 0, AddressZero, AddressZero, signatures)
            ).to.be.revertedWith("Invalid contract signature location: length not present")
        })

        it('should fail if sigantures data is too short', async () => {
            const { safe } = await setupTests()

            let signatures = "0x" + "000000000000000000000000" + user1.address.slice(2) + "0000000000000000000000000000000000000000000000000000000000000041" + "00" + // r, s, v
            "0000000000000000000000000000000000000000000000000000000000000020" // length
            
            await expect(
                safe.execTransaction(safe.address, 0, "0x", 0, 0, 0, 0, AddressZero, AddressZero, signatures)
            ).to.be.revertedWith("Invalid contract signature location: data not complete")
        })
    })

    describe("EIP-712", async () => {
        
        it('should correctly calculate EIP-712 hash', async () => {
            const { safe } = await setupTests()
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
            const typedDataHash = calculateSafeTransactionHash(safe, tx)
            await expect(
                await safe.getTransactionHash(
                    tx.to, tx.value, tx.data, tx.operation, tx.safeTxGas, tx.baseGas, tx.gasPrice, tx.gasToken, tx.refundReceiver, tx.nonce
                )
            ).to.be.eq(typedDataHash)
        })

        it('should be able to use EIP-712 for signature generation', async () => {
            const { safe } = await setupTests()
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
                executeTx(safe, tx, [ await safeSignTypedData(user1, safe, tx) ])
            ).to.emit(safe, "ExecutionSuccess")
        })
    })

    describe("Signed Ethereum Message", async () => {

        it('should be able to use Signed Ethereum Messages for signature generation', async () => {
            const { safe } = await setupTests()
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
                executeTx(safe, tx, [ await safeSignMessage(user1, safe, tx) ])
            ).to.emit(safe, "ExecutionSuccess")
        })
    })

    describe("Approve Hash", async () => {

        it('msg.sender does not need to approve before', async () => {
            const { safe } = await setupTests()
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
                executeTx(safe, tx, [ await safeApproveHash(user1, safe, tx, true) ])
            ).to.emit(safe, "ExecutionSuccess")
        })

        it('if not msg.sender on-chain approval is required', async () => {
            const { safe } = await setupTests()
            const user2Safe = safe.connect(user2)
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
                executeTx(user2Safe, tx, [ await safeApproveHash(user1, safe, tx, true) ])
            ).to.be.revertedWith("Hash has not been approved")
        })

        it('should be able to use pre approved hashes for signature generation', async () => {
            const { safe } = await setupTests()
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
                executeTx(safe, tx, [ await safeApproveHash(user1, safe, tx) ])
            ).to.emit(safe, "ExecutionSuccess")
        })
    })

    describe("Combination", async () => {

        it('should revert if threshold is not set', async () => {
            await setupTests()
            const safe = await getSafeTemplate()
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
                executeTx(safe, tx, [ ])
            ).to.be.revertedWith("Threshold needs to be defined!")
        })

        it('should revert if not the required amount of signature data is provided', async () => {
            await setupTests()
            const safe = await getSafeWithOwners([user1.address, user2.address, user3.address])
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
                executeTx(safe, tx, [ ])
            ).to.be.revertedWith("Signatures data too short")
        })

        it('should not be able to use different signature type of same owner', async () => {
            await setupTests()
            const safe = await getSafeWithOwners([user1.address, user2.address, user3.address])
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
                executeTx(safe, tx, [ await safeApproveHash(user1, safe, tx), await safeSignTypedData(user1, safe, tx), await safeSignTypedData(user3, safe, tx) ])
            ).to.be.revertedWith("Invalid owner provided")
        })

        it('should be able to mix all signature types', async () => {
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