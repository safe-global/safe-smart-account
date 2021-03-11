// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "./DefaultCallbackHandler.sol";
import "../interfaces/ISignatureValidator.sol";
import "../GnosisSafe.sol";


/// @title Compatibility Fallback Handler - fallback handler to provider compatibility between pre 1.3.0 and 1.3.0+ Safe contracts
/// @author Richard Meissner - <richard@gnosis.pm>
contract CompatibilityFallbackHandler is DefaultCallbackHandler, ISignatureValidator {
    address internal constant SENTINEL_MODULES = address(0x1);
    bytes4 internal constant UPDATED_MAGIC_VALUE = 0x1626ba7e;

    /**
    * Implementation of ISignatureValidator (see `interfaces/ISignatureValidator.sol`)
    * @dev Should return whether the signature provided is valid for the provided data.
    * @param _data Arbitrary length data signed on the behalf of address(msg.sender)
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
        GnosisSafe safe = GnosisSafe(payable(msg.sender));
        bytes32 messageHash = safe.getMessageHash(_data);
        if (_signature.length == 0) {
            require(safe.signedMessages(messageHash) != 0, "Hash not approved");
        } else {
            safe.checkSignatures(messageHash, _data, _signature);
        }
        return EIP1271_MAGIC_VALUE;
    }

    /**
    * Implementation of updated EIP-1271
    * @dev Should return whether the signature provided is valid for the provided data.
    *       The save does not implement the interface since `checkSignatures` is not a view method.
    *       The method will not perform any state changes (see parameters of `checkSignatures`)
    * @param _dataHash Hash of the data signed on the behalf of address(msg.sender)
    * @param _signature Signature byte array associated with _dataHash
    * @return a bool upon valid or invalid signature with corresponding _dataHash
    */
    function isValidSignature(bytes32 _dataHash, bytes calldata _signature)
        external
        view
        returns (bytes4)
    {
        ISignatureValidator validator = ISignatureValidator(msg.sender);
        bytes4 value = validator.isValidSignature(abi.encode(_dataHash), _signature);
        return (value == EIP1271_MAGIC_VALUE) ? UPDATED_MAGIC_VALUE : bytes4(0);
    }
    
    /// @dev Returns array of first 10 modules.
    /// @return Array of modules.
    function getModules()
        external
        view
        returns (address[] memory)
    {
        // Caller should be a Safe
        GnosisSafe safe = GnosisSafe(payable(msg.sender));
        (address[] memory array,) = safe.getModulesPaginated(SENTINEL_MODULES, 10);
        return array;
    }
}