// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Fallback Manager Interface
 * @notice Interface for managing fallback calls made to this contract.
 * @author @safe-global/safe-protocol
 */
interface IFallbackManager {
    /**
     * @notice The fallback handler has changed.
     * @param handler The address of the new fallback handler.
     */
    event ChangedFallbackHandler(address indexed handler);

    /**
     * @notice Set Fallback Handler to `handler` for the Safe.
     * @dev 1. Only fallback calls without value and with data will be forwarded.
     *      2. Changing the fallback handler can only be done via a Safe transaction.
     *      3. Cannot be set to the Safe itself.
     *      4. ⚠️⚠️⚠️ IMPORTANT! SECURITY RISK! The fallback handler can be set to any address and all the calls will be forwarded to it,
     *         bypassing all the Safe's access control mechanisms. When setting the fallback handler, make sure to check the address
     *         is a trusted contract and if it supports state changes, it implements the necessary checks. ⚠️⚠️⚠️
     * @param handler contract to handle fallback calls.
     */
    function setFallbackHandler(address handler) external;

    /**
     * @notice Forwards all calls to the fallback handler if set.
     *         Returns empty data if no handler is set.
     * @dev Appends the non-padded caller address to the calldata to be optionally used in the handler
     *      The handler can make use of {HandlerContext} to extract the address.
     *      This is done because in the next call frame the `msg.sender` will be {FallbackManager}'s address
     *      and having the original caller address may enable additional verification scenarios.
     */
    fallback() external;
}
