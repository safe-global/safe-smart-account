// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Singleton
 * @notice Base contract for singleton that can be used as implementations for {SafeProxy}s.
 * @dev This must always be the first super contract.
 *      This contract is tightly coupled to our {SafeProxy} contract (see `proxies/SafeProxy.sol`).
 * @author Richard Meissner - @rmeissner
 */
abstract contract Singleton {
    /**
     * @dev `singleton` must be the first declared variable to ensure it has the same storage location as in the {SafeProxy} contract.
     *      The address must be stored alone: it must use a full 32-byte word and cannot be packed with other storage variables.
     */
    address private singleton;
}
