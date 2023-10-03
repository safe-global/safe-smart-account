// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {ScriptUtils} from "script/utils/ScriptUtils.sol";
import {Safe} from "contracts/Safe.sol";
import {GuardManager} from "contracts/base/GuardManager.sol";
import {ModuleManager} from "contracts/base/ModuleManager.sol";
import {Enum} from "contracts/common/Enum.sol";
import {AdminGuard} from "contracts/examples/guards/AdminGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {console} from "forge-std/console.sol";

/// @dev Script to execute a Gnosis Safe transaction containing batched Multicall3 operations onchain.
/// Provides a reusable template using a dynamic arrays in storage which can be populated flexibly.
contract ExecuteTxScript is ScriptUtils {
    Safe public founderSafe;
    AdminGuard public adminGuard;

    // Safe transaction parameters
    address public constant to = multicall3;
    uint256 public value;
    bytes multicallData;
    Enum.Operation operation;
    uint256 safeTxGas;
    uint256 baseGas;
    uint256 gasPrice;
    address gasToken;
    address payable refundReceiver;
    Call3[] calls;
    bytes signatures;

    function run() public {
        vm.startBroadcast();

        // contracts config
        founderSafe = Safe(payable(0x5d347E9b0e348a10327F4368a90286b3d1E7FB15));
        adminGuard = AdminGuard(0x2370cB6D6909eAD72b322496628b824DAfDcc3F0);

        // Call3 array formatting
        bytes memory addAdminGuardData = abi.encodeWithSelector(GuardManager.setGuard.selector, address(adminGuard));
        bytes memory addModule1Data = abi.encodeWithSelector(ModuleManager.enableModule.selector, ScriptUtils.symmetry);
        bytes memory addModule2Data = abi.encodeWithSelector(ModuleManager.enableModule.selector, ScriptUtils.robriks2);
        Call3 memory addAdminGuardCall =
            Call3({target: ScriptUtils.stationFounderSafe, allowFailure: false, callData: addAdminGuardData});
        Call3 memory addModule1Call =
            Call3({target: ScriptUtils.stationFounderSafe, allowFailure: false, callData: addModule1Data});
        Call3 memory addModule2Call =
            Call3({target: ScriptUtils.stationFounderSafe, allowFailure: false, callData: addModule2Data});
        calls.push(addAdminGuardCall);
        calls.push(addModule1Call);
        calls.push(addModule2Call);

        // operation config
        operation = Enum.Operation.DelegateCall;

        // signature config
        bytes memory ownerSig1 = bytes(hex'ce285cadc0e8ccef4f5f8bc863811934e074335016a433af83ff68b0b9f6ddbe7948494799a617e5dcdfb564f82829dc4b0bec21643baf5de0aa5a7b35b6a3e31c');
        bytes memory ownerSig2 = bytes(hex'ae5ef721887c166623fa89596d7325c9fb09e293b0792bd75531a5ecce4425137d087930e7981f12c08a91e6d00f46a639f294f4d833ab48faac485169844bad1b');
        
        // signature formatting
        signatures = abi.encodePacked(signatures, ownerSig1);
        signatures = abi.encodePacked(signatures, ownerSig2);

        // execution template
        multicallData = abi.encodeWithSignature("aggregate3((address,bool,bytes)[])", calls);

        bool r = founderSafe.execTransaction(
            to, value, multicallData, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, signatures
        );
        require(r, "Safe::execTransaction() failed");

        vm.stopBroadcast();
    }
}