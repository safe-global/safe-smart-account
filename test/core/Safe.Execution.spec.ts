import { expect } from "chai";
import hre from "hardhat";
import { deployContractFromSource, getSafe } from "../utils/setup";
import {
    safeApproveHash,
    buildSignatureBytes,
    executeContractCallWithSigners,
    buildSafeTransaction,
    executeTx,
    calculateSafeTransactionHash,
    buildContractCall,
} from "../../src/utils/execution";

import { chainId } from "../utils/encoding";

describe("Safe", () => {
    const setupTests = hre.deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const signers = await hre.ethers.getSigners();
        const [user1] = signers;
        const setterSource = `
            contract StorageSetter {
                function setStorage(bytes3 data) public {
                    bytes32 slot = 0x4242424242424242424242424242424242424242424242424242424242424242;
                    /* solhint-disable no-inline-assembly */
                    /// @solidity memory-safe-assembly
                    assembly {
                        sstore(slot, data)
                    }
                    /* solhint-enable no-inline-assembly */
                }
            }`;
        const storageSetter = await deployContractFromSource(user1, setterSource);
        const TestNativeTokenReceiver = await hre.ethers.getContractFactory("TestNativeTokenReceiver");
        const nativeTokenReceiver = await TestNativeTokenReceiver.deploy();

        const reverterSource = `
            contract Reverter {
                function revert() public {
                    require(false, "Shit happens");
                }
            }`;
        const reverter = await deployContractFromSource(user1, reverterSource);
        return {
            safe: await getSafe({ owners: [user1.address] }),
            reverter,
            storageSetter,
            nativeTokenReceiver,
            signers,
        };
    });

    describe("execTransaction", () => {
        it("should revert if too little gas is provided", async () => {
            const { safe, signers } = await setupTests();
            const [user1] = signers;
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, safeTxGas: 1000000, nonce: await safe.nonce() });
            const signatureBytes = buildSignatureBytes([await safeApproveHash(user1, safe, tx, true)]);

            const txPromise = safe.execTransaction(
                tx.to,
                tx.value,
                tx.data,
                tx.operation,
                tx.safeTxGas,
                tx.baseGas,
                tx.gasPrice,
                tx.gasToken,
                tx.refundReceiver,
                signatureBytes,
                { gasLimit: 1000000 },
            );

            // ZkSync node will not even let you execute the transaction with too little gas and just throw, so we can't test the revert reason
            // .to.be.reverted works as a catch statement
            if (hre.network.zksync) {
                await expect(txPromise).to.be.reverted;
            } else {
                await expect(txPromise).to.be.revertedWith("GS010");
            }
        });

        it("should emit event for successful call execution", async () => {
            const { safe, storageSetter, signers } = await setupTests();
            const [user1] = signers;
            const safeAddress = await safe.getAddress();
            const storageSetterAddress = await storageSetter.getAddress();
            const txHash = calculateSafeTransactionHash(
                safeAddress,
                await buildContractCall(storageSetter, "setStorage", ["0xbaddad"], await safe.nonce()),
                await chainId(),
            );
            await expect(executeContractCallWithSigners(safe, storageSetter, "setStorage", ["0xbaddad"], [user1]))
                .to.emit(safe, "ExecutionSuccess")
                .withArgs(txHash, 0);

            await expect(
                await hre.ethers.provider.getStorage(safeAddress, "0x4242424242424242424242424242424242424242424242424242424242424242"),
            ).to.be.eq("0x" + "".padEnd(64, "0"));

            await expect(
                await hre.ethers.provider.getStorage(
                    storageSetterAddress,
                    "0x4242424242424242424242424242424242424242424242424242424242424242",
                ),
            ).to.be.eq("0x" + "baddad".padEnd(64, "0"));
        });

        it("should emit event for failed call execution if safeTxGas > 0", async () => {
            const { safe, reverter, signers } = await setupTests();
            const [user1] = signers;
            await expect(executeContractCallWithSigners(safe, reverter, "revert", [], [user1], false, { safeTxGas: 1 })).to.emit(
                safe,
                "ExecutionFailure",
            );
        });

        it("should emit event for failed call execution if gasPrice > 0", async () => {
            const { safe, reverter, signers } = await setupTests();
            const [user1] = signers;
            const safeAddress = await safe.getAddress();
            // Fund refund
            await user1.sendTransaction({ to: safeAddress, value: 10000000 });
            await expect(executeContractCallWithSigners(safe, reverter, "revert", [], [user1], false, { gasPrice: 1 })).to.emit(
                safe,
                "ExecutionFailure",
            );
        });

        it("should revert for failed call execution if gasPrice == 0 and safeTxGas == 0", async () => {
            const { safe, reverter, signers } = await setupTests();
            const [user1] = signers;
            await expect(executeContractCallWithSigners(safe, reverter, "revert", [], [user1])).to.revertedWith("Shit happens");
        });

        it("should emit event for successful delegatecall execution", async () => {
            const { safe, storageSetter, signers } = await setupTests();
            const [user1] = signers;
            const safeAddress = await safe.getAddress();
            const storageSetterAddress = await storageSetter.getAddress();
            await expect(executeContractCallWithSigners(safe, storageSetter, "setStorage", ["0xbaddad"], [user1], true)).to.emit(
                safe,
                "ExecutionSuccess",
            );

            await expect(
                await hre.ethers.provider.getStorage(safeAddress, "0x4242424242424242424242424242424242424242424242424242424242424242"),
            ).to.be.eq("0x" + "baddad".padEnd(64, "0"));

            await expect(
                await hre.ethers.provider.getStorage(
                    storageSetterAddress,
                    "0x4242424242424242424242424242424242424242424242424242424242424242",
                ),
            ).to.be.eq("0x" + "".padEnd(64, "0"));
        });

        it("should emit event for failed delegatecall execution  if safeTxGas > 0", async () => {
            const { safe, reverter, signers } = await setupTests();
            const [user1] = signers;
            const safeAddress = await safe.getAddress();
            const txHash = calculateSafeTransactionHash(
                safeAddress,
                await buildContractCall(reverter, "revert", [], await safe.nonce(), true, { safeTxGas: 1 }),
                await chainId(),
            );
            await expect(executeContractCallWithSigners(safe, reverter, "revert", [], [user1], true, { safeTxGas: 1 }))
                .to.emit(safe, "ExecutionFailure")
                .withArgs(txHash, 0);
        });

        it("should emit event for failed delegatecall execution if gasPrice > 0", async () => {
            const { safe, reverter, signers } = await setupTests();
            const [user1] = signers;
            const safeAddress = await safe.getAddress();
            await user1.sendTransaction({ to: safeAddress, value: 10000000 });
            await expect(executeContractCallWithSigners(safe, reverter, "revert", [], [user1], true, { gasPrice: 1 })).to.emit(
                safe,
                "ExecutionFailure",
            );
        });

        it("should emit event for failed delegatecall execution if gasPrice == 0 and safeTxGas == 0", async () => {
            const { safe, reverter, signers } = await setupTests();
            const [user1] = signers;
            await expect(executeContractCallWithSigners(safe, reverter, "revert", [], [user1], true)).to.revertedWith("Shit happens");
        });

        it("should revert on unknown operation", async () => {
            const { safe, signers } = await setupTests();
            const [user1] = signers;
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce(), operation: 2 });
            await expect(executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)])).to.be.reverted;
        });

        it("should emit payment in success event", async () => {
            const { safe, signers } = await setupTests();
            const [user1, user2] = signers;
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({
                to: user1.address,
                nonce: await safe.nonce(),
                operation: 0,
                gasPrice: 1,
                safeTxGas: 100000,
                refundReceiver: user2.address,
            });

            await user1.sendTransaction({ to: safeAddress, value: hre.ethers.parseEther("1") });
            const userBalance = await hre.ethers.provider.getBalance(user2.address);
            expect(await hre.ethers.provider.getBalance(safeAddress)).to.be.eq(hre.ethers.parseEther("1"));

            const executedTx = await executeTx(safe.connect(user1), tx, [await safeApproveHash(user1, safe, tx, true)]);
            await expect(executedTx).to.emit(safe, "ExecutionSuccess");

            const receipt = await hre.ethers.provider.getTransactionReceipt(executedTx!.hash);
            const receiptLogs = receipt?.logs ?? [];
            // There are additional ETH transfer events on zkSync related to transaction fees
            const logIndex = receiptLogs.length - (hre.network.zksync ? 2 : 1);
            const successEvent = safe.interface.decodeEventLog(
                "ExecutionSuccess",
                receiptLogs[logIndex].data,
                receiptLogs[logIndex].topics,
            );
            expect(successEvent.txHash).to.be.eq(calculateSafeTransactionHash(safeAddress, tx, await chainId()));
            // Gas costs are around 3000, so even if we specified a safeTxGas from 100000 we should not use more
            expect(successEvent.payment).to.be.lte(5000n);
            expect(await hre.ethers.provider.getBalance(user2.address)).to.eq(userBalance + successEvent.payment);
        });

        it("should emit payment in failure event", async () => {
            const { safe, storageSetter, signers } = await setupTests();
            const [user1, user2] = signers;
            const safeAddress = await safe.getAddress();
            const storageSetterAddress = await storageSetter.getAddress();
            const data = storageSetter.interface.encodeFunctionData("setStorage", ["0xbaddad"]);
            const tx = buildSafeTransaction({
                to: storageSetterAddress,
                data,
                nonce: await safe.nonce(),
                operation: 0,
                gasPrice: 1,
                safeTxGas: 3000,
                refundReceiver: user2.address,
            });

            await user1.sendTransaction({ to: safeAddress, value: hre.ethers.parseEther("1") });
            const userBalance = await hre.ethers.provider.getBalance(user2.address);
            await expect(await hre.ethers.provider.getBalance(safeAddress)).to.eq(hre.ethers.parseEther("1"));

            const executedTx = await executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)]);
            await expect(executedTx).to.emit(safe, "ExecutionFailure");
            const receipt = await hre.ethers.provider.getTransactionReceipt(executedTx!.hash);
            const receiptLogs = receipt?.logs ?? [];
            // There are additional ETH transfer events on zkSync related to transaction fees
            const logIndex = receiptLogs.length - (hre.network.zksync ? 2 : 1);
            const successEvent = safe.interface.decodeEventLog(
                "ExecutionFailure",
                receiptLogs[logIndex].data,
                receiptLogs[logIndex].topics,
            );
            expect(successEvent.txHash).to.be.eq(calculateSafeTransactionHash(safeAddress, tx, await chainId()));
            // FIXME: When running out of gas the gas used is slightly higher than the safeTxGas and the user has to overpay
            expect(successEvent.payment).to.be.lte(10000n);
            await expect(await hre.ethers.provider.getBalance(user2.address)).to.eq(userBalance + successEvent.payment);
        });

        it("should be possible to manually increase gas", async () => {
            if (hre.network.zksync) {
                // This test fails in zksync because of (allegedly) enormous gas cost differences
                // a call to useGas(8) costs ~400k gas in evm but ~28m gas in zksync.
                // I suspect the gas cost difference to play a role but the zksync docs do not mention any numbers so i can't confirm this:
                // https://docs.zksync.io/zk-stack/concepts/fee-mechanism
                // From zkSync team:
                // Update: in-memory node when in standalone mode assumes very high l1 gas price resulting in a very high gas consumption,
                // We will update the default values and it should result in a similar gas usage as in other networks then. I’ll let you know once it is done.
                // TODO: update the node plugin when a new version is released
                return;
            }

            const { safe, signers } = await setupTests();
            const [user1] = signers;
            const safeAddress = await safe.getAddress();
            const gasUserSource = `
            contract GasUser {
        
                uint256[] public data;
        
                constructor() payable {}
        
                function nested(uint256 level, uint256 count) external {
                    if (level == 0) {
                        for (uint256 i = 0; i < count; i++) {
                            data.push(i);
                        }
                        return;
                    }
                    this.nested(level - 1, count);
                }
        
                function useGas(uint256 count) public {
                    this.nested(6, count);
                    this.nested(8, count);
                }
            }`;
            const gasUser = await deployContractFromSource(user1, gasUserSource);
            const to = await gasUser.getAddress();
            const data = gasUser.interface.encodeFunctionData("useGas", [80]);
            const safeTxGas = 10000;
            const tx = buildSafeTransaction({ to, data, safeTxGas, nonce: await safe.nonce() });
            await expect(
                executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)], { gasLimit: 170000 }),
                "Safe transaction should fail with low gasLimit",
            ).to.emit(safe, "ExecutionFailure");

            await expect(
                executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)], { gasLimit: 6000000 }),
                "Safe transaction should succeed with high gasLimit",
            ).to.emit(safe, "ExecutionSuccess");

            // This should only work if the gasPrice is 0
            tx.gasPrice = 1;
            await user1.sendTransaction({ to: safeAddress, value: hre.ethers.parseEther("1") });
            await expect(
                executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)], { gasLimit: 6000000 }),
                "Safe transaction should fail with gasPrice 1 and high gasLimit",
            ).to.emit(safe, "ExecutionFailure");
        });

        it("should forward all the gas to the native token refund receiver", async () => {
            if (hre.network.zksync) {
                // This test fails in zksync because of (allegedly) enormous gas cost differences
                // a call to useGas(8) costs ~400k gas in evm but ~28m gas in zksync.
                // I suspect the gas cost difference to play a role but the zksync docs do not mention any numbers so i can't confirm this:
                // https://docs.zksync.io/zk-stack/concepts/fee-mechanism
                // From zkSync team:
                // Update: in-memory node when in standalone mode assumes very high l1 gas price resulting in a very high gas consumption,
                // We will update the default values and it should result in a similar gas usage as in other networks then. I’ll let you know once it is done.
                // TODO: update the node plugin when a new version is released
                return;
            }

            const { safe, nativeTokenReceiver, signers } = await setupTests();
            const [user1] = signers;
            const safeAddress = await safe.getAddress();
            const nativeTokenReceiverAddress = await nativeTokenReceiver.getAddress();

            const tx = buildSafeTransaction({
                to: user1.address,
                nonce: await safe.nonce(),
                operation: 0,
                gasPrice: 1,
                safeTxGas: 0,
                refundReceiver: nativeTokenReceiverAddress,
            });

            await user1.sendTransaction({ to: safeAddress, value: hre.ethers.parseEther("1") });
            await expect(await hre.ethers.provider.getBalance(safeAddress)).to.eq(hre.ethers.parseEther("1"));

            // await expect(await executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)], { gasLimit: 5500000 })).to.emit(
            //     nativeTokenReceiver,
            //     "BreadReceived",
            // );

            const executedTx = await executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)], { gasLimit: 5500000 });
            const receipt = await hre.ethers.provider.getTransactionReceipt(executedTx.hash);
            console.log("gas used:", receipt?.gasUsed.toString());
            const receiptLogs = receipt?.logs ?? [];
            const parsedLogs = [];
            for (const log of receiptLogs) {
                try {
                    parsedLogs.push(nativeTokenReceiver.interface.decodeEventLog("BreadReceived", log.data, log.topics));
                } catch {
                    continue;
                }
            }

            expect(parsedLogs[0].forwardedGas).to.be.gte(hre.network.zksync ? 340000n : 400000n);
        });
    });
});
