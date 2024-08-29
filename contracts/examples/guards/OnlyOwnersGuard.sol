// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.7.0 <0.9.0;

import {BaseTransactionGuard} from "./../../base/GuardManager.sol";
import {ISafe} from "./../../interfaces/ISafe.sol";
import {Enum} from "./../../libraries/Enum.sol";

/**
 * @title OnlyOwnersGuard - Only allows owners to execute transactions.
 * @author Richard Meissner - @rmeissner
 */
contract OnlyOwnersGuard is BaseTransactionGuard {
    constructor() {}

    // solhint-disable-next-line payable-fallback
    fallback() external {
        // We don't revert on fallback to avoid issues in case of a Safe upgrade
        // E.g. The expected check method might change and then the Safe would be locked.
    }

    /**
     * @notice Called by the Safe contract before a transaction is executed.
     * @dev Reverts if the transaction is not executed by an owner.
     * @param msgSender Executor of the transaction.
     */
    function checkTransaction(
        address,
        uint256,
        bytes memory,
        Enum.Operation,
        uint256,
        uint256,
        uint256,
        address,
        // solhint-disable-next-line no-unused-vars
        address payable,
        bytes memory,
        address msgSender
    ) external view override {
        require(ISafe(msg.sender).isOwner(msgSender), "msg sender is not allowed to exec");
    }

    /**
     * @notice Called by the Safe contract after a transaction is executed.
     * @dev No-op.
     */
    function checkAfterExecution(bytes32, bool) external view override {}
}
