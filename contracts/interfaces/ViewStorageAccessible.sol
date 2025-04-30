// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.5.0 <0.9.0;

/**
 * @title View Storage Accessible Interface
 * @notice Interface on top of {StorageAccessible} base class to allow simulations from view functions.
 * @dev Adjusted version of <https://github.com/gnosis/util-contracts/blob/3db1e531cb243a48ea91c60a800d537c1000612a/contracts/StorageAccessible.sol>
 */
interface ViewStorageAccessible {
    /**
     * @notice Same as {simulate} on {StorageAccessible} but marked as view.
     * @dev Marked as view so that it can be called from external contracts that want to run simulations from within view functions.
     *      It will revert if the invoked simulation attempts to change state.
     */
    function simulate(address targetContract, bytes calldata calldataPayload) external view returns (bytes memory);
}
