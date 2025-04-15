// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Signature Decoder
 * @notice Decodes encoded packed signatures bytes.
 * @author Richard Meissner - @rmeissner
 */
abstract contract SignatureDecoder {
    /**
     * @notice Splits signature bytes into its `v`, `r` and `s` components, starting from `pos`.
     * @dev Make sure to perform a bounds check for `pos`, to avoid out of bounds access on `signatures`.
     *      The signature format is a compact form of `r:bytes32 || s:bytes32 || v:uint8`,
     *      where `v` is a single byte and not padded to 32 bytes.
     * @param pos Position to start reading the packed signature components.
     *            Bounds check that `signatures[pos:pos+65]` is valid must be performed by the caller.
     * @param signatures Encoded packed signatures bytes.
     * @return v Recovery ID or Safe signature type.
     * @return r Output value r of the signature.
     * @return s Output value s of the signature.
     */
    function signatureSplit(bytes memory signatures, uint256 pos) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            let signaturePos := mul(0x41, pos)
            r := mload(add(signatures, add(signaturePos, 0x20)))
            s := mload(add(signatures, add(signaturePos, 0x40)))
            v := byte(0, mload(add(signatures, add(signaturePos, 0x60))))
        }
        /* solhint-enable no-inline-assembly */
    }
}
