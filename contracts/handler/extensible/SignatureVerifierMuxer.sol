// SPDX-License-Identifier: LGPL-3.0-only
// solhint-disable one-contract-per-file
pragma solidity >=0.7.0 <0.9.0;

import {ISafe, ExtensibleBase} from "./ExtensibleBase.sol";

interface ERC1271 {
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4 magicValue);
}

/**
 * @title Safe Signature Verifier Interface
 * @author mfw78 <mfw78@rndlabs.xyz>
 * @notice This interface provides a standard for external contracts that verify signatures
 *         for a Safe.
 */
interface ISafeSignatureVerifier {
    /**
     * @dev If called by `SignatureVerifierMuxer`, the following has already been checked:
     *      _hash = h(abi.encodePacked("\x19\x01", domainSeparator, h(typeHash || encodeData)));
     * @param safe The Safe that has delegated the signature verification
     * @param sender The address that originally called the Safe's `isValidSignature` method
     * @param _hash The EIP-712 hash whose signature will be verified
     * @param domainSeparator The EIP-712 domainSeparator
     * @param typeHash The EIP-712 typeHash
     * @param encodeData The EIP-712 encoded data
     * @param payload An arbitrary payload that can be used to pass additional data to the verifier
     * @return magic The magic value that should be returned if the signature is valid (0x1626ba7e)
     */
    function isValidSafeSignature(
        ISafe safe,
        address sender,
        bytes32 _hash,
        bytes32 domainSeparator,
        bytes32 typeHash,
        bytes calldata encodeData,
        bytes calldata payload
    ) external view returns (bytes4 magic);
}

interface ISignatureVerifierMuxer {
    function domainVerifiers(ISafe safe, bytes32 domainSeparator) external view returns (ISafeSignatureVerifier);

    function setDomainVerifier(bytes32 domainSeparator, ISafeSignatureVerifier verifier) external;
}

/**
 * @title ERC-1271 Signature Verifier Multiplexer (Muxer)
 * @author mfw78 <mfw78@rndlabs.xyz>
 * @notice Allows delegating EIP-712 domains to an arbitrary `ISafeSignatureVerifier`
 * @dev This multiplexer enforces a strict authorisation per domainSeparator. This is to prevent a malicious
 *     `ISafeSignatureVerifier` from being able to verify signatures for any domainSeparator. This does not prevent
 *      an `ISafeSignatureVerifier` from being able to verify signatures for multiple domainSeparators, however
 *      each domainSeparator requires specific approval by Safe.
 */
