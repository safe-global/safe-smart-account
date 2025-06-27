import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { AddressZero } from "@ethersproject/constants";
import { getCompatFallbackHandler, getSafe } from "../utils/setup";
import {
    buildSignatureBytes,
    executeContractCallWithSigners,
    calculateSafeMessageHash,
    buildContractSignature,
    EIP712_SAFE_MESSAGE_TYPE,
    signHash,
} from "../../src/utils/execution";
import { chainId } from "../utils/encoding";
import { badSimulatorContract, killLibContract } from "../utils/contracts";

describe("CompatibilityFallbackHandler", () => {
    const setupTests = hre.deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const signLib = await (await hre.ethers.getContractFactory("SignMessageLib")).deploy();
        const handler = await getCompatFallbackHandler();
        const handlerAddress = await handler.getAddress();
        const signers = await hre.ethers.getSigners();
        const [user1, user2] = signers;
        const signerSafe = await getSafe({ owners: [user1.address], threshold: 1, fallbackHandler: handlerAddress });
        const signerSafeAddress = await signerSafe.getAddress();
        const safe = await getSafe({
            owners: [user1.address, user2.address, signerSafeAddress],
            threshold: 2,
            fallbackHandler: handlerAddress,
        });
        const safeAddress = await safe.getAddress();
        const validator = await getCompatFallbackHandler(safeAddress);
        const killLib = await killLibContract(user1);
        const badSimulator = await badSimulatorContract(user1);
        const erc721 = await ethers.deployContract("ERC721Token");
        const erc1155 = await ethers.deployContract("ERC1155Token");
        return {
            safe,
            validator,
            handler,
            killLib,
            badSimulator,
            signLib,
            signerSafe,
            signers,
            erc721,
            erc1155,
        };
    });

    describe("ERC1155", () => {
        it("to handle onERC1155Received", async () => {
            const { handler, safe } = await setupTests();
            const result = await handler
                .connect(ethers.provider)
                .onERC1155Received(AddressZero, AddressZero, 0, 0, "0x", { from: await safe.getAddress() });
            await expect(result).to.be.eq("0xf23a6e61");
        });

        it("to handle onERC1155BatchReceived", async () => {
            const { handler, safe } = await setupTests();
            const result = await handler
                .connect(ethers.provider)
                .onERC1155BatchReceived(AddressZero, AddressZero, [], [], "0x", { from: await safe.getAddress() });
            await expect(result).to.be.eq("0xbc197c81");
        });

        it("should allow a Safe to receive ERC-1155 tokens", async () => {
            const {
                safe,
                signers: [user],
                erc1155,
            } = await setupTests();
            await erc1155.mintBatch(await user.getAddress(), [1, 2, 3], [100, 100, 100], "0x");

            await expect(erc1155.connect(user).safeTransferFrom(await user.getAddress(), await safe.getAddress(), 1, 100, "0x")).to.not.be
                .reverted;
            await expect(
                erc1155.connect(user).safeBatchTransferFrom(await user.getAddress(), await safe.getAddress(), [2, 3], [100, 100], "0x"),
            ).to.not.be.reverted;
        });

        it("should revert when tokens are transferred directly to the handler", async () => {
            const {
                handler,
                signers: [user],
                erc1155,
            } = await setupTests();
            await erc1155.mintBatch(await user.getAddress(), [1, 2, 3], [100, 100, 100], "0x");

            await expect(erc1155.connect(user).safeTransferFrom(await user.getAddress(), await handler.getAddress(), 1, 100, "0x")).to.be
                .reverted;
            await expect(
                erc1155.connect(user).safeBatchTransferFrom(await user.getAddress(), await handler.getAddress(), [2, 3], [100, 100], "0x"),
            ).to.be.revertedWith("not a fallback call");
        });
    });

    describe("ERC721", () => {
        it("to handle onERC721Received", async () => {
            const { handler, safe } = await setupTests();

            const result = await handler
                .connect(ethers.provider)
                .onERC721Received(AddressZero, AddressZero, 0, "0x", { from: await safe.getAddress() });
            await expect(result).to.be.eq("0x150b7a02");
        });

        it("should allow a Safe to receive ERC-721 tokens", async () => {
            const {
                safe,
                signers: [user],
                erc721,
            } = await setupTests();
            await erc721.mint(await user.getAddress(), 1);

            await expect(
                erc721.connect(user)["safeTransferFrom(address,address,uint256)"](await user.getAddress(), await safe.getAddress(), 1),
            ).to.not.be.reverted;
        });

        it("should revert when tokens are transferred directly to the handler", async () => {
            const {
                handler,
                signers: [user],
                erc721,
            } = await setupTests();
            await erc721.mint(await user.getAddress(), 1);

            await expect(
                erc721.connect(user)["safeTransferFrom(address,address,uint256)"](await user.getAddress(), await handler.getAddress(), 1),
            ).to.be.revertedWith("not a fallback call");
        });
    });

    describe("ERC777", () => {
        it("to handle tokensReceived", async () => {
            const { handler } = await setupTests();
            await handler.tokensReceived.staticCall(AddressZero, AddressZero, AddressZero, 0, "0x", "0x");
        });
    });

    describe("isValidSignature(bytes32,bytes)", () => {
        it("should revert if called directly", async () => {
            const { handler } = await setupTests();
            const dataHash = ethers.keccak256("0xbaddad");
            await expect(handler.isValidSignature.staticCall(dataHash, "0x")).to.be.reverted;
        });

        it("should revert if message was not signed", async () => {
            const { validator } = await setupTests();
            const dataHash = ethers.keccak256("0xbaddad");
            await expect(validator.isValidSignature.staticCall(dataHash, "0x")).to.be.revertedWith("Hash not approved");
        });

        it("should revert if signature is not valid", async () => {
            const { validator } = await setupTests();
            const dataHash = ethers.keccak256("0xbaddad");
            await expect(validator.isValidSignature.staticCall(dataHash, "0xdeaddeaddeaddead")).to.be.reverted;
        });

        it("should return magic value if message was signed", async () => {
            const {
                safe,
                validator,
                signLib,
                signers: [user1, user2],
            } = await setupTests();
            const dataHash = ethers.keccak256("0xbaddad");
            await executeContractCallWithSigners(safe, signLib, "signMessage", [dataHash], [user1, user2], true);
            expect(await validator.isValidSignature.staticCall(dataHash, "0x")).to.be.eq("0x1626ba7e");
        });

        it("should return magic value if enough owners signed and allow a mix different signature types", async () => {
            const {
                validator,
                signerSafe,
                signers: [user1, user2],
            } = await setupTests();
            const signerSafeAddress = await signerSafe.getAddress();
            const validatorAddress = await validator.getAddress();
            const dataHash = ethers.keccak256("0xbaddad");
            const typedDataSig = {
                signer: user1.address,
                data: await user1.signTypedData(
                    { verifyingContract: validatorAddress, chainId: await chainId() },
                    EIP712_SAFE_MESSAGE_TYPE,
                    { message: dataHash },
                ),
            };
            const ethSignSig = await signHash(user2, calculateSafeMessageHash(validatorAddress, dataHash, await chainId()));
            const validatorSafeMessageHash = calculateSafeMessageHash(validatorAddress, dataHash, await chainId());
            const signerSafeMessageHash = calculateSafeMessageHash(signerSafeAddress, validatorSafeMessageHash, await chainId());

            const signerSafeOwnerSignature = await signHash(user1, signerSafeMessageHash);

            const signerSafeSig = buildContractSignature(signerSafeAddress, signerSafeOwnerSignature.data);

            for (const signatures of [
                [typedDataSig, ethSignSig],
                [typedDataSig, signerSafeSig],
                [ethSignSig, signerSafeSig],
            ]) {
                expect(await validator.isValidSignature.staticCall(dataHash, buildSignatureBytes(signatures))).to.be.eq("0x1626ba7e");
            }
        });

        it("should not accept pre-approved signatures", async () => {
            const {
                validator,
                signers: [user1, user2],
            } = await setupTests();
            const validatorAddress = await validator.getAddress();
            const dataHash = ethers.keccak256("0xbaddad");
            const user1Signature = {
                signer: user1.address,
                data: ethers.solidityPacked(["uint256", "uint256", "uint8"], [user1.address, 0, 1]),
            };
            const user2Signature = {
                signer: user2.address,
                data: await user2.signTypedData(
                    { verifyingContract: validatorAddress, chainId: await chainId() },
                    EIP712_SAFE_MESSAGE_TYPE,
                    { message: dataHash },
                ),
            };

            const signatures = buildSignatureBytes([user1Signature, user2Signature]);
            await expect(validator.connect(user1).isValidSignature.staticCall(dataHash, signatures)).to.be.reverted;
        });
    });

    describe("getModules", () => {
        it("returns enabled modules", async () => {
            const {
                safe,
                validator,
                signers: [user1, user2],
            } = await setupTests();
            await expect(executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1, user2]))
                .to.emit(safe, "EnabledModule")
                .withArgs(user2.address);

            await expect(await safe.isModuleEnabled(user2.address)).to.be.true;

            await expect(await validator.getModules()).to.be.deep.equal([user2.address]);
        });
    });

    describe("getMessageHash", () => {
        it("should generate the correct hash", async () => {
            const { safe, validator } = await setupTests();
            const safeAddress = await safe.getAddress();
            expect(await validator.getMessageHash("0xdead")).to.be.eq(calculateSafeMessageHash(safeAddress, "0xdead", await chainId()));
        });
    });

    describe("getMessageHashForSafe", () => {
        it("should revert if target does not return domain separator", async () => {
            const { handler } = await setupTests();
            const handlerAddress = await handler.getAddress();
            await expect(handler.getMessageHashForSafe(handlerAddress, "0xdead")).to.be.reverted;
        });

        it("should generate the correct hash", async () => {
            const { handler, safe } = await setupTests();
            const safeAddress = await safe.getAddress();
            expect(await handler.getMessageHashForSafe(safeAddress, "0xdead")).to.be.eq(
                calculateSafeMessageHash(safeAddress, "0xdead", await chainId()),
            );
        });
    });

    describe("simulate", () => {
        it("should revert changes", async () => {
            const { validator, killLib } = await setupTests();
            const validatorAddress = await validator.getAddress();
            const killLibAddress = await killLib.getAddress();
            const code = await ethers.provider.getCode(validatorAddress);
            expect(await validator.simulate.staticCall(killLibAddress, killLib.interface.encodeFunctionData("killme"))).to.be.eq("0x");
            expect(await ethers.provider.getCode(validatorAddress)).to.be.eq(code);
        });

        it("should return result", async () => {
            const { validator, killLib, handler } = await setupTests();
            const killLibAddress = await killLib.getAddress();
            const handlerAddress = await handler.getAddress();
            expect(await validator.simulate.staticCall(killLibAddress, killLib.interface.encodeFunctionData("expose"))).to.be.eq(
                "0x000000000000000000000000" + handlerAddress.slice(2).toLowerCase(),
            );
        });

        it("should propagate revert message", async () => {
            const { validator, killLib } = await setupTests();
            const killLibAddress = await killLib.getAddress();
            await expect(validator.simulate.staticCall(killLibAddress, killLib.interface.encodeFunctionData("trever"))).to.revertedWith(
                "Why are you doing this?",
            );
        });

        it("should simulate transaction", async () => {
            const { validator, killLib } = await setupTests();
            const validatorAddress = await validator.getAddress();
            const killLibAddress = await killLib.getAddress();
            const estimate = await validator.simulate.staticCall(
                killLibAddress,
                killLib.interface.encodeFunctionData("estimate", [validatorAddress, "0x"]),
            );
            expect(parseInt(estimate, 16)).to.be.lte(5000);
        });

        it("should return modified state", async () => {
            const { validator, killLib } = await setupTests();
            const killLibAddress = await killLib.getAddress();
            const value = await validator.simulate.staticCall(killLibAddress, killLib.interface.encodeFunctionData("updateAndGet", []));
            expect(value).to.be.eq(1n);
            expect(await killLib.value()).to.be.eq(0n);
        });

        it("should revert for unsupported callers", async () => {
            const { handler, badSimulator } = await setupTests();
            const handlerAddress = await handler.getAddress();
            for (let mode = 0; mode < 4; mode++) {
                await expect(badSimulator.simulateFallbackHandler(handlerAddress, mode)).to.be.reverted;
            }
        });
    });

    describe("encodeTransactionData", () => {
        it("should return the pre-image of a transaction hash", async () => {
            const { safe, validator } = await setupTests();
            const tx = [`0x${"11".repeat(20)}`, 1, "0x01020304", 0, 4, 5, 6, `0x${"77".repeat(20)}`, `0x${"88".repeat(20)}`, 9] as const;
            expect(ethers.keccak256(await validator.encodeTransactionData(...tx))).to.be.eq(await safe.getTransactionHash(...tx));
        });
    });
});
