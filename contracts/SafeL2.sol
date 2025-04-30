// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

// The import is used in the @inheritdoc, false positive
// solhint-disable-next-line no-unused-import
import {ModuleManager} from "./base/ModuleManager.sol";
import {Safe, Enum} from "./Safe.sol";

/**
 * @title SafeL2
 * @notice An implementation of the Safe contract that emits additional events on transaction executions.
 * @dev This contract allows indexing of Safe accounts even on chains without good tracing support, at the cost of additional gas for emitting the events.
 *      For a more complete description of the Safe account, please refer to the main {Safe} contract.
 * @author Stefan George - @Georgi87
 * @author Richard Meissner - @rmeissner
 */
contract SafeL2 is Safe {
    /**
     * @notice Safe multi-signature transaction data.
     * @param to Destination address of Safe transaction.
     * @param value Native token value of Safe transaction.
     * @param data Data payload of Safe transaction.
     * @param operation Operation type of Safe transaction.
     * @param safeTxGas Gas that should be used for the Safe transaction.
     * @param baseGas Base gas costs that are independent of the transaction execution.
     * @param gasPrice Gas price that should be used for the payment calculation.
     * @param gasToken Token address (or 0 for the native token) that is used for the payment.
     * @param refundReceiver Address of receiver of gas payment (or 0 for `tx.origin`).
     * @param signatures Signature data for the executed transaction.
     * @param additionalInfo Additional transaction data encoded as: `abi.encode(nonce, msg.sender, threshold)`.
     *                       This is used in order to work around "stack too deep" Solidity errors.
     */
    event SafeMultiSigTransaction(
        address to,
        uint256 value,
        bytes data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes signatures,
        bytes additionalInfo
    );

    /**
     * @notice Safe module transaction data.
     * @param module Module that executed the transaction.
     * @param to Destination address of the module transaction.
     * @param value Ether value of the module transaction.
     * @param data Data payload of the module transaction.
     * @param operation Operation type of the module transaction.
     */
    event SafeModuleTransaction(address module, address to, uint256 value, bytes data, Enum.Operation operation);

    /**
     * @inheritdoc Safe
     */
    function onBeforeExecTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures
    ) internal override {
        bytes memory additionalInfo;
        {
            additionalInfo = abi.encode(nonce, msg.sender, threshold);
        }
        emit SafeMultiSigTransaction(
            to,
            value,
            data,
            operation,
            safeTxGas,
            baseGas,
            gasPrice,
            gasToken,
            refundReceiver,
            signatures,
            additionalInfo
        );
    }

    /**
     * @inheritdoc ModuleManager
     */
    function onBeforeExecTransactionFromModule(address to, uint256 value, bytes memory data, Enum.Operation operation) internal override {
        emit SafeModuleTransaction(msg.sender, to, value, data, operation);
    }
}
