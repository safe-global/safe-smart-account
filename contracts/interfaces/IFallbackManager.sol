// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title IFallbackManager - A contract interface managing fallback calls made to this contract.
 * @author @safe-global/safe-protocol
 */
interface IFallbackManager {
    event ChangedFallbackHandler(address indexed handler);

    /**
     * @notice Set Fallback Handler to `handler` for the Safe.
     * @dev Only fallback calls without value and with data will be forwarded.
     *      This can only be done via a Safe transaction.
     *      Cannot be set to the Safe itself.
     * @param handler contract to handle fallback calls.
     */
    function setFallbackHandler(address handler) external;
}
