// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Signature Validator Constants
 */
abstract contract ISignatureValidatorConstants {
    /**
     * @dev The EIP-1271 magic value indicating a valid signature.
     *      Precomputed value of: `bytes4(keccak256("isValidSignature(bytes32,bytes)")`.
     */
    bytes4 internal constant EIP1271_MAGIC_VALUE = 0x1626ba7e;
}

/**
 * @title Signature Validator
 */
abstract contract ISignatureValidator is ISignatureValidatorConstants {
    /**
     * @notice EIP-1271 method to validate a signature.
     * @dev MUST return the {bytes4} magic value `0x1626ba7e` when function passes.
     *      MUST NOT modify state.
     *      MUST allow external calls.
     * @param _hash Hash of the data signed on behalf of the address(this).
     * @param _signature Signature byte array associated with _data.
     * @return The `EIP1271_MAGIC_VALUE` if the signature is valid.
     *         Reverting or returning any other value indicates an invalid signature.
     */
    function isValidSignature(bytes32 _hash, bytes memory _signature) external view virtual returns (bytes4);
}
