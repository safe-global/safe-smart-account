// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title EIP-712 Constants Library
 * @notice Contains precomputed EIP-712 type hashes used across Safe contracts.
 * @dev These constants are used for EIP-712 structured data hashing and signing.
 */
library EIP712Constants {
    /**
     * @dev The precomputed EIP-712 type hash for the domain separator.
     *      Precomputed value of: `keccak256("EIP712Domain(uint256 chainId,address verifyingContract)")`.
     */
    bytes32 internal constant DOMAIN_SEPARATOR_TYPEHASH = 0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218;

    /**
     * @dev The precomputed EIP-712 type hash for the Safe message type.
     *      Precomputed value of: `keccak256("SafeMessage(bytes message)")`.
     */
    bytes32 internal constant SAFE_MSG_TYPEHASH = 0x60b3cbf8b4a223d68d641b3b6ddf9a298e7f33710cf3d3a9d1146b5a6150fbca;

    /**
     * @dev The precomputed EIP-712 type hash for the Safe transaction type.
     *      Precomputed value of: `keccak256("SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)")`.
     */
    bytes32 internal constant SAFE_TX_TYPEHASH = 0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8;
}
