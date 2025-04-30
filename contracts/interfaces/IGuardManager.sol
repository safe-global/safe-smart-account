// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title IGuardManager - A contract interface managing transaction guards which perform pre and post-checks on Safe transactions.
 * @author @safe-global/safe-protocol
 */
interface IGuardManager {
    /**
     * @notice Transaction guard changed.
     * @param guard The address of the new transaction guard.
     */
    event ChangedGuard(address indexed guard);

    /**
     * @notice Set Transaction Guard `guard` for the Safe. Make sure you trust the guard.
     * @dev Set a guard that checks Safe transactions before and after execution.
     *      This can only be done via a Safe transaction.
     *      ⚠️⚠️⚠️ IMPORTANT: Since a guard has full power to block Safe transaction execution,
     *      a broken guard can cause a denial of service for the Safe. Make sure to carefully
     *      audit the guard code and design recovery mechanisms. ⚠️⚠️⚠️
     * @param guard The address of the guard to be used or the 0 address to disable the guard
     */
    function setGuard(address guard) external;
}
