// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Owner Manager Interface
 * @notice Interface for managing Safe owners and a threshold to authorize transactions.
 * @author @safe-global/safe-protocol
 */
interface IOwnerManager {
    /**
     * @notice An owner was added.
     * @param owner The address of the new owner.
     */
    event AddedOwner(address indexed owner);

    /**
     * @notice An owner was removed.
     * @param owner The address of the old owner.
     */
    event RemovedOwner(address indexed owner);

    /**
     * @notice The signature threshold changed.
     * @param threshold The new threshold for authorizing Safe transactions.
     */
    event ChangedThreshold(uint256 threshold);

    /**
     * @notice Adds the owner `owner` to the Safe and updates the threshold to `_threshold`.
     * @dev This can only be done via a Safe transaction.
     *      ⚠️⚠️⚠️ A Safe can set itself as an owner which is a valid setup for EIP-7702 delegations.
     *      However, if address of the accounts is not an EOA and cannot sign for itself, you can
     *      potentially block access to the account completely. For example, if you have a `n/n`
     *      Safe (so `threshold == ownerCount`) and one of the owners is the Safe itself and not
     *      an EIP-7702 delegated account, then it will not be possible to produce a valid
     *      signature for the Safe. ⚠️⚠️⚠️
     * @param owner New owner address.
     * @param _threshold New threshold.
     */
    function addOwnerWithThreshold(address owner, uint256 _threshold) external;

    /**
     * @notice Removes the owner `owner` from the Safe and updates the threshold to `_threshold`.
     * @dev This can only be done via a Safe transaction.
     * @param prevOwner Owner that pointed to the `owner` to be removed in the linked list.
     *        If the owner to be removed is the first (or only) element of the list,
     *        `prevOwner` MUST be set to the sentinel address `0x1` (referred to as
     *        `SENTINEL_OWNERS` in the implementation).
     * @param owner Owner address to be removed.
     * @param _threshold New threshold.
     */
    function removeOwner(address prevOwner, address owner, uint256 _threshold) external;

    /**
     * @notice Replaces the owner `oldOwner` in the Safe with `newOwner`.
     * @dev This can only be done via a Safe transaction.
     *      ⚠️⚠️⚠️ A Safe can set itself as an owner which is a valid setup for EIP-7702 delegations.
     *      However, if address of the accounts is not an EOA and cannot sign for itself, you can
     *      potentially block access to the account completely. For example, if you have a `n/n`
     *      Safe (so `threshold == ownerCount`) and one of the owners is the Safe itself and not
     *      an EIP-7702 delegated account, then it will not be possible to produce a valid
     *      signature for the Safe. ⚠️⚠️⚠️
     * @param prevOwner Owner that pointed to the `oldOwner` to be replaced in the linked list.
     *        If the owner to be replaced is the first (or only) element of the list,
     *        `prevOwner` MUST be set to the sentinel address `0x1` (referred to as
     *        `SENTINEL_OWNERS` in the implementation).
     * @param oldOwner Owner address to be replaced.
     * @param newOwner New owner address.
     */
    function swapOwner(address prevOwner, address oldOwner, address newOwner) external;

    /**
     * @notice Changes the threshold of the Safe to `_threshold`.
     * @dev This can only be done via a Safe transaction.
     * @param _threshold New threshold.
     */
    function changeThreshold(uint256 _threshold) external;

    /**
     * @notice Returns the number of required confirmations for a Safe transaction aka the threshold.
     * @return Threshold number.
     */
    function getThreshold() external view returns (uint256);

    /**
     * @notice Returns if `owner` is an owner of the Safe.
     * @return Boolean if `owner` is an owner of the Safe.
     */
    function isOwner(address owner) external view returns (bool);

    /**
     * @notice Returns a list of Safe owners.
     * @return Array of Safe owners.
     */
    function getOwners() external view returns (address[] memory);
}
