// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "./TokenCallbackHandler.sol";
import "../interfaces/ISignatureValidator.sol";
import "../Safe.sol";
import "./HandlerContext.sol";

/**
 * @title Compatibility Fallback Handler - Provides compatibility between pre 1.3.0 and 1.3.0+ Safe contracts.
 * @author Richard Meissner - @rmeissner
 */
contract CompatibilityFallbackHandler is TokenCallbackHandler, ISignatureValidator, HandlerContext {
    // keccak256("SafeMessage(bytes message)");
    bytes32 private constant SAFE_MSG_TYPEHASH = 0x60b3cbf8b4a223d68d641b3b6ddf9a298e7f33710cf3d3a9d1146b5a6150fbca;

    bytes4 internal constant SIMULATE_SELECTOR = bytes4(keccak256("simulate(address,bytes)"));

    address internal constant SENTINEL_MODULES = address(0x1);

    /**
     * @dev Returns the hash of a message to be signed by owners.
     * @param message Raw message bytes.
     * @return Message hash.
     */
    function getMessageHash(bytes memory message) public view returns (bytes32) {
        return getMessageHashForSafe(Safe(payable(msg.sender)), message);
    }

    /**
     * @dev Returns the pre-image of the message hash (see getMessageHashForSafe).
     * @param safe Safe to which the message is targeted.
     * @param message Message that should be encoded.
     * @return Encoded message.
     */
    function encodeMessageDataForSafe(Safe safe, bytes memory message) public view returns (bytes memory) {
        bytes32 safeMessageHash = keccak256(abi.encode(SAFE_MSG_TYPEHASH, keccak256(message)));
        return abi.encodePacked(bytes1(0x19), bytes1(0x01), safe.domainSeparator(), safeMessageHash);
    }

    /**
     * @dev Returns hash of a message that can be signed by owners.
     * @param safe Safe to which the message is targeted.
     * @param message Message that should be hashed.
     * @return Message hash.
     */
    function getMessageHashForSafe(Safe safe, bytes memory message) public view returns (bytes32) {
        return keccak256(encodeMessageDataForSafe(safe, message));
    }

    /**
     * @notice Implementation of updated EIP-1271 signature validation method.
     * @param _dataHash Hash of the data signed on the behalf of address(msg.sender)
     * @param _signature Signature byte array associated with _dataHash
     * @return Updated EIP1271 magic value if signature is valid, otherwise 0x0
     */
    function isValidSignature(bytes32 _dataHash, bytes calldata _signature) public view override returns (bytes4) {
        // Caller should be a Safe
        Safe safe = Safe(payable(msg.sender));
        bytes memory messageData = encodeMessageDataForSafe(safe, abi.encode(_dataHash));
        bytes32 messageHash = keccak256(messageData);
        if (_signature.length == 0) {
            require(safe.signedMessages(messageHash) != 0, "Hash not approved");
        } else {
            safe.checkSignatures(messageHash, messageData, _signature);
        }
        return EIP1271_MAGIC_VALUE;
    }

    /**
     * @dev Returns array of first 10 modules.
     * @return Array of modules.
     */
    function getModules() external view returns (address[] memory) {
        // Caller should be a Safe
        Safe safe = Safe(payable(msg.sender));
        (address[] memory array, ) = safe.getModulesPaginated(SENTINEL_MODULES, 10);
        return array;
    }

    /**
     * @dev Performs a delegatecall on a targetContract in the context of self.
     * Internally reverts execution to avoid side effects (making it static). Catches revert and returns encoded result as bytes.
     * @dev Inspired by https://github.com/gnosis/util-contracts/blob/bb5fe5fb5df6d8400998094fb1b32a178a47c3a1/contracts/StorageAccessible.sol
     * @param targetContract Address of the contract containing the code to execute.
     * @param calldataPayload Calldata that should be sent to the target contract (encoded method name and arguments).
     */
    function simulate(address targetContract, bytes calldata calldataPayload) external returns (bytes memory response) {
        /**
         * Suppress compiler warnings about not using parameters, while allowing
         * parameters to keep names for documentation purposes. This does not
         * generate code.
         */
        targetContract;
        calldataPayload;

        // solhint-disable-next-line no-inline-assembly
        /// @solidity memory-safe-assembly
        assembly {
            let internalCalldata := mload(0x40)
            /**
             * Store `simulateAndRevert.selector`.
             * String representation is used to force right padding
             */
            mstore(internalCalldata, "\xb4\xfa\xba\x09")
            /**
             * Abuse the fact that both this and the internal methods have the
             * same signature, and differ only in symbol name (and therefore,
             * selector) and copy calldata directly. This saves us approximately
             * 250 bytes of code and 300 gas at runtime over the
             * `abi.encodeWithSelector` builtin.
             */
            calldatacopy(add(internalCalldata, 0x04), 0x04, sub(calldatasize(), 0x04))

            /**
             * `pop` is required here by the compiler, as top level expressions
             * can't have return values in inline assembly. `call` typically
             * returns a 0 or 1 value indicated whether or not it reverted, but
             * since we know it will always revert, we can safely ignore it.
             */
            pop(
                call(
                    gas(),
                    // address() has been changed to caller() to use the implementation of the Safe
                    caller(),
                    0,
                    internalCalldata,
                    calldatasize(),
                    /**
                     * The `simulateAndRevert` call always reverts, and
                     * instead encodes whether or not it was successful in the return
                     * data. The first 32-byte word of the return data contains the
                     * `success` value, so write it to memory address 0x00 (which is
                     * reserved Solidity scratch space and OK to use).
                     */
                    0x00,
                    0x20
                )
            )

            /**
             * Allocate and copy the response bytes, making sure to increment
             * the free memory pointer accordingly (in case this method is
             * called as an internal function). The remaining `returndata[0x20:]`
             * contains the ABI encoded response bytes, so we can just write it
             * as is to memory.
             */
            let responseSize := sub(returndatasize(), 0x20)
            response := mload(0x40)
            mstore(0x40, add(response, responseSize))
            returndatacopy(response, 0x20, responseSize)

            if iszero(mload(0x00)) {
                revert(add(response, 0x20), mload(response))
            }
        }
    }

    /**
     * @notice Checks whether the signature provided is valid for the provided data and hash. Reverts otherwise.
     * @dev Since the EIP-1271 does an external call, be mindful of reentrancy attacks.
     *      The function was moved to the fallback handler as a part of
     *      1.5.0 contract upgrade. It used to be a part of the Safe core contract, but
     *      was replaced by the same function that accepts the executor as a parameter.
     * @param dataHash Hash of the data (could be either a message hash or transaction hash)
     * @param signatures Signature data that should be verified.
     *                   Can be packed ECDSA signature ({bytes32 r}{bytes32 s}{uint8 v}), contract signature (EIP-1271) or approved hash.
     * @param requiredSignatures Amount of required valid signatures.
     */
    function checkNSignatures(bytes32 dataHash, bytes memory, bytes memory signatures, uint256 requiredSignatures) public view {
        Safe(payable(_manager())).checkNSignatures(_msgSender(), dataHash, "", signatures, requiredSignatures);
    }
}
