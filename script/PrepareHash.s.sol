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

/// @dev Foundry script to get an existing Safe's transaction hash for initialization.
/// Developed to test the initialization of the Station FounderSafe since domains are separated by chainId.
/// To run the script on an existing safe, use the following Foundry command template:
///     `forge script script/PrepareHash.s.sol:PrepareHashScript --fork-url $LINEA_RPC_URL -vvvv`
contract PrepareHashScript is ScriptUtils {
    AdminGuard public adminGuard;
    Safe public founderSafe;

    function run() public {
        vm.startBroadcast();

        adminGuard = AdminGuard(ScriptUtils.safeAdminGuard);
        founderSafe = Safe(payable(ScriptUtils.stationFounderSafe));

        // format array of encoded transactions for Multicall3
        bytes memory addAdminGuardData = abi.encodeWithSelector(GuardManager.setGuard.selector, address(adminGuard));
        bytes memory addModule1Data = abi.encodeWithSelector(ModuleManager.enableModule.selector, ScriptUtils.symmetry);
        bytes memory addModule2Data = abi.encodeWithSelector(ModuleManager.enableModule.selector, ScriptUtils.robriks2);
        Call3 memory addAdminGuardCall =
            Call3({target: ScriptUtils.stationFounderSafe, allowFailure: false, callData: addAdminGuardData});
        Call3 memory addModule1Call =
            Call3({target: ScriptUtils.stationFounderSafe, allowFailure: false, callData: addModule1Data});
        Call3 memory addModule2Call =
            Call3({target: ScriptUtils.stationFounderSafe, allowFailure: false, callData: addModule2Data});
        Call3[] memory calls = new Call3[](3);
        calls[0] = addAdminGuardCall;
        calls[1] = addModule1Call;
        calls[2] = addModule2Call;
        // to use as data param for `Safe::getTransactionHash()`
        bytes memory multicallData = abi.encodeWithSignature("aggregate3((address,bool,bytes)[])", calls);

        uint256 currentNonce = founderSafe.nonce();
        bytes32 digest = founderSafe.getTransactionHash(
            multicall3, 0, multicallData, Enum.Operation.DelegateCall, 0, 0, 0, address(0), address(0), currentNonce
        );

        console.logString("safeTxHash to sign:");
        console.logBytes32(digest);
        string memory dest = "./script/input/unsignedDigest";
        string memory output = Strings.toHexString(uint256(digest));
        vm.writeLine(dest, output);

        vm.stopBroadcast();
    }
}
