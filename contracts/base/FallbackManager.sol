// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {SelfAuthorized} from "../common/SelfAuthorized.sol";
import {IFallbackManager} from "../interfaces/IFallbackManager.sol";
// solhint-disable-next-line no-unused-import
import {FALLBACK_HANDLER_STORAGE_SLOT} from "../libraries/SafeStorage.sol";

/**
 * @title Fallback Manager
 * @notice A contract managing fallback calls made to this contract.
 * @author Richard Meissner - @rmeissner
 */
abstract contract FallbackManager is SelfAuthorized, IFallbackManager {
    /**
     * @notice Internal function to set the fallback handler.
     * @param handler Contract to handle fallback calls.
     */
    function internalSetFallbackHandler(address handler) internal {
        // If a fallback handler is set to `this`, then the following attack vector is opened:
        // Imagine we have a function like this:
        //
        //         function withdraw() internal authorized {
        //             withdrawalAddress.call.value(address(this).balance)("");
        //         }
        //
        // If the fallback method is triggered, the fallback handler appends the `msg.sender` address to the calldata and calls the fallback handler.
        // A potential attacker could call a Safe with the 3 bytes signature of a `withdraw` function. Since 3 bytes do not create a valid signature,
        // the call would end in a fallback handler. Since it appends the `msg.sender` address to the calldata, the attacker could craft an address
        // where the first 3 bytes of the previous calldata followed by the first byte of the attacker's address make up a valid function signature.
        // The subsequent call would result in unsanctioned access to Safe's internal protected methods. This happens as Solidity matches the first
        // 4 bytes of the calldata to a function signature, regardless if more data follow these 4 bytes.
        if (handler == address(this)) revertWithError("GS400");

        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            sstore(FALLBACK_HANDLER_STORAGE_SLOT, handler)
        }
        /* solhint-enable no-inline-assembly */
    }

    /**
     * @inheritdoc IFallbackManager
     */
    function setFallbackHandler(address handler) public override authorized {
        internalSetFallbackHandler(handler);
        emit ChangedFallbackHandler(handler);
    }

    /**
     * @inheritdoc IFallbackManager
     */
    // solhint-disable-next-line payable-fallback,no-complex-fallback
    fallback() external override {
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            // When compiled with the optimizer, the compiler relies on certain assumptions on how the
            // memory is used, therefore we need to guarantee memory safety (keeping the free memory pointer
            // at memory offset 0x40 intact, not going beyond the scratch space, etc).
            // See: <https://docs.soliditylang.org/en/latest/assembly.html#memory-safety>

            let handler := sload(FALLBACK_HANDLER_STORAGE_SLOT)

            if iszero(handler) {
                return(0, 0)
            }

            let ptr := mload(0x40)
            calldatacopy(ptr, 0, calldatasize())

            // The `msg.sender` address is shifted to the left by 12 bytes to remove the padding,
            // then the address without padding is stored right after the calldata.
            mstore(add(ptr, calldatasize()), shl(96, caller()))

            // Add 20 bytes for the address that appended to the calldata.
            let success := call(gas(), handler, 0, ptr, add(calldatasize(), 20), 0, 0)

            returndatacopy(ptr, 0, returndatasize())
            if iszero(success) {
                revert(ptr, returndatasize())
            }
            return(ptr, returndatasize())
        }
        /* solhint-enable no-inline-assembly */
    }
}
