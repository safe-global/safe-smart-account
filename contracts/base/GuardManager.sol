// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.7.0 <0.9.0;

import {SelfAuthorized} from "./../common/SelfAuthorized.sol";
import {IERC165} from "./../interfaces/IERC165.sol";
import {IGuardManager} from "./../interfaces/IGuardManager.sol";
import {Enum} from "./../libraries/Enum.sol";
// solhint-disable-next-line no-unused-import
import {GUARD_STORAGE_SLOT} from "../libraries/SafeStorage.sol";

/**
 * @title ITransactionGuard Interface
 */
interface ITransactionGuard is IERC165 {
    /**
     * @notice Checks the transaction details.
     * @dev The function needs to implement transaction validation logic.
     * @param to The address to which the transaction is intended.
     * @param value The native token value of the transaction in Wei.
     * @param data The transaction data.
     * @param operation Operation type (0 for `CALL`, 1 for `DELEGATECALL`).
     * @param safeTxGas Gas used for the transaction.
     * @param baseGas The base gas for the transaction.
     * @param gasPrice The price of gas in Wei for the transaction.
     * @param gasToken The token used to pay for gas.
     * @param refundReceiver The address which should receive the refund.
     * @param signatures The signatures of the transaction.
     * @param msgSender The address of the message sender.
     */
    function checkTransaction(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures,
        address msgSender
    ) external;

    /**
     * @notice Checks after execution of the transaction.
     * @dev The function needs to implement a check after the execution of the transaction.
     * @param hash The hash of the executed transaction.
     * @param success The status of the transaction execution.
     */
    function checkAfterExecution(bytes32 hash, bool success) external;
}

/**
 * @title Base Transaction Guard
 */
abstract contract BaseTransactionGuard is ITransactionGuard {
    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(bytes4 interfaceId) external view virtual override returns (bool) {
        return
            interfaceId == type(ITransactionGuard).interfaceId || // 0xe6d7a83a
            interfaceId == type(IERC165).interfaceId; // 0x01ffc9a7
    }
}

/**
 * @title Guard Manager
 * @notice A contract managing transaction guards which perform pre and post-checks on Safe transactions.
 * @author Richard Meissner - @rmeissner
 */
abstract contract GuardManager is SelfAuthorized, IGuardManager {
    /**
     * @inheritdoc IGuardManager
     */
    function setGuard(address guard) external override authorized {
        if (guard != address(0) && !ITransactionGuard(guard).supportsInterface(type(ITransactionGuard).interfaceId))
            revertWithError("GS300");

        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            sstore(GUARD_STORAGE_SLOT, guard)
        }
        /* solhint-enable no-inline-assembly */
        emit ChangedGuard(guard);
    }

    /**
     * @notice Internal method to retrieve the current guard.
     * @dev We do not have a public method because we're short on bytecode size limit,
     *      to retrieve the guard address, one can use {getStorageAt} from {StorageAccessible} contract
     *      with the slot {GUARD_STORAGE_SLOT}.
     * @return guard The address of the guard.
     */
    function getGuard() internal view returns (address guard) {
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            guard := sload(GUARD_STORAGE_SLOT)
        }
        /* solhint-enable no-inline-assembly */
    }
}
