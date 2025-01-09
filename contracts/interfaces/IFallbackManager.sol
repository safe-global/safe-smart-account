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
     * @dev 1. Only fallback calls without value and with data will be forwarded.
     *      2. Changing the fallback handler can only be done via a Safe transaction.
     *      3. Cannot be set to the Safe itself.
     *      4. IMPORTANT! SECURITY RISK! The fallback handler can be set to any address and all the calls will be forwarded to it,
     *         bypassing all the Safe's access control mechanisms. When setting the fallback handler, make sure to check the address
     *         is a trusted contract and if it supports state changes, it implements the necessary checks.
     * @param handler contract to handle fallback calls.
     */
    function setFallbackHandler(address handler) external;
}
