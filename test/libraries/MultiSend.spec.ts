import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { deployContractFromSource, getMock, getMultiSend, getSafe, getDelegateCaller } from "../utils/setup";
import {
    buildContractCall,
    buildSafeTransaction,
    executeTx,
    executeTxWithSigners,
    MetaTransaction,
    safeApproveHash,
} from "../../src/utils/execution";
import { buildMultiSendSafeTx, encodeMultiSend } from "../../src/utils/multisend";

describe("MultiSend", () => {
    const setupTests = hre.deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
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
        const signers = await hre.ethers.getSigners();
        const [user1] = signers;
        const storageSetter = await deployContractFromSource(user1, setterSource);
        return {
            safe: await getSafe({ owners: [user1.address] }),
            multiSend: await getMultiSend(),
            mock: await getMock(),
            delegateCaller: await getDelegateCaller(),
            storageSetter,
            signers,
        };
    });

    describe("multiSend", () => {
        it("should enforce delegatecall to MultiSend", async function () {
            /**
             * ## Test not applicable for zkSync, therefore should skip.
             * The `SELFDESTRUCT` instruction is not supported
             * @see https://docs.zksync.io/zksync-protocol/differences/evm-instructions#selfdestruct
             */
            if (hre.network.zksync) this.skip();

            const {
                multiSend,
                signers: [user1],
            } = await setupTests();
            const source = `
            contract Test {
                function killme() public {
                    selfdestruct(payable(msg.sender));
                }
            }`;
            const killLib = await deployContractFromSource(user1, source);

            const nestedTransactionData = encodeMultiSend([await buildContractCall(killLib, "killme", [], 0)]);

            const multiSendAddress = await multiSend.getAddress();
            const multiSendCode = await hre.ethers.provider.getCode(multiSendAddress);
            await expect(multiSend.multiSend(nestedTransactionData)).to.be.revertedWith("MultiSend should only be called via delegatecall");

            expect(await hre.ethers.provider.getCode(multiSendAddress)).to.be.eq(multiSendCode);
        });

        it("Should fail when using invalid operation", async () => {
            const {
                safe,
                multiSend,
                signers: [user1, user2],
            } = await setupTests();

            const txs = [buildSafeTransaction({ to: user2.address, operation: 2, nonce: 0 })];
            const safeTx = await buildMultiSendSafeTx(multiSend, txs, await safe.nonce());
            await expect(
                executeTx(safe.connect(user1), safeTx, [await safeApproveHash(user1, safe, safeTx, true)]),
            ).to.revertedWithoutReason();
        });

        it("Can execute empty multisend", async () => {
            const {
                safe,
                multiSend,
                signers: [user1],
            } = await setupTests();

            const txs: MetaTransaction[] = [];
            const safeTx = await buildMultiSendSafeTx(multiSend, txs, await safe.nonce());
            await expect(executeTx(safe.connect(user1), safeTx, [await safeApproveHash(user1, safe, safeTx, true)])).to.emit(
                safe,
                "ExecutionSuccess",
            );
        });

        it("Can execute single ether transfer", async () => {
            const {
                safe,
                multiSend,
                signers: [user1, user2],
            } = await setupTests();
            await user1.sendTransaction({ to: await safe.getAddress(), value: ethers.parseEther("1") });
            const userBalance = await hre.ethers.provider.getBalance(user2.address);
            await expect(await hre.ethers.provider.getBalance(await safe.getAddress())).to.eq(ethers.parseEther("1"));

            const txs: MetaTransaction[] = [buildSafeTransaction({ to: user2.address, value: ethers.parseEther("1"), nonce: 0 })];
            const safeTx = await buildMultiSendSafeTx(multiSend, txs, await safe.nonce());
            await expect(executeTx(safe.connect(user1), safeTx, [await safeApproveHash(user1, safe, safeTx, true)])).to.emit(
                safe,
                "ExecutionSuccess",
            );

            await expect(await hre.ethers.provider.getBalance(await safe.getAddress())).to.eq(ethers.parseEther("0"));
            await expect(await hre.ethers.provider.getBalance(user2.address)).to.eq(userBalance + ethers.parseEther("1"));
        });

        it("reverts all tx if any fails", async () => {
            const {
                safe,
                multiSend,
                signers: [user1, user2],
            } = await setupTests();
            await user1.sendTransaction({ to: await safe.getAddress(), value: ethers.parseEther("1") });
            const userBalance = await hre.ethers.provider.getBalance(user2.address);
            await expect(await hre.ethers.provider.getBalance(await safe.getAddress())).to.eq(ethers.parseEther("1"));

            const txs: MetaTransaction[] = [
                buildSafeTransaction({ to: user2.address, value: ethers.parseEther("1"), nonce: 0 }),
                buildSafeTransaction({ to: user2.address, value: ethers.parseEther("1"), nonce: 0 }),
            ];
            const safeTx = await buildMultiSendSafeTx(multiSend, txs, await safe.nonce(), { safeTxGas: 1 });
            await expect(executeTx(safe.connect(user1), safeTx, [await safeApproveHash(user1, safe, safeTx, true)])).to.emit(
                safe,
                "ExecutionFailure",
            );

            await expect(await hre.ethers.provider.getBalance(await safe.getAddress())).to.eq(ethers.parseEther("1"));
            await expect(await hre.ethers.provider.getBalance(user2.address)).to.eq(userBalance);
        });

        it("can be used when ETH is sent with execution", async () => {
            const {
                safe,
                multiSend,
                storageSetter,
                signers: [user1],
            } = await setupTests();

            const txs: MetaTransaction[] = [await buildContractCall(storageSetter, "setStorage", ["0xbaddad"], 0)];
            const safeTx = await buildMultiSendSafeTx(multiSend, txs, await safe.nonce());

            await expect(await hre.ethers.provider.getBalance(await safe.getAddress())).to.eq(ethers.parseEther("0"));

            await expect(
                executeTx(safe.connect(user1), safeTx, [await safeApproveHash(user1, safe, safeTx, true)], {
                    value: ethers.parseEther("1"),
                }),
            ).to.emit(safe, "ExecutionSuccess");

            await expect(await hre.ethers.provider.getBalance(await safe.getAddress())).to.eq(ethers.parseEther("1"));
        });

        it("can execute contract calls", async () => {
            const {
                safe,
                multiSend,
                storageSetter,
                signers: [user1],
            } = await setupTests();
            const storageSetterAddress = await storageSetter.getAddress();

            const txs: MetaTransaction[] = [await buildContractCall(storageSetter, "setStorage", ["0xbaddad"], 0)];
            const safeTx = await buildMultiSendSafeTx(multiSend, txs, await safe.nonce());
            await expect(executeTx(safe.connect(user1), safeTx, [await safeApproveHash(user1, safe, safeTx, true)])).to.emit(
                safe,
                "ExecutionSuccess",
            );

            await expect(
                await hre.ethers.provider.getStorage(
                    await safe.getAddress(),
                    "0x4242424242424242424242424242424242424242424242424242424242424242",
                ),
            ).to.be.eq("0x" + "".padEnd(64, "0"));
            await expect(
                await hre.ethers.provider.getStorage(
                    storageSetterAddress,
                    "0x4242424242424242424242424242424242424242424242424242424242424242",
                ),
            ).to.be.eq("0x" + "baddad".padEnd(64, "0"));
        });

        it("can execute contract delegatecalls", async () => {
            const {
                safe,
                multiSend,
                storageSetter,
                signers: [user1],
            } = await setupTests();
            const storageSetterAddress = await storageSetter.getAddress();

            const txs: MetaTransaction[] = [await buildContractCall(storageSetter, "setStorage", ["0xbaddad"], 0, true)];
            const safeTx = await buildMultiSendSafeTx(multiSend, txs, await safe.nonce());
            await expect(executeTx(safe.connect(user1), safeTx, [await safeApproveHash(user1, safe, safeTx, true)])).to.emit(
                safe,
                "ExecutionSuccess",
            );

            await expect(
                await hre.ethers.provider.getStorage(
                    await safe.getAddress(),
                    "0x4242424242424242424242424242424242424242424242424242424242424242",
                ),
            ).to.be.eq("0x" + "baddad".padEnd(64, "0"));
            await expect(
                await hre.ethers.provider.getStorage(
                    storageSetterAddress,
                    "0x4242424242424242424242424242424242424242424242424242424242424242",
                ),
            ).to.be.eq("0x" + "".padEnd(64, "0"));
        });

        it("can execute all calls in combination", async () => {
            const {
                safe,
                multiSend,
                storageSetter,
                signers: [user1, user2],
            } = await setupTests();
            const storageSetterAddress = await storageSetter.getAddress();

            await user1.sendTransaction({ to: await safe.getAddress(), value: ethers.parseEther("1") });
            const userBalance = await hre.ethers.provider.getBalance(user2.address);
            await expect(await hre.ethers.provider.getBalance(await safe.getAddress())).to.eq(ethers.parseEther("1"));

            const txs: MetaTransaction[] = [
                buildSafeTransaction({ to: user2.address, value: ethers.parseEther("1"), nonce: 0 }),
                await buildContractCall(storageSetter, "setStorage", ["0xbaddad"], 0, true),
                await buildContractCall(storageSetter, "setStorage", ["0xbaddad"], 0),
            ];
            const safeTx = await buildMultiSendSafeTx(multiSend, txs, await safe.nonce());
            await expect(executeTx(safe.connect(user1), safeTx, [await safeApproveHash(user1, safe, safeTx, true)])).to.emit(
                safe,
                "ExecutionSuccess",
            );

            await expect(await hre.ethers.provider.getBalance(await safe.getAddress())).to.eq(ethers.parseEther("0"));
            await expect(await hre.ethers.provider.getBalance(user2.address)).to.eq(userBalance + ethers.parseEther("1"));
            await expect(
                await hre.ethers.provider.getStorage(
                    await safe.getAddress(),
                    "0x4242424242424242424242424242424242424242424242424242424242424242",
                ),
            ).to.be.eq("0x" + "baddad".padEnd(64, "0"));
            await expect(
                await hre.ethers.provider.getStorage(
                    storageSetterAddress,
                    "0x4242424242424242424242424242424242424242424242424242424242424242",
                ),
            ).to.be.eq("0x" + "baddad".padEnd(64, "0"));
        });

        it("can bubble up revert message on call", async () => {
            const { delegateCaller, multiSend, mock } = await setupTests();
            const mockAddress = await mock.getAddress();
            const multiSendAddress = await multiSend.getAddress();

            const triggerCalldata = "0xbaddad";
            const errorMessage = "Some random message";

            await mock.givenCalldataRevertWithMessage(triggerCalldata, errorMessage);

            const txs: MetaTransaction[] = [
                {
                    to: mockAddress,
                    value: 0,
                    data: triggerCalldata,
                    operation: 0,
                },
            ];
            const { data } = await buildMultiSendSafeTx(multiSend, txs, 0);

            await expect(delegateCaller.makeDelegatecall(multiSendAddress, data)).to.be.revertedWith(errorMessage);
        });

        it("can bubble up revert message on delegatecall", async () => {
            const { delegateCaller, multiSend, mock } = await setupTests();
            const mockAddress = await mock.getAddress();
            const multiSendAddress = await multiSend.getAddress();

            const triggerCalldata = "0xbaddad";
            const errorMessage = "Some random message";

            const setRevertMessageData = mock.interface.encodeFunctionData("givenCalldataRevertWithMessage", [
                triggerCalldata,
                errorMessage,
            ]);

            const txs: MetaTransaction[] = [
                {
                    to: mockAddress,
                    value: 0,
                    data: setRevertMessageData as string,
                    operation: 1,
                },
                {
                    to: mockAddress,
                    value: 0,
                    data: triggerCalldata,
                    operation: 1,
                },
            ];
            const { data } = await buildMultiSendSafeTx(multiSend, txs, 0);

            await expect(delegateCaller.makeDelegatecall.staticCall(multiSendAddress, data)).to.be.revertedWith(errorMessage);
        });

        it("forwards the call to self when to is zero address", async () => {
            const {
                safe,
                multiSend,
                signers: [user1],
            } = await setupTests();
            const randomAddress1 = ethers.hexlify(ethers.randomBytes(20));
            const randomAddress2 = ethers.hexlify(ethers.randomBytes(20));

            await expect(await safe.isOwner(randomAddress1)).to.be.false;
            await expect(await safe.isOwner(randomAddress2)).to.be.false;

            const txs: MetaTransaction[] = [
                {
                    to: ethers.ZeroAddress,
                    value: 0,
                    data: safe.interface.encodeFunctionData("addOwnerWithThreshold", [randomAddress1, 1]),
                    operation: 0,
                },
                {
                    to: ethers.ZeroAddress,
                    value: 0,
                    data: safe.interface.encodeFunctionData("addOwnerWithThreshold", [randomAddress2, 1]),
                    operation: 0,
                },
            ];
            const safeTx = await buildMultiSendSafeTx(multiSend, txs, await safe.nonce());

            await executeTxWithSigners(safe, safeTx, [user1]);

            await expect(await safe.isOwner(randomAddress1)).to.be.true;
            await expect(await safe.isOwner(randomAddress2)).to.be.true;
        });
    });
});
