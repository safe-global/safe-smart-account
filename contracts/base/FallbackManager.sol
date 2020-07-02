pragma solidity >=0.5.0 <0.7.0;

import "../common/SelfAuthorized.sol";

/// @title Fallback Manager - A contract that manages fallback calls made to this contract
/// @author Richard Meissner - <richard@gnosis.pm>
contract FallbackManager is SelfAuthorized {

    // keccak256("fallback_manager.handler.address")
    bytes32 internal constant FALLBACK_HANDLER_STORAGE_SLOT = 0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5;

    function internalSetFallbackHandler(address handler) internal {
        bytes32 slot = FALLBACK_HANDLER_STORAGE_SLOT;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            sstore(slot, handler)
        }
    }

    /// @dev Allows to add a contract to handle fallback calls.
    ///      Only fallback calls without value and with data will be forwarded.
    ///      This can only be done via a Safe transaction.
    /// @param handler contract to handle fallbacks calls.
    function setFallbackHandler(address handler)
        public
        authorized
    {
        internalSetFallbackHandler(handler);
    }

    function ()
        external
        payable
    {
        // Only calls without value and with data will be forwarded
        if (msg.value > 0 || msg.data.length == 0) {
            return;
        }
        bytes32 slot = FALLBACK_HANDLER_STORAGE_SLOT;
        address handler;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            handler := sload(slot)
        }

        if (handler != address(0)) {
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                calldatacopy(0, 0, calldatasize())
                let success := call(gas, handler, 0, 0, calldatasize(), 0, 0)
                returndatacopy(0, 0, returndatasize())
                if eq(success, 0) { revert(0, returndatasize()) }
                return(0, returndatasize())
            }
        }
    }
}