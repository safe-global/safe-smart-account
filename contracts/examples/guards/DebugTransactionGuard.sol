// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "../../common/Enum.sol";
import "../../base/GuardManager.sol";
import "../../GnosisSafe.sol";

/// @title Debug Transaction Guard - A guard that will emit events with extended information.
/// @notice This guard is only meant as a development tool and example
/// @author Richard Meissner - <richard@gnosis.pm>
contract DebugTransactionGuard is Guard {
    // solhint-disable-next-line payable-fallback
    fallback() external {
        // We don't revert on fallback to avoid issues in case of a Safe upgrade
        // E.g. The expected check method might change and then the Safe would be locked.
    }

    event TransactionDetails(
        address indexed safe,
        bytes32 indexed txHash,
        address to,
        uint256 value,
        bytes data,
        Enum.Operation operation,
        uint256 safeTxGas,
        bool usesRefund,
        uint256 nonce
    );

    event GasUsage(address indexed safe, bytes32 indexed txHash, uint256 indexed nonce, bool success);

    mapping(bytes32 => uint256) public txNonces;

    function checkTransaction(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        // solhint-disable-next-line no-unused-vars
        address payable refundReceiver,
        bytes memory,
        address
    ) external override {
        uint256 nonce;
        bytes32 txHash;
        {
            GnosisSafe safe = GnosisSafe(payable(msg.sender));
            nonce = safe.nonce() - 1;
            txHash = safe.getTransactionHash(to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce);
        }
        emit TransactionDetails(msg.sender, txHash, to, value, data, operation, safeTxGas, gasPrice > 0, nonce);
        txNonces[txHash] = nonce;
    }

    function checkAfterExecution(bytes32 txHash, bool success) external override {
        uint256 nonce = txNonces[txHash];
        require(nonce != 0, "Could not get nonce");
        txNonces[txHash] = 0;
        emit GasUsage(msg.sender, txHash, nonce, success);
    }
}
