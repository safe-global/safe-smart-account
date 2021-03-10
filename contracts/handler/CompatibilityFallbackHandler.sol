// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.8.0;

import "./DefaultCallbackHandler.sol";
import "../interfaces/ISignatureValidator.sol";
import "../GnosisSafe.sol";


/// @title Compatibility Fallback Handler - fallback handler to provider compatibility between pre 1.3.0 and 1.3.0+ Safe contracts
/// @author Richard Meissner - <richard@gnosis.pm>
contract CompatibilityFallbackHandler is DefaultCallbackHandler, ISignatureValidator {
    

    /**
    * Implementation of ISignatureValidator (see `interfaces/ISignatureValidator.sol`)
    * @dev Should return whether the signature provided is valid for the provided data.
    *       The save does not implement the interface since `checkSignatures` is not a view method.
    *       The method will not perform any state changes (see parameters of `checkSignatures`)
    * @param _data Arbitrary length data signed on the behalf of address(this)
    * @param _signature Signature byte array associated with _data
    * @return a bool upon valid or invalid signature with corresponding _data
    */
    function isValidSignature(bytes calldata _data, bytes calldata _signature)
        override
        public
        view
        returns (bytes4)
    {
        // Caller should be a Safe
        GnosisSafe safe = GnosisSafe(msg.sender);
        bytes32 messageHash = safe.getMessageHash(_data);
        if (_signature.length == 0) {
            require(safe.signedMessages(messageHash) != 0, "Hash not approved");
        } else {
            safe.checkSignatures(messageHash, _data, _signature);
        }
        return EIP1271_MAGIC_VALUE;
    }
}