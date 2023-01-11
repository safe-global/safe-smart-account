// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "../../common/Enum.sol";
import "../../base/GuardManager.sol";
import "../../GnosisSafe.sol";

interface ISafe {
    function getOwners() external view returns (address[] memory);
}

contract OnlyOwnersGuard is BaseGuard {
    ISafe public safe;

    constructor() {}

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
    ) external override {
        // Only owners can exec
        address[] memory owners = ISafe(msg.sender).getOwners();
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == msgSender) {
                return;
            }
        }

        // msg sender is not an owner
        revert("msg sender is not allowed to exec");
    }

    function checkAfterExecution(bytes32, bool) external view override {}
}
