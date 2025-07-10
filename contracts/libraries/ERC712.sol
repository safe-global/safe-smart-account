// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {Enum} from "./Enum.sol";

/**
 * @title Safe EIP-712 Library
 * @notice Contains EIP-712 functions for the Safe smart account.
 * @dev Provides constants and hashing functions for Safe-related typed data.
 */
library ERC712 {
    /**
     * @notice Returns the Safe transaction hash to be signed by owners.
     * @param domainSeparator The domain separator hash.
     * @param to Destination address.
     * @param value Ether value.
     * @param data Data payload.
     * @param operation Operation type.
     * @param safeTxGas Gas that should be used for the safe transaction.
     * @param baseGas Gas costs for data used to trigger the safe transaction.
     * @param gasPrice Maximum gas price that should be used for this transaction.
     * @param gasToken Token address (or 0 if ETH) that is used for the payment.
     * @param refundReceiver Address of receiver of gas payment (or 0 if tx.origin).
     * @param nonce Transaction nonce.
     * @return txHash Transaction hash.
     */
    function getSafeTransactionHash(
        bytes32 domainSeparator,
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
    ) internal pure returns (bytes32 txHash) {
        // We opted for using assembly code here, because the way Solidity compiler we use (0.7.6) allocates memory is
        // inefficient. We do not need to allocate memory for temporary variables to be used in the keccak256 call.
        //
        // WARNING: We do not clean potential dirty bits in types that are less than 256 bits (addresses and Enum.Operation)
        // The solidity assembly types that are smaller than 256 bit can have dirty high bits according to the spec (see the Warning in https://docs.soliditylang.org/en/latest/assembly.html#access-to-external-variables-functions-and-libraries).
        // However, we read most of the data from calldata, where the variables are not packed, and the only variable we read from storage is uint256 nonce.
        // This is not a problem, however, we must consider this for potential future changes.
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            // Get the free memory pointer
            let ptr := mload(0x40)

            // Step 1: Hash the transaction data
            // Copy transaction data to memory and hash it
            calldatacopy(ptr, data.offset, data.length)
            let calldataHash := keccak256(ptr, data.length)

            // Step 2: Prepare the SafeTX struct for hashing
            // Layout in memory:
            // ptr +   0: SAFE_TX_TYPEHASH (constant defining the struct hash)
            // ptr +  32: to address
            // ptr +  64: value
            // ptr +  96: calldataHash
            // ptr + 128: operation
            // ptr + 160: safeTxGas
            // ptr + 192: baseGas
            // ptr + 224: gasPrice
            // ptr + 256: gasToken
            // ptr + 288: refundReceiver
            // ptr + 320: nonce
            mstore(ptr, SAFE_TX_TYPEHASH)
            mstore(add(ptr, 32), to)
            mstore(add(ptr, 64), value)
            mstore(add(ptr, 96), calldataHash)
            mstore(add(ptr, 128), operation)
            mstore(add(ptr, 160), safeTxGas)
            mstore(add(ptr, 192), baseGas)
            mstore(add(ptr, 224), gasPrice)
            mstore(add(ptr, 256), gasToken)
            mstore(add(ptr, 288), refundReceiver)
            mstore(add(ptr, 320), nonce)

            // Step 3: Calculate the final EIP-712 hash
            // First, hash the SafeTX struct (352 bytes total length)
            mstore(add(ptr, 64), keccak256(ptr, 352))
            // Store the EIP-712 prefix (0x1901), note that integers are left-padded
            // so the EIP-712 encoded data starts at add(ptr, 30)
            mstore(ptr, 0x1901)
            // Store the domain separator
            mstore(add(ptr, 32), domainSeparator)
            // Calculate the hash
            txHash := keccak256(add(ptr, 30), 66)
        }
        /* solhint-enable no-inline-assembly */
    }

    /**
     * @notice Returns the Safe message hash to be signed by owners.
     * @param domainSeparator The domain separator hash.
     * @param message The message bytes.
     * @return Message hash.
     */
    function getSafeMessageHash(bytes32 domainSeparator, bytes memory message) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(bytes2(0x1901), domainSeparator, keccak256(abi.encode(SAFE_MSG_TYPEHASH, keccak256(message)))));
    }

    /**
     * @notice Gets the ERC-712 hash for the given domain and data.
     * @param domainSeparator The domain separator hash.
     * @param typeHash The type hash of the data.
     * @param data The ERC-712 encoded data.
     * @return The ERC-712 data hash.
     */
    function getHash(bytes32 domainSeparator, bytes32 typeHash, bytes memory data) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(bytes2(0x1901), domainSeparator, keccak256(abi.encodePacked(typeHash, data))));
    }
}

/**
 * @dev The EIP-712 type hash for the Safe transaction type.
 *      Precomputed value of: `keccak256("SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)")`.
 */
bytes32 constant SAFE_TX_TYPEHASH = 0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8;

/**
 * @dev The EIP-712 type hash for the Safe message type.
 *      Precomputed value of: `keccak256("SafeMessage(bytes message)")`.
 */
bytes32 constant SAFE_MSG_TYPEHASH = 0x60b3cbf8b4a223d68d641b3b6ddf9a298e7f33710cf3d3a9d1146b5a6150fbca;
