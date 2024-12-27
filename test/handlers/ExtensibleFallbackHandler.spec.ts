import { expect } from "chai";
import hre, { deployments, ethers } from "hardhat";
import { AddressZero, HashZero } from "@ethersproject/constants";
import { deployContractFromSource, getExtensibleFallbackHandler, getSafe } from "../utils/setup";
import { buildSignatureBytes, executeContractCallWithSigners, EIP712_SAFE_MESSAGE_TYPE } from "../../src/utils/execution";
import { chainId } from "../utils/encoding";
import { encodeHandler, decodeHandler, encodeCustomVerifier, encodeHandlerFunction } from "../utils/extensible";
import { killLibContract } from "../utils/contracts";

describe("ExtensibleFallbackHandler", () => {
    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const [user1, user2] = await hre.ethers.getSigners();
        const signLib = await (await hre.ethers.getContractFactory("SignMessageLib")).deploy();
        const handler = await getExtensibleFallbackHandler();
        const handlerAddress = await handler.getAddress();
        const signerSafe = await getSafe({ owners: [user1.address], threshold: 1, fallbackHandler: handlerAddress });
        const signerSafeAddress = await signerSafe.getAddress();
        const safe = await getSafe({
            owners: [user1.address, user2.address, signerSafeAddress],
            threshold: 2,
            fallbackHandler: handlerAddress,
        });
        const validator = await getExtensibleFallbackHandler(await safe.getAddress());
        const otherSafe = await getSafe({
            owners: [user1.address, user2.address, signerSafeAddress],
            threshold: 2,
            fallbackHandler: handlerAddress,
        });
        const preconfiguredValidator = await getExtensibleFallbackHandler(await otherSafe.getAddress());
        const testVerifier = await (await hre.ethers.getContractFactory("TestSafeSignatureVerifier")).deploy();
        const testMarshalLib = await (await hre.ethers.getContractFactory("TestMarshalLib")).deploy();
        const killLib = await killLibContract(user1, hre.network.zksync);

        const mirrorSource = `
        contract Mirror {
            function handle(address safe, address sender, uint256 value, bytes calldata data) external returns (bytes memory result) {
                return msg.data;
            }
            function lookAtMe() public returns (bytes memory) {
                return msg.data;
            }
            function nowLookAtYou(address you, string memory howYouLikeThat) public returns (bytes memory) {
                return msg.data;
            }
        }`;

        const counterSource = `
        contract Counter {
            uint256 public count = 0;

            function handle(address, address, uint256, bytes calldata) external returns (bytes memory result) {
                bytes4 selector;
                assembly {
                    selector := calldataload(164)
                }

                require(selector == 0xdeadbeef, "Invalid data");
                count = count + 1;
            }
        }`;

        const revertVerifierSource = `
        contract RevertVerifier {
            function iToHex(bytes memory buffer) public pure returns (string memory) {
                // Fixed buffer size for hexadecimal conversion
                bytes memory converted = new bytes(buffer.length * 2);
                bytes memory _base = "0123456789abcdef";
                for (uint256 i = 0; i < buffer.length; i++) {
                    converted[i * 2] = _base[uint8(buffer[i]) / _base.length];
                    converted[i * 2 + 1] = _base[uint8(buffer[i]) % _base.length];
                }
                return string(abi.encodePacked("0x", converted));
            }
            function isValidSafeSignature(address safe, address sender, bytes32 _hash, bytes32 domainSeparator, bytes32 typeHash, bytes calldata encodeData, bytes calldata payload) external view returns (bytes4) {
                revert(iToHex(abi.encodePacked(msg.data)));
            }
        }`;

        const mirror = await deployContractFromSource(user1, mirrorSource);
        const revertVerifier = await deployContractFromSource(user1, revertVerifierSource);
        const counter = await deployContractFromSource(user1, counterSource);

        // Set up the mirror on the preconfigured validator
        // Check the event when changing
        await executeContractCallWithSigners(
            otherSafe,
            preconfiguredValidator,
            "setSafeMethod",
            ["0x7f8dc53c", encodeHandler(true, (await mirror.getAddress()).toLowerCase())],
            [user1, user2],
        );

        const domainHash = ethers.keccak256("0xdeadbeef");

        // setup the test verifier on the other safe
        await executeContractCallWithSigners(
            otherSafe,
            preconfiguredValidator,
            "setDomainVerifier",
            [domainHash, await testVerifier.getAddress()],
            [user1, user2],
        );

        await executeContractCallWithSigners(
            otherSafe,
            preconfiguredValidator,
            "setSupportedInterface",
            ["0xdeadbeef", true],
            [user1, user2],
        );

        return {
            user1,
            user2,
            safe,
            validator,
            otherSafe,
            preconfiguredValidator,
            handler,
            killLib,
            signLib,
            signerSafe,
            mirror,
            counter,
            testVerifier,
            revertVerifier,
            testMarshalLib,
        };
    });

    describe("Token Callbacks", () => {
        describe("ERC1155", () => {
            it("to handle onERC1155Received", async () => {
                const { handler } = await setupTests();
                expect(await handler.onERC1155Received.staticCall(AddressZero, AddressZero, 0, 0, "0x")).to.be.eq("0xf23a6e61");
            });

            it("to handle onERC1155BatchReceived", async () => {
                const { handler } = await setupTests();
                expect(await handler.onERC1155BatchReceived.staticCall(AddressZero, AddressZero, [], [], "0x")).to.be.eq("0xbc197c81");
            });

            it("should return true when queried for ERC1155 support", async () => {
                const { handler } = await setupTests();
                expect(await handler.supportsInterface.staticCall("0x4e2312e0")).to.be.eq(true);
            });
        });

        describe("ERC721", () => {
            it("to handle onERC721Received", async () => {
                const { handler } = await setupTests();
                expect(await handler.onERC721Received.staticCall(AddressZero, AddressZero, 0, "0x")).to.be.eq("0x150b7a02");
            });

            it("should return true when queried for ERC721 support", async () => {
                const { handler } = await setupTests();
                expect(await handler.supportsInterface.staticCall("0x150b7a02")).to.be.eq(true);
            });
        });
    });

    describe("Fallback Handler", () => {
        describe("fallback()", () => {
            it("should revert if call to safe is less than 4 bytes (method selector)", async () => {
                const { user1, validator } = await setupTests();

                const tx = {
                    to: await validator.getAddress(),
                    data: "0x112233",
                };

                // Confirm method handler is not set (call should revert)
                await expect(user1.call(tx)).to.be.revertedWith("invalid method selector");
            });
        });
    });

    describe("Custom methods", () => {
        describe("setSafeMethod(bytes4,bytes32)", () => {
            it("should revert if called by non-safe", async () => {
                const { handler, mirror } = await setupTests();
                await expect(handler.setSafeMethod("0xdeadbeef", encodeHandler(true, await mirror.getAddress()))).to.be.revertedWith(
                    "only safe can call this method",
                );
            });

            it("should emit event when setting a new method", async () => {
                const { user1, user2, safe, handler, validator, mirror } = await setupTests();
                const safeAddress = await safe.getAddress();
                const newHandler = encodeHandler(true, await mirror.getAddress());
                await expect(executeContractCallWithSigners(safe, validator, "setSafeMethod", ["0xdededede", newHandler], [user1, user2]))
                    .to.emit(handler, "AddedSafeMethod")
                    .withArgs(safeAddress, "0xdededede", newHandler.toLowerCase());

                // Check that the method is actually set
                expect(await handler.safeMethods.staticCall(safeAddress, "0xdededede")).to.be.eq(newHandler);
            });

            it("should emit event when updating a method", async () => {
                const { user1, user2, otherSafe, handler, preconfiguredValidator, mirror } = await setupTests();
                const otherSafeAddress = await otherSafe.getAddress();
                const oldHandler = encodeHandler(true, await mirror.getAddress());
                const newHandler = encodeHandler(true, "0xdeAdDeADDEaDdeaDdEAddEADDEAdDeadDEADDEaD");
                await expect(
                    executeContractCallWithSigners(
                        otherSafe,
                        preconfiguredValidator,
                        "setSafeMethod",
                        ["0x7f8dc53c", newHandler],
                        [user1, user2],
                    ),
                )
                    .to.emit(handler, "ChangedSafeMethod")
                    .withArgs(otherSafeAddress, "0x7f8dc53c", oldHandler.toLowerCase(), newHandler.toLowerCase());

                // Check that the method is actually updated
                expect(await handler.safeMethods.staticCall(otherSafeAddress, "0x7f8dc53c")).to.be.eq(newHandler);
            });

            it("should emit event when removing a method", async () => {
                const { user1, user2, otherSafe, handler, preconfiguredValidator } = await setupTests();
                const otherSafeAddress = await otherSafe.getAddress();
                await expect(
                    executeContractCallWithSigners(
                        otherSafe,
                        preconfiguredValidator,
                        "setSafeMethod",
                        ["0x7f8dc53c", HashZero],
                        [user1, user2],
                    ),
                )
                    .to.emit(handler, "RemovedSafeMethod")
                    .withArgs(otherSafeAddress, "0x7f8dc53c");

                // Check that the method is actually removed
                expect(await handler.safeMethods.staticCall(otherSafeAddress, "0x7f8dc53c")).to.be.eq(HashZero);
            });

            it("is correctly set", async () => {
                const { user1, user2, safe, validator, mirror } = await setupTests();
                const safeAddress = await safe.getAddress();
                const tx = {
                    to: safeAddress,
                    data: mirror.interface.encodeFunctionData("lookAtMe"),
                };

                // Confirm method handler is not set (call should revert)
                await expect(user1.call(tx)).to.be.reverted;

                // Setup the method handler
                await executeContractCallWithSigners(
                    safe,
                    validator,
                    "setSafeMethod",
                    ["0x7f8dc53c", encodeHandler(true, await mirror.getAddress())],
                    [user1, user2],
                );

                // Check that the method handler is called
                expect(await user1.call(tx)).to.be.eq(
                    "0x" +
                        // function selector for `handle(address,address,uint256,bytes)`
                        "25d6803f" +
                        "000000000000000000000000" +
                        safeAddress.slice(2).toLowerCase() +
                        "000000000000000000000000" +
                        user1.address.slice(2).toLowerCase() +
                        "0000000000000000000000000000000000000000000000000000000000000000" + // uint256(0)
                        "0000000000000000000000000000000000000000000000000000000000000080" +
                        "0000000000000000000000000000000000000000000000000000000000000004" +
                        // function selector for `lookAtMe()`
                        "7f8dc53c" +
                        "00000000000000000000000000000000000000000000000000000000",
                );
            });

            it("should allow calling non-static methods", async () => {
                const { user1, user2, safe, validator, counter } = await setupTests();

                const tx = {
                    to: await safe.getAddress(),
                    data: "0xdeadbeef",
                };

                // Confirm that the count is 0
                expect(await counter.count.staticCall()).to.be.eq(0);

                // Setup the method handler
                await executeContractCallWithSigners(
                    safe,
                    validator,
                    "setSafeMethod",
                    ["0xdeadbeef", encodeHandler(false, await counter.getAddress())],
                    [user1, user2],
                );

                // Check that the method handler is called
                await user1.sendTransaction(tx);

                // Check that the count is updated
                expect(await counter.count.staticCall()).to.be.eq(1);
            });
        });

        describe("MarshalLib", () => {
            it("should correctly encode a handler and static flag", async () => {
                const { testMarshalLib } = await setupTests();
                const handler = "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead";
                const isStatic = true;

                const encoded = "0x000000000000000000000000deaddeaddeaddeaddeaddeaddeaddeaddeaddead";
                expect(await testMarshalLib.encode.staticCall(isStatic, handler)).to.be.eq(encoded);
                expect(encoded).to.be.eq(encodeHandler(isStatic, handler));

                const nonStaticHandler = "0xdeaddeaddeaddeaddeaddeaddeaddeaddeadbeef";
                const nonStaticResult = "0x010000000000000000000000deaddeaddeaddeaddeaddeaddeaddeaddeadbeef";
                expect(await testMarshalLib.encode.staticCall(false, nonStaticHandler)).to.be.eq(nonStaticResult);
                expect(nonStaticResult).to.be.eq(encodeHandler(false, nonStaticHandler));
            });

            it("should correctly decode a handler and static flag", async () => {
                const { testMarshalLib } = await setupTests();

                const encoded = "0x000000000000000000000000deaddeaddeaddeaddeaddeaddeaddeaddeaddead";
                expect(await testMarshalLib.decode.staticCall(encoded)).to.be.deep.eq([true, "0xdeaDDeADDEaDdeaDdEAddEADDEAdDeadDEADDEaD"]);

                expect(decodeHandler(encoded)).to.be.deep.eq([true, "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead"]);

                const nonStaticEncoded = "0x010000000000000000000000deaddeaddeaddeaddeaddeaddeaddeaddeadbeef";
                expect(await testMarshalLib.decode.staticCall(nonStaticEncoded)).to.be.deep.eq([
                    false,
                    "0xDEADdEAddeaDdEAdDeadDeaDDeaddeaDDEadbEeF",
                ]);

                expect(decodeHandler(nonStaticEncoded)).to.be.deep.eq([false, "0xdeaddeaddeaddeaddeaddeaddeaddeaddeadbeef"]);
            });

            it("should correctly encode a handler, selector and static flag", async () => {
                const { testMarshalLib } = await setupTests();
                const handler = "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead";
                const selector = "0xdeadbeef";
                const isStatic = true;

                const encoded = "0x00deadbeef00000000000000deaddeaddeaddeaddeaddeaddeaddeaddeaddead";

                expect(await testMarshalLib.encodeWithSelector.staticCall(isStatic, selector, handler)).to.be.eq(encoded);
            });
            it("should correctly decode a handler, selector and static flag", async () => {
                const { testMarshalLib } = await setupTests();
                const encoded = "0x00deadbeef00000000000000deaddeaddeaddeaddeaddeaddeaddeaddeaddead";

                expect(await testMarshalLib.decodeWithSelector.staticCall(encoded)).to.be.deep.eq([
                    true,
                    "0xdeadbeef",
                    "0xdeaDDeADDEaDdeaDdEAddEADDEAdDeadDEADDEaD",
                ]);
            });
        });
    });

    describe("Signature Verifier Muxer", () => {
        describe("supportsInterface(bytes4)", () => {
            it("should return true for supporting ERC1271", async () => {
                const { handler } = await setupTests();
                expect(await handler.supportsInterface.staticCall("0x1626ba7e")).to.be.eq(true);
            });
        });

        describe("setDomainVerifier(bytes32,address)", () => {
            it("should revert if called by non-safe", async () => {
                const { handler, mirror } = await setupTests();
                const domainSeparator = ethers.keccak256("0xdeadbeef");
                await expect(handler.setDomainVerifier(domainSeparator, await mirror.getAddress())).to.be.revertedWith(
                    "only safe can call this method",
                );
            });

            it("should emit event when setting a new domain verifier", async () => {
                const { user1, user2, safe, handler, validator, testVerifier } = await setupTests();
                const safeAddress = await safe.getAddress();
                const testVerifierAddress = await testVerifier.getAddress();
                const domainSeparator = ethers.keccak256("0xdeadbeef");
                await expect(
                    executeContractCallWithSigners(
                        safe,
                        validator,
                        "setDomainVerifier",
                        [domainSeparator, testVerifierAddress],
                        [user1, user2],
                    ),
                )
                    .to.emit(handler, "AddedDomainVerifier")
                    .withArgs(safeAddress, domainSeparator, testVerifierAddress);

                expect(await handler.domainVerifiers(safeAddress, domainSeparator)).to.be.eq(testVerifierAddress);
            });

            it("should emit event when updating a domain verifier", async () => {
                const { user1, user2, otherSafe, handler, preconfiguredValidator, mirror } = await setupTests();
                const otherSafeAddress = await otherSafe.getAddress();
                const mirrorAddress = await mirror.getAddress();
                const domainSeparator = ethers.keccak256("0xdeadbeef");
                const oldVerifier = await handler.domainVerifiers(otherSafeAddress, domainSeparator);

                await expect(
                    await executeContractCallWithSigners(
                        otherSafe,
                        preconfiguredValidator,
                        "setDomainVerifier",
                        [domainSeparator, mirrorAddress],
                        [user1, user2],
                    ),
                )
                    .to.emit(handler, "ChangedDomainVerifier")
                    .withArgs(otherSafeAddress, domainSeparator, oldVerifier, mirrorAddress);

                expect(await handler.domainVerifiers(otherSafeAddress, domainSeparator)).to.be.eq(mirrorAddress);
            });

            it("should emit event when removing a domain verifier", async () => {
                const { user1, user2, otherSafe, handler, preconfiguredValidator } = await setupTests();
                const otherSafeAddress = await otherSafe.getAddress();
                const domainSeparator = ethers.keccak256("0xdeadbeef");
                await expect(
                    executeContractCallWithSigners(
                        otherSafe,
                        preconfiguredValidator,
                        "setDomainVerifier",
                        [domainSeparator, AddressZero],
                        [user1, user2],
                    ),
                )
                    .to.emit(handler, "RemovedDomainVerifier")
                    .withArgs(otherSafeAddress, domainSeparator);

                expect(await handler.domainVerifiers(otherSafeAddress, domainSeparator)).to.be.eq(AddressZero);
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

            it("should revert through default flow if signature is short", async () => {
                const { validator } = await setupTests();
                const dataHash = ethers.keccak256("0xbaddad");
                await expect(validator.isValidSignature.staticCall(dataHash, "0x5fd7e97ddead")).to.be.revertedWith("GS020");
            });

            it("should return magic value if message was signed", async () => {
                const { user1, user2, safe, validator, signLib } = await setupTests();
                const dataHash = ethers.keccak256("0xbaddad");
                await executeContractCallWithSigners(safe, signLib, "signMessage", [dataHash], [user1, user2], true);
                expect(await validator.isValidSignature.staticCall(dataHash, "0x")).to.be.eq("0x1626ba7e");
            });

            it("should return magic value if enough owners signed with typed signatures", async () => {
                const { user1, user2, validator } = await setupTests();
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
                const typedDataSig2 = {
                    signer: user2.address,
                    data: await user2.signTypedData(
                        { verifyingContract: validatorAddress, chainId: await chainId() },
                        EIP712_SAFE_MESSAGE_TYPE,
                        { message: dataHash },
                    ),
                };

                expect(await validator.isValidSignature.staticCall(dataHash, buildSignatureBytes([typedDataSig, typedDataSig2]))).to.be.eq(
                    "0x1626ba7e",
                );
            });

            it("should not accept pre-approved signatures", async () => {
                const { user1, user2, validator } = await setupTests();
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

            it("should send EIP-712 context to custom verifier", async () => {
                const { user1, user2, safe, validator, revertVerifier } = await setupTests();
                const domainSeparator = ethers.keccak256("0xdeadbeef");
                const typeHash = ethers.keccak256("0xbaddad");
                // abi encode the message
                const encodeData = ethers.solidityPacked(
                    ["bytes32", "bytes32"],
                    [
                        ethers.keccak256("0xbaddadbaddadbaddadbaddadbaddadbaddad"),
                        ethers.keccak256("0xdeadbeefdeadbeefdeadbeefdeadbeefdead"),
                    ],
                );

                // set the revert verifier for the domain separator
                await executeContractCallWithSigners(
                    safe,
                    validator,
                    "setDomainVerifier",
                    [domainSeparator, await revertVerifier.getAddress()],
                    [user1, user2],
                );

                const [dataHash, encodedMessage] = encodeCustomVerifier(encodeData, domainSeparator, typeHash, "0xdeadbeef");

                // Test with a domain verifier - should revert with `GS021`
                await expect(validator.isValidSignature.staticCall(dataHash, encodedMessage)).to.be.revertedWith(
                    "0x" +
                        // function call for isValidSafeSignature
                        "53f00b14" +
                        "000000000000000000000000" +
                        (await safe.getAddress()).slice(2).toLowerCase() +
                        "000000000000000000000000" +
                        user1.address.slice(2).toLowerCase() +
                        dataHash.slice(2) +
                        domainSeparator.slice(2) +
                        typeHash.slice(2) +
                        "00000000000000000000000000000000000000000000000000000000000000e0" +
                        "0000000000000000000000000000000000000000000000000000000000000140" +
                        hre.ethers.AbiCoder.defaultAbiCoder().encode(["bytes"], [encodeData]).slice(66) +
                        "0000000000000000000000000000000000000000000000000000000000000004" +
                        "deadbeef00000000000000000000000000000000000000000000000000000000",
                );
            });

            it("should revert it trying to forge the domain separator", async () => {
                const { preconfiguredValidator } = await setupTests();
                const domainSeparator = ethers.keccak256("0xdeadbeef");
                const forgedDomainSeparator = ethers.keccak256("0xdeadbeefdeadbeef");
                const typeHash = ethers.keccak256("0xbaddad");
                // abi encode the message
                const encodeData = ethers.solidityPacked(
                    ["bytes32", "bytes32"],
                    [
                        ethers.keccak256("0xbaddadbaddadbaddadbaddadbaddadbaddad"),
                        ethers.keccak256("0xdeadbeefdeadbeefdeadbeefdeadbeefdead"),
                    ],
                );

                // calculate the hash of the message
                const dataHash = ethers.keccak256(
                    ethers.solidityPacked(
                        ["bytes1", "bytes1", "bytes32", "bytes32"],
                        [
                            "0x19",
                            "0x01",
                            forgedDomainSeparator,
                            ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes"], [typeHash, encodeData])),
                        ],
                    ),
                );

                // create the function fragment for the `safeSignature(bytes32,bytes32,bytes,bytes)` function
                const safeSignatureFragment = new ethers.Interface([`function safeSignature(bytes32,bytes32,bytes,bytes)`]);
                const encodedMessage = safeSignatureFragment.encodeFunctionData("safeSignature(bytes32,bytes32,bytes,bytes)", [
                    domainSeparator,
                    typeHash,
                    encodeData,
                    "0x",
                ]);

                // Test with a domain verifier - should return magic value
                await expect(preconfiguredValidator.isValidSignature.staticCall(dataHash, encodedMessage)).to.be.revertedWith("GS026");
            });

            it("should return magic value if signed by a domain verifier", async () => {
                const { validator, preconfiguredValidator } = await setupTests();
                const domainSeparator = ethers.keccak256("0xdeadbeef");
                const typeHash = ethers.keccak256("0xbaddad");
                // abi encode the message
                const encodeData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bytes32"],
                    [ethers.keccak256("0xbaddadbaddadbaddadbaddadbaddadbaddad")],
                );

                const [dataHash, encodedMessage] = encodeCustomVerifier(encodeData, domainSeparator, typeHash, "0x");

                // Test without a domain verifier - should revert with `GS026`
                await expect(validator.isValidSignature.staticCall(dataHash, encodedMessage)).to.be.revertedWith("GS026");

                // Test with a domain verifier - should return magic value
                expect(await preconfiguredValidator.isValidSignature.staticCall(dataHash, encodedMessage)).to.be.eq("0x1626ba7e");
            });
        });
    });

    describe("IERC165", () => {
        describe("supportsInterface(bytes4)", () => {
            it("should return true for ERC165", async () => {
                const { validator } = await setupTests();
                expect(await validator.supportsInterface.staticCall("0x01ffc9a7")).to.be.true;
            });
        });

        describe("setSupportedInterface(bytes4,bool)", () => {
            it("should revert if called by non-safe", async () => {
                const { handler } = await setupTests();
                await expect(handler.setSupportedInterface("0xdeadbeef", true)).to.be.revertedWith("only safe can call this method");
            });

            it("should revert if trying to set an invalid interface", async () => {
                const { user1, user2, validator, safe } = await setupTests();
                await expect(
                    executeContractCallWithSigners(safe, validator, "setSupportedInterface", ["0xffffffff", true], [user1, user2]),
                ).to.be.revertedWith("invalid interface id");
            });

            it("should emit event when adding a newly supported interface", async () => {
                const { user1, user2, validator, safe, handler } = await setupTests();
                await expect(executeContractCallWithSigners(safe, validator, "setSupportedInterface", ["0xdeadbeef", true], [user1, user2]))
                    .to.emit(handler, "AddedInterface")
                    .withArgs(await safe.getAddress(), "0xdeadbeef");
            });

            it("should emit event when removing a supported interface", async () => {
                const { user1, user2, handler, otherSafe, preconfiguredValidator } = await setupTests();

                await expect(
                    executeContractCallWithSigners(
                        otherSafe,
                        preconfiguredValidator,
                        "setSupportedInterface",
                        ["0xdeadbeef", false],
                        [user1, user2],
                    ),
                )
                    .to.emit(handler, "RemovedInterface")
                    .withArgs(await otherSafe.getAddress(), "0xdeadbeef");
            });

            it("should not emit event when removing an unsupported interface", async () => {
                const { user1, user2, handler, otherSafe, preconfiguredValidator } = await setupTests();

                await expect(
                    executeContractCallWithSigners(
                        otherSafe,
                        preconfiguredValidator,
                        "setSupportedInterface",
                        ["0xbeafdead", false],
                        [user1, user2],
                    ),
                ).to.not.emit(handler, "RemovedInterface");
            });
        });

        describe("addSupportedInterfaceBatch(bytes4, bytes32[]", () => {
            it("should revert if called by non-safe", async () => {
                const { handler } = await setupTests();
                await expect(handler.addSupportedInterfaceBatch("0xdeadbeef", [HashZero])).to.be.revertedWith(
                    "only safe can call this method",
                );
            });

            it("should revert if batch contains an invalid interface", async () => {
                const { user1, user2, validator, safe } = await setupTests();
                await expect(
                    executeContractCallWithSigners(
                        safe,
                        validator,
                        "addSupportedInterfaceBatch",
                        ["0xffffffff", [HashZero]],
                        [user1, user2],
                    ),
                ).to.be.revertedWith("interface id mismatch");
            });

            it("should add all handlers in batch", async () => {
                const { user1, user2, validator, safe, handler, mirror } = await setupTests();
                const safeAddress = await safe.getAddress();

                // calculate the selector for each function
                const selector1 = "0xabababab";
                const selector2 = "0xcdcdcdcd";
                const selector3 = "0xefefefef";

                // calculate the interface id which is the xor of all selectors
                const interfaceId = ethers.hexlify(ethers.toBeHex(BigInt(selector1) ^ BigInt(selector2) ^ BigInt(selector3)));

                // create the batch
                const mirrorAddress = await mirror.getAddress();
                const batch = [selector1, selector2, selector3].map((selector) => encodeHandlerFunction(true, selector, mirrorAddress));

                await expect(
                    executeContractCallWithSigners(safe, validator, "addSupportedInterfaceBatch", [interfaceId, batch], [user1, user2]),
                )
                    .to.emit(handler, "AddedSafeMethod")
                    .withArgs(safeAddress, "0xabababab", encodeHandler(true, mirrorAddress))
                    .to.emit(handler, "AddedSafeMethod")
                    .withArgs(safeAddress, "0xcdcdcdcd", encodeHandler(true, mirrorAddress))
                    .to.emit(handler, "AddedSafeMethod")
                    .withArgs(safeAddress, "0xefefefef", encodeHandler(true, mirrorAddress))
                    .to.emit(handler, "AddedInterface")
                    .withArgs(safeAddress, interfaceId);

                // check that the interface is supported
                expect(await validator.supportsInterface(interfaceId)).to.be.true;
            });
        });

        describe("removeSupportedInterfaceBatch(bytes4, bytes4[]", () => {
            it("should revert if called by non-safe", async () => {
                const { handler } = await setupTests();
                await expect(handler.removeSupportedInterfaceBatch("0xdeadbeef", ["0xdeadbeef"])).to.be.revertedWith(
                    "only safe can call this method",
                );
            });

            it("should remove all methods in a batch", async () => {
                const { user1, user2, validator, safe, handler, mirror } = await setupTests();
                const safeAddress = await safe.getAddress();

                // calculate the selector for each function
                const selector1 = "0xabababab";
                const selector2 = "0xcdcdcdcd";
                const selector3 = "0xefefefef";

                // calculate the interface id which is the xor of all selectors
                const interfaceId = ethers.hexlify(ethers.toBeHex(BigInt(selector1) ^ BigInt(selector2) ^ BigInt(selector3)));

                // create the batch
                const mirrorAddress = await mirror.getAddress();
                const batch = [selector1, selector2, selector3].map((selector) => encodeHandlerFunction(true, selector, mirrorAddress));

                await expect(
                    executeContractCallWithSigners(safe, validator, "addSupportedInterfaceBatch", [interfaceId, batch], [user1, user2]),
                )
                    .to.emit(handler, "AddedSafeMethod")
                    .withArgs(safeAddress, "0xabababab", encodeHandler(true, mirrorAddress))
                    .to.emit(handler, "AddedSafeMethod")
                    .withArgs(safeAddress, "0xcdcdcdcd", encodeHandler(true, mirrorAddress))
                    .to.emit(handler, "AddedSafeMethod")
                    .withArgs(safeAddress, "0xefefefef", encodeHandler(true, mirrorAddress))
                    .to.emit(handler, "AddedInterface")
                    .withArgs(safeAddress, interfaceId);

                // check that the interface is supported
                expect(await validator.supportsInterface(interfaceId)).to.be.true;

                // remove the interface with the incorrect interfaceId
                await expect(
                    executeContractCallWithSigners(
                        safe,
                        validator,
                        "removeSupportedInterfaceBatch",
                        ["0xdeadbeef", [selector1, selector2, selector3]],
                        [user1, user2],
                    ),
                ).to.be.revertedWith("interface id mismatch");

                // remove the interface
                await expect(
                    executeContractCallWithSigners(
                        safe,
                        validator,
                        "removeSupportedInterfaceBatch",
                        [interfaceId, [selector1, selector2, selector3]],
                        [user1, user2],
                    ),
                )
                    .to.emit(handler, "RemovedSafeMethod")
                    .withArgs(safeAddress, "0xabababab")
                    .to.emit(handler, "RemovedSafeMethod")
                    .withArgs(safeAddress, "0xcdcdcdcd")
                    .to.emit(handler, "RemovedSafeMethod")
                    .withArgs(safeAddress, "0xefefefef")
                    .to.emit(handler, "RemovedInterface")
                    .withArgs(safeAddress, interfaceId);

                // check that the interface is no longer supported
                expect(await validator.supportsInterface(interfaceId)).to.be.false;
            });
        });
    });
});
