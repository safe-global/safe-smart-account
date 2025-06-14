// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {ISafe} from "./../interfaces/ISafe.sol";
import {ISignatureValidator} from "./../interfaces/ISignatureValidator.sol";
import {Enum} from "./../libraries/Enum.sol";
import {EIP712Constants} from "./../libraries/EIP712Constants.sol";
import {TokenCallbackHandler} from "./TokenCallbackHandler.sol";

/**
 * @title Compatibility Fallback Handler
 * @notice Provides compatibility between pre 1.3.0 and 1.3.0+ Safe smart account contracts.
 * @dev ⚠️⚠️⚠️ This contract is only intended for being used as a fallback handler for a {Safe}.
 *      Using it in other ways may cause undefined behavior. ⚠️⚠️⚠️
 * @author Richard Meissner - @rmeissner
 */
contract CompatibilityFallbackHandler is TokenCallbackHandler, ISignatureValidator {
    /**
     * @dev The sentinel module value in the {ModuleManager.modules} linked list.
     *      See {ModuleManager.SENTINEL_MODULES} for more information.
     */
    address internal constant SENTINEL_MODULES = address(0x1);

    /**
     * @notice Returns the hash of a message to be signed by owners.
     * @dev This function assumes that the caller is a Safe contract.
     * @param message Raw message bytes.
     * @return Message hash.
     */
    function getMessageHash(bytes memory message) public view returns (bytes32) {
        return getMessageHashForSafe(ISafe(payable(msg.sender)), message);
    }

    /**
     * @dev Returns the pre-image of the message hash (see {getMessageHashForSafe}).
     * @param safe Safe to which the message is targeted.
     * @param message Message that should be encoded.
     * @return Encoded message.
     */
    function encodeMessageDataForSafe(ISafe safe, bytes memory message) public view returns (bytes memory) {
        bytes32 safeMessageHash = keccak256(abi.encode(EIP712Constants.SAFE_MSG_TYPEHASH, keccak256(message)));
        return abi.encodePacked(bytes1(0x19), bytes1(0x01), safe.domainSeparator(), safeMessageHash);
    }

    /**
     * @dev Returns the hash of a message that can be signed by owners.
     * @param safe Safe to which the message is targeted.
     * @param message Message that should be hashed.
     * @return Message hash.
     */
    function getMessageHashForSafe(ISafe safe, bytes memory message) public view returns (bytes32) {
        return keccak256(encodeMessageDataForSafe(safe, message));
    }

    /**
     * @notice Implementation of the EIP-1271 signature validation method.
     * @dev This implementation verifies signatures for a `ISafe(msg.sender)`.
     * @param _dataHash Hash of the data signed.
     * @param _signature Signature data.
     * @return The EIP-1271 magic value if the signature is valid, reverts otherwise.
     */
    function isValidSignature(bytes32 _dataHash, bytes calldata _signature) public view override returns (bytes4) {
        // Caller should be a Safe.
        ISafe safe = ISafe(payable(msg.sender));
        bytes memory messageData = encodeMessageDataForSafe(safe, abi.encode(_dataHash));
        bytes32 messageHash = keccak256(messageData);
        if (_signature.length == 0) {
            require(safe.signedMessages(messageHash) != 0, "Hash not approved");
        } else {
            // We explicitly do not allow caller approved signatures for EIP-1271 to prevent unexpected behaviour. This
            // is done by setting the executor address to `0` which can never be an owner of the Safe.
            safe.checkSignatures(address(0), messageHash, _signature);
        }
        return EIP1271_MAGIC_VALUE;
    }

    /**
     * @dev Returns array of first 10 modules.
     * @return Array of modules.
     */
    function getModules() external view returns (address[] memory) {
        // Caller should be a Safe.
        ISafe safe = ISafe(payable(msg.sender));
        (address[] memory array, ) = safe.getModulesPaginated(SENTINEL_MODULES, 10);
        return array;
    }

    /**
     * @notice Performs a `DELEGATECALL` to a `targetContract` in the context of self.
     * @dev Internally reverts execution to avoid side effects (making it effectively static).
     *      Catches the internal revert and returns encoded result as bytes.
     *      Inspired by <https://github.com/gnosis/util-contracts/blob/bb5fe5fb5df6d8400998094fb1b32a178a47c3a1/contracts/StorageAccessible.sol>.
     *      ⚠️⚠️⚠️ This function assumes the caller is a Safe contract is only intended for being used as a fallback handler for a {Safe}.
     *      Using it in other ways may cause undefined behavior. ⚠️⚠️⚠️
     * @param targetContract Address of the contract containing the code to execute.
     * @param calldataPayload Calldata that should be sent to the target contract (encoded method name and arguments).
     */
    function simulate(address targetContract, bytes calldata calldataPayload) external returns (bytes memory response) {
        // Suppress compiler warnings about not using parameters, while allowing
        // parameters to keep names for documentation purposes. This does not
        // generate code.
        targetContract;
        calldataPayload;

        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            let ptr := mload(0x40)
            // Store `simulateAndRevert.selector`.
            // String representation is used to force right padding.
            mstore(ptr, "\xb4\xfa\xba\x09")

            // Abuse the fact that both this and the internal methods have the
            // same signature, and differ only in symbol name (and therefore,
            // selector) and copy calldata directly. This saves us approximately
            // 250 bytes of code and 300 gas at runtime over the
            // `abi.encodeWithSelector` builtin.
            calldatacopy(add(ptr, 0x04), 0x04, sub(calldatasize(), 0x04))

            let success := call(
                gas(),
                // `address()` has been changed to `caller()` to use the
                // implementation of the calling Safe.
                caller(),
                0,
                ptr,
                calldatasize(),
                // The `simulateAndRevert` call should always reverts, and
                // instead encodes whether or not it was successful in the
                // return data. The first 32-byte word of the return data
                // contains the `success` value, and the second 32-byte word
                // contains the response bytes length, so write them to memory
                // address 0x00 (Solidity scratch which is OK to use).
                0x00,
                0x40
            )

            // Double check that the call reverted as expected, and that the
            // `returndata` is long enough to hold the encoded success boolean
            // and response bytes length (64 bytes total). This will always be
            // the case if the caller is a Safe, but check anyway to make sure
            // this function does not make unexpected state changes when
            // called by other contracts.
            if or(success, lt(returndatasize(), 0x40)) {
                revert(0, 0)
            }

            // Allocate and copy the response bytes, making sure to increment
            // the free memory pointer accordingly (in case this method is
            // called as an internal function). The remaining `returndata[0x20:]`
            // contains the ABI encoded response bytes, so we can just copy it
            // as is to memory. Note that `returndatacopy` will revert if we
            // try to copy past the `returndatasize` bounds, so we don't need an
            // additional check here. However, do note that this will consume
            // all remaining gas. This is fine (since we don't aim to support
            // other callers that aren't Safes with the compatibility fallback
            // handler).
            let responseEncodedSize := add(mload(0x20), 0x20)
            response := mload(0x40)
            mstore(0x40, add(response, responseEncodedSize))
            returndatacopy(response, 0x20, responseEncodedSize)

            if iszero(mload(0x00)) {
                revert(add(response, 0x20), responseEncodedSize)
            }
        }
        /* solhint-enable no-inline-assembly */
    }

    /**
     * @notice Returns the pre-image of the Safe transaction hash (see {Safe.getTransactionHash}).
     * @dev This method is added to the {CompatibilityFallbackHandler} for backwards compatibility with previous versions of Safe.
     *      For a given Safe, the invariant `getTransactionHash(...) == keccak256(encodeTransactionData(...))` holds true.
     * @param to Destination address of the Safe transaction.
     * @param value Native token value of the Safe transaction.
     * @param data Data payload of the Safe transaction.
     * @param operation Operation type of the Safe transaction: 0 for `CALL` and 1 for `DELEGATECALL`.
     * @param safeTxGas Gas that should be used for the Safe transaction.
     * @param baseGas Base gas costs that are independent of the transaction execution (e.g. base transaction fee, signature check, payment of the refund).
     * @param gasPrice Gas price that should be used for the payment calculation.
     * @param gasToken Token address (or 0 for the native token) that is used for the payment.
     * @param refundReceiver Address of receiver of the gas payment (or 0 for `tx.origin`).
     * @param nonce Transaction nonce.
     * @return Transaction hash pre-image bytes.
     */
    function encodeTransactionData(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 nonce
    ) public view returns (bytes memory) {
        // Caller should be a Safe.
        ISafe safe = ISafe(payable(msg.sender));
        bytes32 domainSeparator = safe.domainSeparator();
        bytes32 safeTxHash = keccak256(
            abi.encode(
                EIP712Constants.SAFE_TX_TYPEHASH,
                to,
                value,
                keccak256(data),
                operation,
                safeTxGas,
                baseGas,
                gasPrice,
                gasToken,
                refundReceiver,
                nonce
            )
        );
        return abi.encodePacked(bytes1(0x19), bytes1(0x01), domainSeparator, safeTxHash);
    }
}
