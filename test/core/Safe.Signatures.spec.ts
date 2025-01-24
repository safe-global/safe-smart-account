import { getCompatFallbackHandler } from "./../utils/setup";
import { calculateSafeMessageHash, signHash, buildContractSignature } from "./../../src/utils/execution";
import { expect } from "chai";
import hre from "hardhat";
import crypto from "crypto";
import { AddressZero } from "@ethersproject/constants";
import { getSafeTemplate, getSafe } from "../utils/setup";
import {
    safeSignTypedData,
    executeTx,
    safeSignMessage,
    calculateSafeTransactionHash,
    safeApproveHash,
    buildSafeTransaction,
    logGas,
    calculateSafeDomainSeparator,
    preimageSafeTransactionHash,
    buildSignatureBytes,
} from "../../src/utils/execution";
import { chainId } from "../utils/encoding";

describe("Safe", () => {
    const setupTests = hre.deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const compatFallbackHandler = await getCompatFallbackHandler();
        const signers = await hre.ethers.getSigners();
        const [user1] = signers;
        const safe = await getSafe({ owners: [user1.address] });

        return {
            safe: safe.connect(user1),
            compatFallbackHandler,
            signers,
        };
    });

    describe("domainSeparator", () => {
        it("should be correct according to EIP-712", async () => {
            const { safe } = await setupTests();
            const safeAddress = await safe.getAddress();
            const domainSeparator = calculateSafeDomainSeparator(safeAddress, await chainId());
            await expect(await safe.domainSeparator()).to.be.eq(domainSeparator);
        });
    });

    describe("getTransactionHash", () => {
        it("should correctly calculate EIP-712 hash", async () => {
            const { safe } = await setupTests();
            const safeAddress = await safe.getAddress();

            for (let i = 0; i < 100; i++) {
                const randomAddress = "0x" + crypto.randomBytes(20).toString("hex");
                const randomValue = "0x" + crypto.randomBytes(32).toString("hex");
                const randomData = "0x" + crypto.randomBytes(128).toString("hex");

                const tx = buildSafeTransaction({ to: randomAddress, nonce: await safe.nonce(), value: randomValue, data: randomData });
                const typedDataHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
                await expect(
                    await safe.getTransactionHash(
                        tx.to,
                        tx.value,
                        tx.data,
                        tx.operation,
                        tx.safeTxGas,
                        tx.baseGas,
                        tx.gasPrice,
                        tx.gasToken,
                        tx.refundReceiver,
                        tx.nonce,
                    ),
                ).to.be.eq(typedDataHash);
            }
        });
    });

    describe("approveHash", () => {
        it("approving should only be allowed for owners", async () => {
            const {
                safe,
                signers: [, user2],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            const signerSafe = safe.connect(user2);
            await expect(signerSafe.approveHash(txHash)).to.be.revertedWith("GS030");
        });

        it("approving should emit event", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            await expect(safe.approveHash(txHash)).emit(safe, "ApproveHash").withArgs(txHash, user1.address);
        });
    });

    describe("execTransaction", () => {
        it("should fail if signature points into static part", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const signatures =
                "0x" +
                "000000000000000000000000" +
                user1.address.slice(2) +
                "0000000000000000000000000000000000000000000000000000000000000020" +
                "00" + // r, s, v
                "0000000000000000000000000000000000000000000000000000000000000000"; // Some data to read
            await expect(safe.execTransaction(safeAddress, 0, "0x", 0, 0, 0, 0, AddressZero, AddressZero, signatures)).to.be.revertedWith(
                "GS021",
            );
        });

        it("should fail if signatures data is not present", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const signatures =
                "0x" +
                "000000000000000000000000" +
                user1.address.slice(2) +
                "0000000000000000000000000000000000000000000000000000000000000041" +
                "00"; // r, s, v

            await expect(safe.execTransaction(safeAddress, 0, "0x", 0, 0, 0, 0, AddressZero, AddressZero, signatures)).to.be.revertedWith(
                "GS022",
            );
        });

        it("should fail if signatures data is too short", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const signatures =
                "0x" +
                "000000000000000000000000" +
                user1.address.slice(2) +
                "0000000000000000000000000000000000000000000000000000000000000041" +
                "00" + // r, s, v
                "0000000000000000000000000000000000000000000000000000000000000020"; // length

            await expect(safe.execTransaction(safeAddress, 0, "0x", 0, 0, 0, 0, AddressZero, AddressZero, signatures)).to.be.revertedWith(
                "GS023",
            );
        });

        it("should be able to use EIP-712 for signature generation", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            await expect(
                logGas(
                    "Execute cancel transaction with EIP-712 signature",
                    executeTx(safe, tx, [await safeSignTypedData(user1, safeAddress, tx)]),
                ),
            ).to.emit(safe, "ExecutionSuccess");
        });

        it("should not be able to use different chainId for signing", async () => {
            const {
                signers: [user1],
            } = await setupTests();
            const safe = await getSafe({ owners: [user1.address] });
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            await expect(executeTx(safe, tx, [await safeSignTypedData(user1, safeAddress, tx, 1)])).to.be.revertedWith("GS026");
        });

        it("should be able to use Signed Ethereum Messages for signature generation", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            await expect(
                logGas(
                    "Execute cancel transaction with signed Ethereum message",
                    executeTx(safe, tx, [await safeSignMessage(user1, safeAddress, tx)]),
                ),
            ).to.emit(safe, "ExecutionSuccess");
        });

        it("msg.sender does not need to approve before", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            await expect(
                logGas(
                    "Without pre approved signature for msg.sender",
                    executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)]),
                ),
            ).to.emit(safe, "ExecutionSuccess");
        });

        it("if not msg.sender on-chain approval is required", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const user2Safe = safe.connect(user2);
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            await expect(executeTx(user2Safe, tx, [await safeApproveHash(user1, safe, tx, true)])).to.be.revertedWith("GS025");
        });

        it("should be able to use pre approved hashes for signature generation", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const user2Safe = safe.connect(user2);
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            const approveHashSig = await safeApproveHash(user1, safe, tx);
            expect(await safe.approvedHashes(user1.address, txHash)).to.be.eq(1);
            await expect(logGas("With pre approved signature", executeTx(user2Safe, tx, [approveHashSig]))).to.emit(
                safe,
                "ExecutionSuccess",
            );
            // Approved hash should not reset automatically
            expect(await safe.approvedHashes(user1.address, txHash)).to.be.eq(1);
        });

        it("should revert if threshold is not set", async () => {
            await setupTests();
            const safe = await getSafeTemplate();
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            await expect(executeTx(safe, tx, [])).to.be.revertedWith("GS001");
        });

        it("should revert if not the required amount of signature data is provided", async () => {
            const {
                signers: [user1, user2, user3],
            } = await setupTests();
            const safe = await getSafe({ owners: [user1.address, user2.address, user3.address] });
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            await expect(executeTx(safe, tx, [])).to.be.revertedWith("GS020");
        });

        it("should not be able to use different signature type of same owner", async () => {
            const {
                signers: [user1, user2, user3],
            } = await setupTests();
            const safe = await getSafe({ owners: [user1.address, user2.address, user3.address] });
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            await expect(
                executeTx(safe, tx, [
                    await safeApproveHash(user1, safe, tx),
                    await safeSignTypedData(user1, safeAddress, tx),
                    await safeSignTypedData(user3, safeAddress, tx),
                ]),
            ).to.be.revertedWith("GS026");
        });

        it("should be able to mix all signature types", async () => {
            const {
                signers: [user1, user2, user3, user4, user5],
            } = await setupTests();
            const compatFallbackHandler = await getCompatFallbackHandler();
            const compatFallbackHandlerAddress = await compatFallbackHandler.getAddress();
            const signerSafe = await getSafe({
                owners: [user5.address],
                threshold: 1,
                fallbackHandler: compatFallbackHandlerAddress,
            });
            const signerSafeAddress = await signerSafe.getAddress();
            const safe = (
                await getSafe({
                    owners: [user1.address, user2.address, user3.address, user4.address, signerSafeAddress],
                })
            ).connect(user1);
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });

            const safeMessageHash = calculateSafeMessageHash(
                signerSafeAddress,
                calculateSafeTransactionHash(safeAddress, tx, await chainId()),
                await chainId(),
            );

            const signerSafeOwnerSignature = await signHash(user5, safeMessageHash);
            const signerSafeSig = buildContractSignature(signerSafeAddress, signerSafeOwnerSignature.data);
            await expect(
                logGas(
                    "Execute cancel transaction with 5 owners (1 owner is another Safe)",
                    executeTx(safe, tx, [
                        await safeApproveHash(user1, safe, tx, true),
                        await safeApproveHash(user4, safe, tx),
                        await safeSignTypedData(user2, safeAddress, tx),
                        await safeSignTypedData(user3, safeAddress, tx),
                        signerSafeSig,
                    ]),
                ),
            ).to.emit(safe, "ExecutionSuccess");
        });
    });

    describe("checkSignatures", () => {
        it("should fail if signature points into static part", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });

            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            const signatures =
                "0x" +
                "000000000000000000000000" +
                user1.address.slice(2) +
                "0000000000000000000000000000000000000000000000000000000000000020" +
                "00" + // r, s, v
                "0000000000000000000000000000000000000000000000000000000000000000"; // Some data to read
            await expect(safe["checkSignatures(address,bytes32,bytes)"](hre.ethers.ZeroAddress, txHash, signatures)).to.be.revertedWith(
                "GS021",
            );
        });

        it("should fail if signatures data is not present", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());

            const signatures =
                "0x" +
                "000000000000000000000000" +
                user1.address.slice(2) +
                "0000000000000000000000000000000000000000000000000000000000000041" +
                "00"; // r, s, v

            await expect(safe["checkSignatures(address,bytes32,bytes)"](hre.ethers.ZeroAddress, txHash, signatures)).to.be.revertedWith(
                "GS022",
            );
        });

        it("should fail if signatures data is too short", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());

            const signatures =
                "0x" +
                "000000000000000000000000" +
                user1.address.slice(2) +
                "0000000000000000000000000000000000000000000000000000000000000041" +
                "00" + // r, s, v
                "0000000000000000000000000000000000000000000000000000000000000020"; // length

            await expect(safe["checkSignatures(address,bytes32,bytes)"](hre.ethers.ZeroAddress, txHash, signatures)).to.be.revertedWith(
                "GS023",
            );
        });

        it("should not be able to use different chainId for signing", async () => {
            const {
                signers: [user1],
            } = await setupTests();
            const safe = await getSafe({ owners: [user1.address] });
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            const signatures = buildSignatureBytes([await safeSignTypedData(user1, safeAddress, tx, 1)]);
            await expect(safe["checkSignatures(address,bytes32,bytes)"](hre.ethers.ZeroAddress, txHash, signatures)).to.be.revertedWith(
                "GS026",
            );
        });

        it("if not msg.sender on-chain approval is required", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const user2Safe = safe.connect(user2);
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            const signatures = buildSignatureBytes([await safeApproveHash(user1, safe, tx, true)]);
            await expect(
                user2Safe["checkSignatures(address,bytes32,bytes)"](hre.ethers.ZeroAddress, txHash, signatures),
            ).to.be.revertedWith("GS025");
        });

        it("should revert if threshold is not set", async () => {
            await setupTests();
            const safe = await getSafeTemplate();
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            await expect(safe["checkSignatures(address,bytes32,bytes)"](hre.ethers.ZeroAddress, txHash, "0x")).to.be.revertedWith("GS001");
        });

        it("should revert if not the required amount of signature data is provided", async () => {
            const {
                signers: [user1, user2, user3],
            } = await setupTests();
            const safe = await getSafe({ owners: [user1.address, user2.address, user3.address] });
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            await expect(safe["checkSignatures(address,bytes32,bytes)"](hre.ethers.ZeroAddress, txHash, "0x")).to.be.revertedWith("GS020");
        });

        it("should not be able to use different signature type of same owner", async () => {
            const {
                signers: [user1, user2, user3],
            } = await setupTests();
            const safe = await getSafe({ owners: [user1.address, user2.address, user3.address] });
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            const signatures = buildSignatureBytes([
                await safeApproveHash(user1, safe, tx),
                await safeSignTypedData(user1, safeAddress, tx),
                await safeSignTypedData(user3, safeAddress, tx),
            ]);
            await expect(safe["checkSignatures(address,bytes32,bytes)"](hre.ethers.ZeroAddress, txHash, signatures)).to.be.revertedWith(
                "GS026",
            );
        });

        it("should be able to mix all signature types", async () => {
            const {
                signers: [user1, user2, user3, user4, user5],
            } = await setupTests();
            const compatFallbackHandler = await getCompatFallbackHandler();
            const compatFallbackHandlerAddress = await compatFallbackHandler.getAddress();
            const signerSafe = await getSafe({
                owners: [user5.address],
                threshold: 1,
                fallbackHandler: compatFallbackHandlerAddress,
            });
            const signerSafeAddress = await signerSafe.getAddress();
            const safe = await getSafe({
                owners: [user1.address, user2.address, user3.address, user4.address, signerSafeAddress],
            });
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());

            const safeMessageHash = calculateSafeMessageHash(signerSafeAddress, txHash, await chainId());
            const signerSafeOwnerSignature = await signHash(user5, safeMessageHash);
            const signerSafeSig = buildContractSignature(signerSafeAddress, signerSafeOwnerSignature.data);

            const signatures = buildSignatureBytes([
                await safeApproveHash(user1, safe, tx, true),
                await safeApproveHash(user4, safe, tx),
                await safeSignTypedData(user2, safeAddress, tx),
                await safeSignTypedData(user3, safeAddress, tx),
                signerSafeSig,
            ]);

            await safe["checkSignatures(address,bytes32,bytes)"](user1.address, txHash, signatures);
        });
    });

    describe("checkSignatures (legacy)", () => {
        it("should fail if signature points into static part", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });

            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            const signatures =
                "0x" +
                "000000000000000000000000" +
                user1.address.slice(2) +
                "0000000000000000000000000000000000000000000000000000000000000020" +
                "00" + // r, s, v
                "0000000000000000000000000000000000000000000000000000000000000000"; // Some data to read
            await expect(safe["checkSignatures(bytes32,bytes,bytes)"](txHash, "0x", signatures)).to.be.revertedWith("GS021");
        });

        it("should fail if signatures data is not present", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHashData = preimageSafeTransactionHash(safeAddress, tx, await chainId());
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());

            const signatures =
                "0x" +
                "000000000000000000000000" +
                user1.address.slice(2) +
                "0000000000000000000000000000000000000000000000000000000000000041" +
                "00"; // r, s, v

            await expect(safe["checkSignatures(bytes32,bytes,bytes)"](txHash, txHashData, signatures)).to.be.revertedWith("GS022");
        });

        it("should fail if signatures data is too short", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHashData = preimageSafeTransactionHash(safeAddress, tx, await chainId());
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());

            const signatures =
                "0x" +
                "000000000000000000000000" +
                user1.address.slice(2) +
                "0000000000000000000000000000000000000000000000000000000000000041" +
                "00" + // r, s, v
                "0000000000000000000000000000000000000000000000000000000000000020"; // length

            await expect(safe["checkSignatures(bytes32,bytes,bytes)"](txHash, txHashData, signatures)).to.be.revertedWith("GS023");
        });

        it("should not be able to use different chainId for signing", async () => {
            const {
                signers: [user1],
            } = await setupTests();
            const safe = await getSafe({ owners: [user1.address] });
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHashData = preimageSafeTransactionHash(safeAddress, tx, await chainId());
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            const signatures = buildSignatureBytes([await safeSignTypedData(user1, safeAddress, tx, 1)]);
            await expect(safe["checkSignatures(bytes32,bytes,bytes)"](txHash, txHashData, signatures)).to.be.revertedWith("GS026");
        });

        it("if not msg.sender on-chain approval is required", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const user2Safe = safe.connect(user2);
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHashData = preimageSafeTransactionHash(safeAddress, tx, await chainId());
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            const signatures = buildSignatureBytes([await safeApproveHash(user1, safe, tx, true)]);
            await expect(user2Safe["checkSignatures(bytes32,bytes,bytes)"](txHash, txHashData, signatures)).to.be.revertedWith("GS025");
        });

        it("should revert if not the required amount of signature data is provided", async () => {
            const {
                compatFallbackHandler,
                signers: [user1, user2, user3],
            } = await setupTests();
            const safe = await getSafe({
                owners: [user1.address, user2.address, user3.address],
                threshold: 3,
                fallbackHandler: await compatFallbackHandler.getAddress(),
            });
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHashData = preimageSafeTransactionHash(safeAddress, tx, await chainId());
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            await expect(safe["checkSignatures(bytes32,bytes,bytes)"](txHash, txHashData, "0x")).to.be.revertedWith("GS020");
        });

        it("should not be able to use different signature type of same owner", async () => {
            const {
                compatFallbackHandler,
                signers: [user1, user2, user3],
            } = await setupTests();
            const safe = await getSafe({
                owners: [user1.address, user2.address, user3.address],
                threshold: 3,
                fallbackHandler: await compatFallbackHandler.getAddress(),
            });
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHashData = preimageSafeTransactionHash(safeAddress, tx, await chainId());
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            const signatures = buildSignatureBytes([
                await safeApproveHash(user1, safe, tx),
                await safeSignTypedData(user1, safeAddress, tx),
                await safeSignTypedData(user3, safeAddress, tx),
            ]);
            await expect(safe["checkSignatures(bytes32,bytes,bytes)"](txHash, txHashData, signatures)).to.be.revertedWith("GS026");
        });

        it("should be able to mix all signature types", async () => {
            const {
                compatFallbackHandler,
                signers: [user1, user2, user3, user4, user5],
            } = await setupTests();
            const compatFallbackHandlerAddress = await compatFallbackHandler.getAddress();
            const signerSafe = await getSafe({
                owners: [user5.address],
                threshold: 1,
                fallbackHandler: compatFallbackHandlerAddress,
            });
            const signerSafeAddress = await signerSafe.getAddress();
            const safe = await getSafe({
                owners: [user1.address, user2.address, user3.address, user4.address, signerSafeAddress],
                threshold: 5,
                fallbackHandler: compatFallbackHandlerAddress,
            });
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());

            const safeMessageHash = calculateSafeMessageHash(signerSafeAddress, txHash, await chainId());
            const signerSafeOwnerSignature = await signHash(user5, safeMessageHash);
            const signerSafeSig = buildContractSignature(signerSafeAddress, signerSafeOwnerSignature.data);

            const signatures = buildSignatureBytes([
                await safeApproveHash(user1, safe, tx, true),
                await safeApproveHash(user4, safe, tx),
                await safeSignTypedData(user2, safeAddress, tx),
                await safeSignTypedData(user3, safeAddress, tx),
                signerSafeSig,
            ]);

            await safe.connect(user1)["checkSignatures(bytes32,bytes,bytes)"](txHash, "0x", signatures);
        });
    });

    describe("checkNSignatures", () => {
        it("should fail if signature points into static part", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();

            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            const signatures =
                "0x" +
                "000000000000000000000000" +
                user1.address.slice(2) +
                "0000000000000000000000000000000000000000000000000000000000000020" +
                "00" + // r, s, v
                "0000000000000000000000000000000000000000000000000000000000000000"; // Some data to read
            await expect(safe["checkNSignatures(address,bytes32,bytes,uint256)"](user1.address, txHash, signatures, 1)).to.be.revertedWith(
                "GS021",
            );
        });

        it("should fail if signatures data is not present", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();

            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());

            const signatures =
                "0x" +
                "000000000000000000000000" +
                user1.address.slice(2) +
                "0000000000000000000000000000000000000000000000000000000000000041" +
                "00"; // r, s, v

            await expect(safe["checkNSignatures(address,bytes32,bytes,uint256)"](user1.address, txHash, signatures, 1)).to.be.revertedWith(
                "GS022",
            );
        });

        it("should fail if signatures data is too short", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();

            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());

            const signatures =
                "0x" +
                "000000000000000000000000" +
                user1.address.slice(2) +
                "0000000000000000000000000000000000000000000000000000000000000041" +
                "00" + // r, s, v
                "0000000000000000000000000000000000000000000000000000000000000020"; // length

            await expect(safe["checkNSignatures(address,bytes32,bytes,uint256)"](user1.address, txHash, signatures, 1)).to.be.revertedWith(
                "GS023",
            );
        });

        it("should not be able to use different chainId for signing", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            const signatures = buildSignatureBytes([await safeSignTypedData(user1, safeAddress, tx, 1)]);
            await expect(safe["checkNSignatures(address,bytes32,bytes,uint256)"](user1.address, txHash, signatures, 1)).to.be.revertedWith(
                "GS026",
            );
        });

        it("if not msg.sender on-chain approval is required", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const user2Safe = safe.connect(user2);
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            const signatures = buildSignatureBytes([await safeApproveHash(user1, safe, tx, true)]);
            await expect(
                user2Safe["checkNSignatures(address,bytes32,bytes,uint256)"](AddressZero, txHash, signatures, 1),
            ).to.be.revertedWith("GS025");
        });

        it("should revert if not the required amount of signature data is provided", async () => {
            const {
                signers: [user1, user2, user3],
            } = await setupTests();
            const safe = await getSafe({ owners: [user1.address, user2.address, user3.address] });
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            await expect(safe["checkNSignatures(address,bytes32,bytes,uint256)"](AddressZero, txHash, "0x", 1)).to.be.revertedWith("GS020");
        });

        it("should not be able to use different signature type of same owner", async () => {
            const {
                signers: [user1, user2, user3],
            } = await setupTests();
            const safe = await getSafe({ owners: [user1.address, user2.address, user3.address] });
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            const signatures = buildSignatureBytes([
                await safeApproveHash(user1, safe, tx),
                await safeSignTypedData(user1, safeAddress, tx),
                await safeSignTypedData(user3, safeAddress, tx),
            ]);
            await expect(safe["checkNSignatures(address,bytes32,bytes,uint256)"](AddressZero, txHash, signatures, 3)).to.be.revertedWith(
                "GS026",
            );
        });

        it("should be able to mix all signature types", async () => {
            const {
                signers: [user1, user2, user3, user4, user5],
            } = await setupTests();
            const compatFallbackHandler = await getCompatFallbackHandler();
            const compatFallbackHandlerAddress = await compatFallbackHandler.getAddress();
            const signerSafe = await getSafe({
                owners: [user5.address],
                threshold: 1,
                fallbackHandler: compatFallbackHandlerAddress,
            });
            const signerSafeAddress = await signerSafe.getAddress();
            const safe = await getSafe({
                owners: [user1.address, user2.address, user3.address, user4.address, signerSafeAddress],
            });
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());

            const safeMessageHash = calculateSafeMessageHash(signerSafeAddress, txHash, await chainId());
            const signerSafeOwnerSignature = await signHash(user5, safeMessageHash);
            const signerSafeSig = buildContractSignature(signerSafeAddress, signerSafeOwnerSignature.data);

            const signatures = buildSignatureBytes([
                await safeApproveHash(user1, safe, tx, true),
                await safeApproveHash(user4, safe, tx),
                await safeSignTypedData(user2, safeAddress, tx),
                await safeSignTypedData(user3, safeAddress, tx),
                signerSafeSig,
            ]);

            await safe["checkNSignatures(address,bytes32,bytes,uint256)"](user1.address, txHash, signatures, 5);
        });

        it("should be able to require no signatures", async () => {
            const { safe } = await setupTests();
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());

            await safe["checkNSignatures(address,bytes32,bytes,uint256)"](AddressZero, txHash, "0x", 0);
        });

        it("should be able to require less signatures than the threshold", async () => {
            const {
                signers: [user1, user2, user3, user4],
            } = await setupTests();
            const safe = await getSafe({ owners: [user1.address, user2.address, user3.address, user4.address] });
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            const signatures = buildSignatureBytes([await safeSignTypedData(user3, safeAddress, tx)]);

            await safe["checkNSignatures(address,bytes32,bytes,uint256)"](AddressZero, txHash, signatures, 1);
        });

        it("should be able to require more signatures than the threshold", async () => {
            const {
                signers: [user1, user2, user3, user4],
            } = await setupTests();
            const safe = await getSafe({ owners: [user1.address, user2.address, user3.address, user4.address], threshold: 2 });
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            const signatures = buildSignatureBytes([
                await safeApproveHash(user1, safe, tx, true),
                await safeApproveHash(user4, safe, tx),
                await safeSignTypedData(user2, safeAddress, tx),
            ]);

            // Should fail as only 3 signatures are provided
            await expect(safe["checkNSignatures(address,bytes32,bytes,uint256)"](user1.address, txHash, signatures, 4)).to.be.revertedWith(
                "GS020",
            );

            await safe["checkNSignatures(address,bytes32,bytes,uint256)"](user1.address, txHash, signatures, 3);
        });

        it("Should accept an arbitrary msg.sender", async () => {
            const {
                signers: [user1, user2],
            } = await setupTests();

            const safe = await getSafe({ owners: [user1.address] });
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());

            const signatures = buildSignatureBytes([await safeApproveHash(user1, safe, tx, true)]);
            const safeConnectUser2 = safe.connect(user2);

            await safeConnectUser2["checkNSignatures(address,bytes32,bytes,uint256)"](user1.address, txHash, signatures, 1);
        });
    });

    describe("checkNSignatures (legacy)", () => {
        it("should use msg.sender executing the check", async () => {
            // We attach the safe to user2 but the only owner of the safe is user1
            // If it fails to preserve the msg.sender, it will fail because user2 is not an owner
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            const safeAddress = await safe.getAddress();

            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());

            const signatures = buildSignatureBytes([await safeApproveHash(user1, safe, tx, true)]);
            const safeConnectedUser2 = safe.connect(user2);

            await expect(
                safeConnectedUser2["checkNSignatures(bytes32,bytes,bytes,uint256)"](txHash, "0x", signatures, 1),
            ).to.be.revertedWith("GS025");
        });

        it("should fail if signature points into static part", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();

            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            const signatures =
                "0x" +
                "000000000000000000000000" +
                user1.address.slice(2) +
                "0000000000000000000000000000000000000000000000000000000000000020" +
                "00" + // r, s, v
                "0000000000000000000000000000000000000000000000000000000000000000"; // Some data to read
            await expect(safe["checkNSignatures(bytes32,bytes,bytes,uint256)"](txHash, "0x", signatures, 1)).to.be.revertedWith("GS021");
        });

        it("should fail if signatures data is not present", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();

            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());

            const signatures =
                "0x" +
                "000000000000000000000000" +
                user1.address.slice(2) +
                "0000000000000000000000000000000000000000000000000000000000000041" +
                "00"; // r, s, v

            await expect(safe["checkNSignatures(bytes32,bytes,bytes,uint256)"](txHash, "0x", signatures, 1)).to.be.revertedWith("GS022");
        });

        it("should fail if signatures data is too short", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();

            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());

            const signatures =
                "0x" +
                "000000000000000000000000" +
                user1.address.slice(2) +
                "0000000000000000000000000000000000000000000000000000000000000041" +
                "00" + // r, s, v
                "0000000000000000000000000000000000000000000000000000000000000020"; // length

            await expect(safe["checkNSignatures(bytes32,bytes,bytes,uint256)"](txHash, "0x", signatures, 1)).to.be.revertedWith("GS023");
        });

        it("should not be able to use different chainId for signing", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();

            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            const signatures = buildSignatureBytes([await safeSignTypedData(user1, safeAddress, tx, 1)]);
            await expect(safe["checkNSignatures(bytes32,bytes,bytes,uint256)"](txHash, "0x", signatures, 1)).to.be.revertedWith("GS026");
        });

        it("if not msg.sender on-chain approval is required", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const user2Safe = safe.connect(user2);
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            const signatures = buildSignatureBytes([await safeApproveHash(user1, safe, tx, true)]);
            await expect(user2Safe["checkNSignatures(bytes32,bytes,bytes,uint256)"](txHash, "0x", signatures, 1)).to.be.revertedWith(
                "GS025",
            );
        });

        it("should revert if not the required amount of signature data is provided", async () => {
            const {
                compatFallbackHandler,
                signers: [user1, user2, user3],
            } = await setupTests();
            const compatFallbackHandlerAddress = await compatFallbackHandler.getAddress();
            const safe = await getSafe({
                owners: [user1.address, user2.address, user3.address],
                threshold: 3,
                fallbackHandler: compatFallbackHandlerAddress,
            });
            const safeAddress = await safe.getAddress();

            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            await expect(safe["checkNSignatures(bytes32,bytes,bytes,uint256)"](txHash, "0x", "0x", 1)).to.be.revertedWith("GS020");
        });

        it("should not be able to use different signature type of same owner", async () => {
            const {
                compatFallbackHandler,
                signers: [user1, user2, user3],
            } = await setupTests();
            const compatFallbackHandlerAddress = await compatFallbackHandler.getAddress();
            const safe = await getSafe({
                owners: [user1.address, user2.address, user3.address],
                threshold: 3,
                fallbackHandler: compatFallbackHandlerAddress,
            });
            const safeAddress = await safe.getAddress();

            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            const signatures = buildSignatureBytes([
                await safeApproveHash(user1, safe, tx),
                await safeSignTypedData(user1, safeAddress, tx),
                await safeSignTypedData(user3, safeAddress, tx),
            ]);
            await expect(safe["checkNSignatures(bytes32,bytes,bytes,uint256)"](txHash, "0x", signatures, 3)).to.be.revertedWith("GS026");
        });

        it("should be able to mix all signature types", async () => {
            const {
                signers: [user1, user2, user3, user4, user5],
            } = await setupTests();
            const compatFallbackHandler = await getCompatFallbackHandler();
            const compatFallbackHandlerAddress = await compatFallbackHandler.getAddress();
            const signerSafe = await getSafe({
                owners: [user5.address],
                threshold: 1,
                fallbackHandler: compatFallbackHandlerAddress,
            });
            const signerSafeAddress = await signerSafe.getAddress();
            const safe = await getSafe({
                owners: [user1.address, user2.address, user3.address, user4.address, signerSafeAddress],
                threshold: 5,
                fallbackHandler: compatFallbackHandlerAddress,
            });
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());

            const safeMessageHash = calculateSafeMessageHash(signerSafeAddress, txHash, await chainId());
            const signerSafeOwnerSignature = await signHash(user5, safeMessageHash);
            const signerSafeSig = buildContractSignature(signerSafeAddress, signerSafeOwnerSignature.data);

            const signatures = buildSignatureBytes([
                await safeApproveHash(user1, safe, tx, true),
                await safeApproveHash(user4, safe, tx),
                await safeSignTypedData(user2, safeAddress, tx),
                await safeSignTypedData(user3, safeAddress, tx),
                signerSafeSig,
            ]);

            await safe.connect(user1)["checkNSignatures(bytes32,bytes,bytes,uint256)"](txHash, "0x", signatures, 5);
        });

        it("should be able to require no signatures", async () => {
            const { safe } = await setupTests();
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());

            await safe["checkNSignatures(bytes32,bytes,bytes,uint256)"](txHash, "0x", "0x", 0);
        });

        it("should be able to require less signatures than the threshold", async () => {
            const {
                compatFallbackHandler,
                signers: [user1, user2, user3, user4],
            } = await setupTests();
            const compatFallbackHandlerAddress = await compatFallbackHandler.getAddress();
            const safe = await getSafe({
                owners: [user1.address, user2.address, user3.address, user4.address],
                threshold: 4,
                fallbackHandler: compatFallbackHandlerAddress,
            });
            const safeAddress = await safe.getAddress();

            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            const signatures = buildSignatureBytes([await safeSignTypedData(user3, safeAddress, tx)]);

            await safe["checkNSignatures(bytes32,bytes,bytes,uint256)"](txHash, "0x", signatures, 1);
        });

        it("should be able to require more signatures than the threshold", async () => {
            const {
                compatFallbackHandler,
                signers: [user1, user2, user3, user4],
            } = await setupTests();
            const compatFallbackHandlerAddress = await compatFallbackHandler.getAddress();
            const safe = (
                await getSafe({
                    owners: [user1.address, user2.address, user3.address, user4.address],
                    threshold: 2,
                    fallbackHandler: compatFallbackHandlerAddress,
                })
            ).connect(user1);
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({ to: safeAddress, nonce: await safe.nonce() });
            const txHash = calculateSafeTransactionHash(safeAddress, tx, await chainId());
            const signatures = buildSignatureBytes([
                await safeApproveHash(user1, safe, tx, true),
                await safeApproveHash(user4, safe, tx),
                await safeSignTypedData(user2, safeAddress, tx),
            ]);

            // Should fail as only 3 signatures are provided
            await expect(safe["checkNSignatures(bytes32,bytes,bytes,uint256)"](txHash, "0x", signatures, 4)).to.be.revertedWith("GS020");

            await safe["checkNSignatures(bytes32,bytes,bytes,uint256)"](txHash, "0x", signatures, 3);
        });
    });
});
