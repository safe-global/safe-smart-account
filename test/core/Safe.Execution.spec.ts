import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { deployContract, getSafeWithOwners } from "../utils/setup";
import {
    safeApproveHash,
    buildSignatureBytes,
    executeContractCallWithSigners,
    buildSafeTransaction,
    executeTx,
    calculateSafeTransactionHash,
    buildContractCall,
} from "../../src/utils/execution";
import { parseEther } from "@ethersproject/units";
import { chainId } from "../utils/encoding";

describe("Safe", async () => {
    const [user1, user2] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const setterSource = `
            contract StorageSetter {
                function setStorage(bytes3 data) public {
                    bytes32 slot = 0x4242424242424242424242424242424242424242424242424242424242424242;
                    // solhint-disable-next-line no-inline-assembly
                    assembly {
                        sstore(slot, data)
                    }
                }
            }`;
        const storageSetter = await deployContract(user1, setterSource);
        const reverterSource = `
            contract Reverter {
                function revert() public {
                    require(false, "Shit happens");
                }
            }`;
        const reverter = await deployContract(user1, reverterSource);
        return {
            safe: await getSafeWithOwners([user1.address]),
            reverter,
            storageSetter,
        };
    });

    describe("execTransaction", async () => {
        it("should revert if too little gas is provided", async () => {
            const { safe } = await setupTests();
            const tx = buildSafeTransaction({ to: safe.address, safeTxGas: 1000000, nonce: await safe.nonce() });
            const signatureBytes = buildSignatureBytes([await safeApproveHash(user1, safe, tx, true)]);
            await expect(
                safe.execTransaction(
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
                ),
            ).to.be.revertedWith("GS010");
        });

        it("should emit event for successful call execution", async () => {
            const { safe, storageSetter } = await setupTests();
            const txHash = calculateSafeTransactionHash(
                safe,
                buildContractCall(storageSetter, "setStorage", ["0xbaddad"], await safe.nonce()),
                await chainId(),
            );
            await expect(executeContractCallWithSigners(safe, storageSetter, "setStorage", ["0xbaddad"], [user1]))
                .to.emit(safe, "ExecutionSuccess")
                .withArgs(txHash, 0);

            await expect(
                await hre.ethers.provider.getStorageAt(safe.address, "0x4242424242424242424242424242424242424242424242424242424242424242"),
            ).to.be.eq("0x" + "".padEnd(64, "0"));

            await expect(
                await hre.ethers.provider.getStorageAt(
                    storageSetter.address,
                    "0x4242424242424242424242424242424242424242424242424242424242424242",
                ),
            ).to.be.eq("0x" + "baddad".padEnd(64, "0"));
        });

        it("should emit event for failed call execution if safeTxGas > 0", async () => {
            const { safe, reverter } = await setupTests();
            await expect(executeContractCallWithSigners(safe, reverter, "revert", [], [user1], false, { safeTxGas: 1 })).to.emit(
                safe,
                "ExecutionFailure",
            );
        });

        it("should emit event for failed call execution if gasPrice > 0", async () => {
            const { safe, reverter } = await setupTests();
            // Fund refund
            await user1.sendTransaction({ to: safe.address, value: 10000000 });
            await expect(executeContractCallWithSigners(safe, reverter, "revert", [], [user1], false, { gasPrice: 1 })).to.emit(
                safe,
                "ExecutionFailure",
            );
        });

        it("should revert for failed call execution if gasPrice == 0 and safeTxGas == 0", async () => {
            const { safe, reverter } = await setupTests();
            await expect(executeContractCallWithSigners(safe, reverter, "revert", [], [user1])).to.revertedWith("GS013");
        });

        it("should emit event for successful delegatecall execution", async () => {
            const { safe, storageSetter } = await setupTests();
            await expect(executeContractCallWithSigners(safe, storageSetter, "setStorage", ["0xbaddad"], [user1], true)).to.emit(
                safe,
                "ExecutionSuccess",
            );

            await expect(
                await hre.ethers.provider.getStorageAt(safe.address, "0x4242424242424242424242424242424242424242424242424242424242424242"),
            ).to.be.eq("0x" + "baddad".padEnd(64, "0"));

            await expect(
                await hre.ethers.provider.getStorageAt(
                    storageSetter.address,
                    "0x4242424242424242424242424242424242424242424242424242424242424242",
                ),
            ).to.be.eq("0x" + "".padEnd(64, "0"));
        });

        it("should emit event for failed delegatecall execution  if safeTxGas > 0", async () => {
            const { safe, reverter } = await setupTests();
            const txHash = calculateSafeTransactionHash(
                safe,
                buildContractCall(reverter, "revert", [], await safe.nonce(), true, { safeTxGas: 1 }),
                await chainId(),
            );
            await expect(executeContractCallWithSigners(safe, reverter, "revert", [], [user1], true, { safeTxGas: 1 }))
                .to.emit(safe, "ExecutionFailure")
                .withArgs(txHash, 0);
        });

        it("should emit event for failed delegatecall execution if gasPrice > 0", async () => {
            const { safe, reverter } = await setupTests();
            await user1.sendTransaction({ to: safe.address, value: 10000000 });
            await expect(executeContractCallWithSigners(safe, reverter, "revert", [], [user1], true, { gasPrice: 1 })).to.emit(
                safe,
                "ExecutionFailure",
            );
        });

        it("should emit event for failed delegatecall execution if gasPrice == 0 and safeTxGas == 0", async () => {
            const { safe, reverter } = await setupTests();
            await expect(executeContractCallWithSigners(safe, reverter, "revert", [], [user1], true)).to.revertedWith("GS013");
        });

        it("should revert on unknown operation", async () => {
            const { safe } = await setupTests();
            const tx = buildSafeTransaction({ to: safe.address, nonce: await safe.nonce(), operation: 2 });
            await expect(executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)])).to.be.reverted;
        });

        it("should emit payment in success event", async () => {
            const { safe } = await setupTests();
            const tx = buildSafeTransaction({
                to: user1.address,
                nonce: await safe.nonce(),
                operation: 0,
                gasPrice: 1,
                safeTxGas: 100000,
                refundReceiver: user2.address,
            });

            await user1.sendTransaction({ to: safe.address, value: parseEther("1") });
            const userBalance = await hre.ethers.provider.getBalance(user2.address);
            await expect(await hre.ethers.provider.getBalance(safe.address)).to.be.deep.eq(parseEther("1"));

            let executedTx: any;
            await expect(
                executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)]).then((tx) => {
                    executedTx = tx;
                    return tx;
                }),
            ).to.emit(safe, "ExecutionSuccess");
            const receipt = await hre.ethers.provider.getTransactionReceipt(executedTx!.hash);
            const logIndex = receipt.logs.length - 1;
            const successEvent = safe.interface.decodeEventLog(
                "ExecutionSuccess",
                receipt.logs[logIndex].data,
                receipt.logs[logIndex].topics,
            );
            expect(successEvent.txHash).to.be.eq(calculateSafeTransactionHash(safe, tx, await chainId()));
            // Gas costs are around 3000, so even if we specified a safeTxGas from 100000 we should not use more
            expect(successEvent.payment.toNumber()).to.be.lte(5000);
            await expect(await hre.ethers.provider.getBalance(user2.address)).to.be.deep.eq(userBalance.add(successEvent.payment));
        });

        it("should emit payment in failure event", async () => {
            const { safe, storageSetter } = await setupTests();
            const data = storageSetter.interface.encodeFunctionData("setStorage", [0xbaddad]);
            const tx = buildSafeTransaction({
                to: storageSetter.address,
                data,
                nonce: await safe.nonce(),
                operation: 0,
                gasPrice: 1,
                safeTxGas: 3000,
                refundReceiver: user2.address,
            });

            await user1.sendTransaction({ to: safe.address, value: parseEther("1") });
            const userBalance = await hre.ethers.provider.getBalance(user2.address);
            await expect(await hre.ethers.provider.getBalance(safe.address)).to.be.deep.eq(parseEther("1"));

            let executedTx: any;
            await expect(
                executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)]).then((tx) => {
                    executedTx = tx;
                    return tx;
                }),
            ).to.emit(safe, "ExecutionFailure");
            const receipt = await hre.ethers.provider.getTransactionReceipt(executedTx!.hash);
            const logIndex = receipt.logs.length - 1;
            const successEvent = safe.interface.decodeEventLog(
                "ExecutionFailure",
                receipt.logs[logIndex].data,
                receipt.logs[logIndex].topics,
            );
            expect(successEvent.txHash).to.be.eq(calculateSafeTransactionHash(safe, tx, await chainId()));
            // FIXME: When running out of gas the gas used is slightly higher than the safeTxGas and the user has to overpay
            expect(successEvent.payment.toNumber()).to.be.lte(10000);
            await expect(await hre.ethers.provider.getBalance(user2.address)).to.be.deep.eq(userBalance.add(successEvent.payment));
        });

        it("should be possible to manually increase gas", async () => {
            const { safe } = await setupTests();
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
            const gasUser = await deployContract(user1, gasUserSource);
            const to = gasUser.address;
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
            await user1.sendTransaction({ to: safe.address, value: parseEther("1") });
            await expect(
                executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)], { gasLimit: 6000000 }),
                "Safe transaction should fail with gasPrice 1 and high gasLimit",
            ).to.emit(safe, "ExecutionFailure");
        });
    });
});
