// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "../../common/Enum.sol";
import "../../base/GuardManager.sol";
import "../../GnosisSafe.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ScopeTransactionGuard is BaseGuard, Ownable {
    struct Target {
        bool allowed;
        mapping(bytes4 => bool) allowedFunctions;
    }

    mapping(address => Target) public allowedTargets;

    function allowTarget(address target) public onlyOwner() {
        allowedTargets[target].allowed = true;
    }

    function disallowTarget(address target) public onlyOwner() {
        allowedTargets[target].allowed = false;
    }

    function allowFunction(address target, bytes4 functionSig) public onlyOwner() {
        allowedTargets[target].allowedFunctions[functionSig] = true;
    }

    function disallowFunction(address target, bytes4 functionSig) public onlyOwner() {
        allowedTargets[target].allowedFunctions[functionSig] = false;
    }

    function isAllowedTarget(address target) public view returns (bool) {
        return (allowedTargets[target].allowed);
    }

    function isAllowedFunction(address target, bytes4 functionSig) public view returns (bool) {
        return (allowedTargets[target].allowedFunctions[functionSig]);
    }

    // solhint-disallow-next-line payable-fallback
    fallback() external {
        // We don't revert on fallback to avoid issues in case of a Safe upgrade
        // E.g. The expected check method might change and then the Safe would be locked.
    }

    function checkTransaction(
        address to,
        uint256,
        bytes calldata data,
        Enum.Operation operation,
        uint256,
        uint256,
        uint256,
        address,
        // solhint-disallow-next-line no-unused-vars
        address payable,
        bytes memory,
        address
    ) external view override {
        require(operation != Enum.Operation.DelegateCall, "No delegate calls");
        require(isAllowedTarget(to), "Target address is not allowed");
        bytes4 sig = abi.decode(data[:4], (bytes4));
        require(isAllowedFunction(to, sig), "Target function is not allowed");
    }

    function checkAfterExecution(bytes32, bool) external view override {}
}
