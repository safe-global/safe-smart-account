// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {ISafe} from "../interfaces/ISafe.sol";
import {StorageSlots} from "../libraries/StorageSlots.sol";

/**
 * @title Handler Context - Allows the fallback handler to extract additional context from the calldata
 * @dev The fallback manager appends the following context to the calldata:
 *      1. Fallback manager caller address (non-padded)
 * based on https://github.com/OpenZeppelin/openzeppelin-contracts/blob/f8cc8b844a9f92f63dc55aa581f7d643a1bc5ac1/contracts/metatx/ERC2771Context.sol
 * @author Richard Meissner - @rmeissner
 */
abstract contract HandlerContext {
    /**
     * @notice A modifier that reverts if not called by a Safe as a fallback handler.
     * @dev Note that this modifier does a **best effort** attempt at not allowing calls that are
     *      not as a fallback call, but it still can be tricked. It is suitable for use cases such
     *      making a best effort attempt to disallow ERC-721 and ERC-1155 token transfers to the
     *      fallback handler contract.
     */
    modifier onlyFallback() {
        _requireFallback();
        _;
    }

    /**
     * @dev Implementation of the {onlySafeFallback} modifier check that the current call is a Safe
     *      fallback call, and the contract is not called directly. Note that this is only a **best
     *      effort** check and may generate false positives under certain conditions.
     */
    function _requireFallback() internal view {
        bytes memory storageData = ISafe(payable(msg.sender)).getStorageAt(uint256(StorageSlots.FALLBACK_HANDLER_STORAGE_SLOT), 1);
        address fallbackHandler = abi.decode(storageData, (address));
        require(fallbackHandler == address(this), "not a fallback call");
    }

    /**
     * @notice Allows fetching the original caller address.
     * @dev This is only reliable in combination with a FallbackManager that supports this (e.g. Safe contract >=1.3.0).
     *      When using this functionality make sure that the linked _manager (aka msg.sender) supports this.
     *      This function does not rely on a trusted forwarder. Use the returned value only to
     *      check information against the calling manager.
     * @return sender Original caller address.
     */
    function _msgSender() internal pure returns (address sender) {
        require(msg.data.length >= 20, "Invalid calldata length");
        // The assembly code is more direct than the Solidity version using `abi.decode`.
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            sender := shr(96, calldataload(sub(calldatasize(), 20)))
        }
        /* solhint-enable no-inline-assembly */
    }

    /**
     * @notice Returns the FallbackManager address
     * @return Fallback manager address
     */
    function _manager() internal view returns (address) {
        return msg.sender;
    }
}
