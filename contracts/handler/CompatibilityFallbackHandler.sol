// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "./DefaultCallbackHandler.sol";
import "../interfaces/ISignatureValidator.sol";
import "../GnosisSafe.sol";


/// @title Compatibility Fallback Handler - fallback handler to provider compatibility between pre 1.3.0 and 1.3.0+ Safe contracts
/// @author Richard Meissner - <richard@gnosis.pm>
contract CompatibilityFallbackHandler is DefaultCallbackHandler, ISignatureValidator {
    bytes4 internal constant SIMULATE_SELECTOR = bytes4(keccak256("simulate(address,bytes)"));

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
    * @notice See https://github.com/gnosis/util-contracts/blob/bb5fe5fb5df6d8400998094fb1b32a178a47c3a1/contracts/StorageAccessible.sol
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
    
    /**
     * @dev Performs a delegetecall on a targetContract in the context of self.
     * Internally reverts execution to avoid side effects (making it static). Catches revert and returns encoded result as bytes.
     * @param targetContract Address of the contract containing the code to execute.
     * @param calldataPayload Calldata that should be sent to the target contract (encoded method name and arguments).
     */
    function simulateDelegatecall(
        address targetContract, // solhint-disable-line no-unused-var
        bytes calldata calldataPayload // solhint-disable-line no-unused-var
    ) public returns (bytes memory response) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let internalCalldata := mload(0x40)
            // Store `simulateDelegatecallInternal.selector`.
            mstore(internalCalldata, "\x43\x21\x8e\x19")
            // Abuse the fact that both this and the internal methods have the
            // same signature, and differ only in symbol name (and therefore,
            // selector) and copy calldata directly. This saves us approximately
            // 250 bytes of code and 300 gas at runtime over the
            // `abi.encodeWithSelector` builtin.
            calldatacopy(
                add(internalCalldata, 0x04),
                0x04,
                sub(calldatasize(), 0x04)
            )

            // `pop` is required here by the compiler, as top level expressions
            // can't have return values in inline assembly. `call` typically
            // returns a 0 or 1 value indicated whether or not it reverted, but
            // since we know it will always revert, we can safely ignore it.
            pop(call(
                gas(),
                // address() has been change to caller() to use the implemtation of the Safe
                caller(),
                0,
                internalCalldata,
                calldatasize(),
                // The `simulateDelegatecallInternal` call always reverts, and
                // instead encodes whether or not it was successful in the return
                // data. The first 32-byte word of the return data contains the
                // `success` value, so write it to memory address 0x00 (which is
                // reserved Solidity scratch space and OK to use).
                0x00,
                0x20
            ))


            // Allocate and copy the response bytes, making sure to increment
            // the free memory pointer accordingly (in case this method is
            // called as an internal function). The remaining `returndata[0x20:]`
            // contains the ABI encoded response bytes, so we can just write it
            // as is to memory.
            let responseSize := sub(returndatasize(), 0x20)
            response := mload(0x40)
            mstore(0x40, add(response, responseSize))
            returndatacopy(response, 0x20, responseSize)

            if iszero(mload(0x00)) {
                revert(add(response, 0x20), mload(response))
            }
        }
    }
}