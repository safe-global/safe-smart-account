// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {ISafe, EIP712, ISafeSignatureVerifier} from "../handler/extensible/SignatureVerifierMuxer.sol";

/**
 * @title TestSafeSignatureVerifier - A simple test contract that implements the ISafeSignatureVerifier interface
 */
contract TestSafeSignatureVerifier is ISafeSignatureVerifier {
    /**
     * Validates a signature for a Safe.
     * @param _hash of the message to verify
     * @param domainSeparator of the message to verify
     * @param typeHash of the message to verify
     * @param encodeData of the message to verify
     * @return magic The magic value that should be returned if the signature is valid (0x1626ba7e)
     */
    function isValidSafeSignature(
        ISafe,
        address,
        bytes32 _hash,
        bytes32 domainSeparator,
        bytes32 typeHash,
        bytes calldata encodeData,
        bytes calldata
    ) external pure override returns (bytes4 magic) {
        if (_hash == keccak256(EIP712.encodeMessageData(domainSeparator, typeHash, encodeData))) {
            return 0x1626ba7e;
        }
    }
}
