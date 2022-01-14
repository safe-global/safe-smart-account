// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

contract IEIP1271UpdatedSignatureValidatorConstants {
    // bytes4(keccak256("isValidSignature(bytes32,bytes)")
    bytes4 internal constant EIP1271_UPDATED_MAGIC_VALUE = 0x1626ba7e;
}

abstract contract IEIP1271UpdatedSignatureValidator is IEIP1271UpdatedSignatureValidatorConstants {
    /**
     * Implementation of updated EIP-1271
     * @dev Should return whether the signature provided is valid for the provided data
     * @param _data Hash of the data signed on the behalf of address(this)
     * @param _signature Signature byte array associated with _data
     *
     * MUST return the bytes4 magic value 0x1626ba7e when function passes.
     * MUST NOT modify state (using STATICCALL for solc < 0.5, view modifier for solc > 0.5)
     * MUST allow external calls
     */
    function isValidSignature(bytes32 _data, bytes memory _signature) public view virtual returns (bytes4);
}
