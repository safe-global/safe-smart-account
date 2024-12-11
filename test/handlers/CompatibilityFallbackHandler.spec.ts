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
import { killLibContract } from "../utils/contracts";

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
        const killLib = await killLibContract(user1, hre.network.zksync);
        return {
            safe,
            validator,
            handler,
            killLib,
            signLib,
            signerSafe,
            signers,
        };
    });

    describe("ERC1155", () => {
        it("to handle onERC1155Received", async () => {
            const { handler } = await setupTests();
            await expect(await handler.onERC1155Received.staticCall(AddressZero, AddressZero, 0, 0, "0x")).to.be.eq("0xf23a6e61");
        });

        it("to handle onERC1155BatchReceived", async () => {
            const { handler } = await setupTests();
            await expect(await handler.onERC1155BatchReceived.staticCall(AddressZero, AddressZero, [], [], "0x")).to.be.eq("0xbc197c81");
        });
    });

    describe("ERC721", () => {
        it("to handle onERC721Received", async () => {
            const { handler } = await setupTests();
            await expect(await handler.onERC721Received.staticCall(AddressZero, AddressZero, 0, "0x")).to.be.eq("0x150b7a02");
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
        it.skip("can be called for any Safe", async () => {});

        it("should revert changes", async function () {
            /**
             * ## Test not applicable for zkSync, therefore should skip.
             * The `SELFDESTRUCT` instruction is not supported
             * @see https://era.zksync.io/docs/reference/architecture/differences-with-ethereum.html#selfdestruct
             */
            if (hre.network.zksync) this.skip();

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
    });
});
