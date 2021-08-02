// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "../../common/Enum.sol";
import "../../base/GuardManager.sol";
import "../../GnosisSafe.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ScopeTransactionGuard is BaseGuard, Ownable {
    event TargetAllowed(address target);
    event TargetDisallowed(address target);
    event TargetScopeSet(address target, bool scoped);
    event DelegateCallsAllowedOnTarget(address target);
    event DelegateCallsDisallowedOnTarget(address target);
    event FunctionAllowedOnTarget(address target, bytes4 sig);
    event FunctionDisallowedOnTarget(address target, bytes4 sig);

    struct Target {
        bool allowed;
        bool scoped;
        bool delegateCallAllowed;
        mapping(bytes4 => bool) allowedFunctions;
    }

    mapping(address => Target) public allowedTargets;

    function allowTarget(address target) public onlyOwner() {
        allowedTargets[target].allowed = true;
        emit TargetAllowed(target);
    }

    function disallowTarget(address target) public onlyOwner() {
        allowedTargets[target].allowed = false;
        emit TargetDisallowed(target);
    }

    function setScope(address target, bool scoped) public onlyOwner() {
        allowedTargets[target].scoped = scoped;
        emit TargetScopeSet(target, scoped);
    }

    function allowDelegateCall(address target) public onlyOwner() {
        allowedTargets[target].delegateCallAllowed = true;
        emit DelegateCallsAllowedOnTarget(target);
    }

    function disallowDelegateCall(address target) public onlyOwner() {
        allowedTargets[target].delegateCallAllowed = false;
        emit DelegateCallsDisallowedOnTarget(target);
    }

    function allowFunction(address target, bytes4 sig) public onlyOwner() {
        allowedTargets[target].allowedFunctions[sig] = true;
        emit FunctionAllowedOnTarget(target, sig);
    }

    function disallowFunction(address target, bytes4 sig) public onlyOwner() {
        allowedTargets[target].allowedFunctions[sig] = false;
        emit FunctionDisallowedOnTarget(target, sig);
    }

    function isAllowedTarget(address target) public view returns (bool) {
        return (allowedTargets[target].allowed);
    }

    function isScoped(address target) public view returns (bool) {
        return (allowedTargets[target].scoped);
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
        require(
            operation != Enum.Operation.DelegateCall || allowedTargets[to].delegateCallAllowed,
            "Delegate call not allowed to this address"
        );
        require(isAllowedTarget(to), "Target address is not allowed");
        /// bytes4 sig = abi.decode(data[:4], (bytes4));
        require(
            !allowedTargets[to].scoped ||
                isAllowedFunction(to, bytes4(data[0]) | (bytes4(data[1]) >> 8) | (bytes4(data[2]) >> 16) | (bytes4(data[3]) >> 24)),
            "Target function is not allowed"
        );
    }

    function checkAfterExecution(bytes32, bool) external view override {}
}