abstract contract SignatureVerifierMuxer is ExtensibleBase, ERC1271, ISignatureVerifierMuxer {
    // --- constants ---
    // keccak256("SafeMessage(bytes message)");
    bytes32 private constant SAFE_MSG_TYPEHASH = 0x60b3cbf8b4a223d68d641b3b6ddf9a298e7f33710cf3d3a9d1146b5a6150fbca;
    // keccak256("safeSignature(bytes32,bytes32,bytes,bytes)");
    bytes4 private constant SAFE_SIGNATURE_MAGIC_VALUE = 0x5fd7e97d;

    // --- storage ---
    mapping(ISafe => mapping(bytes32 => ISafeSignatureVerifier)) public override domainVerifiers;

    // --- events ---
    event AddedDomainVerifier(ISafe indexed safe, bytes32 domainSeparator, ISafeSignatureVerifier verifier);
    event ChangedDomainVerifier(
        ISafe indexed safe,
        bytes32 domainSeparator,
        ISafeSignatureVerifier oldVerifier,
        ISafeSignatureVerifier newVerifier
    );
    event RemovedDomainVerifier(ISafe indexed safe, bytes32 domainSeparator);

    /**
     * Setter for the signature muxer
     * @param domainSeparator The domainSeparator authorised for the `ISafeSignatureVerifier`
     * @param newVerifier A contract that implements `ISafeSignatureVerifier`
     */
    function setDomainVerifier(bytes32 domainSeparator, ISafeSignatureVerifier newVerifier) public override onlySelf {
        ISafe safe = ISafe(payable(_msgSender()));
        ISafeSignatureVerifier oldVerifier = domainVerifiers[safe][domainSeparator];
        if (address(newVerifier) == address(0) && address(oldVerifier) != address(0)) {
            delete domainVerifiers[safe][domainSeparator];
            emit RemovedDomainVerifier(safe, domainSeparator);
        } else {
            domainVerifiers[safe][domainSeparator] = newVerifier;
            if (address(oldVerifier) == address(0)) {
                emit AddedDomainVerifier(safe, domainSeparator, newVerifier);
            } else {
                emit ChangedDomainVerifier(safe, domainSeparator, oldVerifier, newVerifier);
            }
        }
    }

    /**
     * @notice Implements ERC1271 interface for smart contract EIP-712 signature validation
     * @dev The signature format is the same as the one used by the Safe contract
     * @param _hash Hash of the data that is signed
     * @param signature The signature to be verified
     * @return magic Standardised ERC1271 return value
     */
    function isValidSignature(bytes32 _hash, bytes calldata signature) external view override returns (bytes4 magic) {
        (ISafe safe, address sender) = _getContext();

        // Check if the signature is for an `ISafeSignatureVerifier` and if it is valid for the domain.
        if (signature.length >= 4) {
            bytes4 sigSelector;
            /* solhint-disable no-inline-assembly */
            /// @solidity memory-safe-assembly
            assembly {
                sigSelector := calldataload(signature.offset)
            }
            /* solhint-enable no-inline-assembly */

            // Guard against short signatures that would cause abi.decode to revert.
            if (sigSelector == SAFE_SIGNATURE_MAGIC_VALUE && signature.length >= 68) {
                // Signature is for an `ISafeSignatureVerifier` - decode the signature.
                // Layout of the `signature`:
                // 0x00 to 0x04: selector
                // 0x04 to 0x36: domainSeparator
                // 0x36 to 0x68: typeHash
                // 0x68 to 0x88: encodeData length
                // 0x88 to 0x88 + encodeData length: encodeData
                // 0x88 + encodeData length to 0x88 + encodeData length + 0x20: payload length
                // 0x88 + encodeData length + 0x20 to end: payload
                //
                // Get the domainSeparator from the signature.
                (bytes32 domainSeparator, bytes32 typeHash) = abi.decode(signature[4:68], (bytes32, bytes32));

                ISafeSignatureVerifier verifier = domainVerifiers[safe][domainSeparator];
                // Check if there is an `ISafeSignatureVerifier` for the domain.
                if (address(verifier) != address(0)) {
                    (, , bytes memory encodeData, bytes memory payload) = abi.decode(signature[4:], (bytes32, bytes32, bytes, bytes));

                    // Check that the signature is valid for the domain.
                    if (keccak256(EIP712.encodeMessageData(domainSeparator, typeHash, encodeData)) == _hash) {
                        // Preserving the context, call the Safe's authorised `ISafeSignatureVerifier` to verify.
                        return verifier.isValidSafeSignature(safe, sender, _hash, domainSeparator, typeHash, encodeData, payload);
                    }
                }
            }
        }

        // domainVerifier doesn't exist or the signature is invalid for the domain - fall back to the default
        return defaultIsValidSignature(safe, _hash, signature);
    }

    /**
     * Default Safe signature validation (approved hashes/threshold signatures)
     * @param safe The safe being asked to validate the signature
     * @param _hash Hash of the data that is signed
     * @param signature The signature to be verified
     */
    function defaultIsValidSignature(ISafe safe, bytes32 _hash, bytes memory signature) internal view returns (bytes4 magic) {
        bytes memory messageData = EIP712.encodeMessageData(
            safe.domainSeparator(),
            SAFE_MSG_TYPEHASH,
            abi.encode(keccak256(abi.encode(_hash)))
        );
        bytes32 messageHash = keccak256(messageData);
        if (signature.length == 0) {
            // approved hashes
            require(safe.signedMessages(messageHash) != 0, "Hash not approved");
        } else {
            // threshold signatures
            safe.checkSignatures(address(0), messageHash, signature);
        }
        magic = ERC1271.isValidSignature.selector;
    }
}

library EIP712 {
    function encodeMessageData(bytes32 domainSeparator, bytes32 typeHash, bytes memory message) internal pure returns (bytes memory) {
        return abi.encodePacked(bytes1(0x19), bytes1(0x01), domainSeparator, keccak256(abi.encodePacked(typeHash, message)));
    }
}
