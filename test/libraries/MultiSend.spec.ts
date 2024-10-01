import { expect } from "chai";
import hre, { deployments } from "hardhat";
import { deployContractFromSource, getMock, getMultiSend, getSafe } from "../utils/setup";
import { buildContractCall, buildSafeTransaction, executeTx, MetaTransaction, safeApproveHash } from "../../src/utils/execution";
import { buildMultiSendSafeTx, encodeMultiSend } from "../../src/utils/multisend";

describe("MultiSend", async () => {
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
        const [user1, user2] = await hre.ethers.getSigners();
        const storageSetter = await deployContractFromSource(user1, setterSource);
        return {
            safe: await getSafe({ owners: [user1.address] }),
            multiSend: await getMultiSend(),
            mock: await getMock(),
            storageSetter,
            user1,
            user2,
        };
    });

    describe("multiSend", async () => {
        it("should enforce delegatecall to MultiSend", async () => {
            if (hre.network.zksync) {
                // selfdestruct opcode doesn't work on zksync, so we skip the test
                return;
            }

            const { multiSend, user1 } = await setupTests();
            const multiSendAddress = await multiSend.getAddress();
            const source = `
            contract Test {
                function killme() public {
                    selfdestruct(payable(msg.sender));
                }
            }`;
            const killLib = await deployContractFromSource(user1, source);

            const nestedTransactionData = encodeMultiSend([await buildContractCall(killLib, "killme", [], 0)]);

            const multiSendCode = await hre.ethers.provider.getCode(multiSendAddress);
            await expect(multiSend.multiSend(nestedTransactionData)).to.be.revertedWith("MultiSend should only be called via delegatecall");

            expect(await hre.ethers.provider.getCode(multiSendAddress)).to.be.eq(multiSendCode);
        });

        it("Should fail when using invalid operation", async () => {
            const { safe, multiSend, user1, user2 } = await setupTests();

            const txs = [buildSafeTransaction({ to: user2.address, operation: 2, nonce: 0 })];
            const safeTx = await buildMultiSendSafeTx(multiSend, txs, await safe.nonce());
            await expect(executeTx(safe, safeTx, [await safeApproveHash(user1, safe, safeTx, true)])).to.revertedWith("GS013");
        });

        it("Can execute empty multisend", async () => {
            const { safe, multiSend, user1 } = await setupTests();

            const txs: MetaTransaction[] = [];
            const safeTx = await buildMultiSendSafeTx(multiSend, txs, await safe.nonce());
            await expect(executeTx(safe, safeTx, [await safeApproveHash(user1, safe, safeTx, true)])).to.emit(safe, "ExecutionSuccess");
        });

        it("Can execute single ether transfer", async () => {
            const { safe, multiSend, user1, user2 } = await setupTests();
            const safeAddress = await safe.getAddress();
            await user1.sendTransaction({ to: safeAddress, value: hre.ethers.parseEther("1") });
            const userBalance = await hre.ethers.provider.getBalance(user2.address);
            await expect(await hre.ethers.provider.getBalance(safeAddress)).to.be.deep.eq(hre.ethers.parseEther("1"));

            const txs: MetaTransaction[] = [buildSafeTransaction({ to: user2.address, value: hre.ethers.parseEther("1"), nonce: 0 })];
            const safeTx = await buildMultiSendSafeTx(multiSend, txs, await safe.nonce());
            await expect(executeTx(safe, safeTx, [await safeApproveHash(user1, safe, safeTx, true)])).to.emit(safe, "ExecutionSuccess");

            await expect(await hre.ethers.provider.getBalance(safeAddress)).to.be.deep.eq(hre.ethers.parseEther("0"));
            await expect(await hre.ethers.provider.getBalance(user2.address)).to.be.deep.eq(userBalance + hre.ethers.parseEther("1"));
        });

        it("reverts all tx if any fails", async () => {
            const { safe, multiSend, user1, user2 } = await setupTests();
            const safeAddress = await safe.getAddress();
            await user1.sendTransaction({ to: safeAddress, value: hre.ethers.parseEther("1") });
            const userBalance = await hre.ethers.provider.getBalance(user2.address);
            await expect(await hre.ethers.provider.getBalance(safeAddress)).to.be.deep.eq(hre.ethers.parseEther("1"));

            const txs: MetaTransaction[] = [
                buildSafeTransaction({ to: user2.address, value: hre.ethers.parseEther("1"), nonce: 0 }),
                buildSafeTransaction({ to: user2.address, value: hre.ethers.parseEther("1"), nonce: 0 }),
            ];
            const safeTx = await buildMultiSendSafeTx(multiSend, txs, await safe.nonce(), { safeTxGas: 1 });
            await expect(executeTx(safe, safeTx, [await safeApproveHash(user1, safe, safeTx, true)])).to.emit(safe, "ExecutionFailure");

            await expect(await hre.ethers.provider.getBalance(safeAddress)).to.be.deep.eq(hre.ethers.parseEther("1"));
            await expect(await hre.ethers.provider.getBalance(user2.address)).to.be.deep.eq(userBalance);
        });

        it("can be used when ETH is sent with execution", async () => {
            const { safe, multiSend, storageSetter, user1 } = await setupTests();
            const safeAddress = await safe.getAddress();

            const txs: MetaTransaction[] = [await buildContractCall(storageSetter, "setStorage", ["0xbaddad"], 0)];
            const safeTx = await buildMultiSendSafeTx(multiSend, txs, await safe.nonce());

            await expect(await hre.ethers.provider.getBalance(safeAddress)).to.be.deep.eq(hre.ethers.parseEther("0"));

            await expect(
                executeTx(safe, safeTx, [await safeApproveHash(user1, safe, safeTx, true)], { value: hre.ethers.parseEther("1") }),
            ).to.emit(safe, "ExecutionSuccess");

            await expect(await hre.ethers.provider.getBalance(safeAddress)).to.be.deep.eq(hre.ethers.parseEther("1"));
        });

        it("can execute contract calls", async () => {
            const { safe, multiSend, storageSetter, user1 } = await setupTests();
            const safeAddress = await safe.getAddress();
            const storageSetterAddress = await storageSetter.getAddress();
            const txs: MetaTransaction[] = [await buildContractCall(storageSetter, "setStorage", ["0xbaddad"], 0)];
            const safeTx = await buildMultiSendSafeTx(multiSend, txs, await safe.nonce());
            await expect(executeTx(safe, safeTx, [await safeApproveHash(user1, safe, safeTx, true)])).to.emit(safe, "ExecutionSuccess");

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

        it("can execute contract delegatecalls", async () => {
            const { safe, multiSend, storageSetter, user1 } = await setupTests();
            const safeAddress = await safe.getAddress();
            const storageSetterAddress = await storageSetter.getAddress();

            const txs: MetaTransaction[] = [await buildContractCall(storageSetter, "setStorage", ["0xbaddad"], 0, true)];
            const safeTx = await buildMultiSendSafeTx(multiSend, txs, await safe.nonce());
            await expect(executeTx(safe, safeTx, [await safeApproveHash(user1, safe, safeTx, true)])).to.emit(safe, "ExecutionSuccess");

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

        it("can execute all calls in combination", async () => {
            const { safe, multiSend, storageSetter, user1, user2 } = await setupTests();
            const safeAddress = await safe.getAddress();
            const storageSetterAddress = await storageSetter.getAddress();
            await user1.sendTransaction({ to: safeAddress, value: hre.ethers.parseEther("1") });
            const userBalance = await hre.ethers.provider.getBalance(user2.address);
            await expect(await hre.ethers.provider.getBalance(safeAddress)).to.be.deep.eq(hre.ethers.parseEther("1"));

            const txs: MetaTransaction[] = [
                buildSafeTransaction({ to: user2.address, value: hre.ethers.parseEther("1"), nonce: 0 }),
                await buildContractCall(storageSetter, "setStorage", ["0xbaddad"], 0, true),
                await buildContractCall(storageSetter, "setStorage", ["0xbaddad"], 0),
            ];
            const safeTx = await buildMultiSendSafeTx(multiSend, txs, await safe.nonce());
            await expect(executeTx(safe, safeTx, [await safeApproveHash(user1, safe, safeTx, true)])).to.emit(safe, "ExecutionSuccess");

            await expect(await hre.ethers.provider.getBalance(safeAddress)).to.be.deep.eq(hre.ethers.parseEther("0"));
            await expect(await hre.ethers.provider.getBalance(user2.address)).to.be.deep.eq(userBalance + hre.ethers.parseEther("1"));
            await expect(
                await hre.ethers.provider.getStorage(safeAddress, "0x4242424242424242424242424242424242424242424242424242424242424242"),
            ).to.be.eq("0x" + "baddad".padEnd(64, "0"));
            await expect(
                await hre.ethers.provider.getStorage(
                    storageSetterAddress,
                    "0x4242424242424242424242424242424242424242424242424242424242424242",
                ),
            ).to.be.eq("0x" + "baddad".padEnd(64, "0"));
        });
    });
});
