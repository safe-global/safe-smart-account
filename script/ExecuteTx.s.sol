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
        founderSafe = Safe(payable(ScriptUtils.stationFounderSafe));
        adminGuard = AdminGuard(ScriptUtils.safeAdminGuard);

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
        /// @notice The owners' signatures should be generated using Foundry's `cast wallet sign` command which uses `eth_sign` under the hood.
        /// As a result, the transaction hash (aka message) that was signed was first prefixed with the following string: "\x19Ethereum Signed Message:\n32"
        /// To pass the deployed Gnosis Safe's signature verification schema, the `eth_sign` branch must be executed.
        /// Therefore, 4 must be added to the signature's `uint8 v` which resides on the far small endian side (64th index).
        /// @notice In keeping with best security practices, the owners' ECDSA signatures should be set as environment variables using the key names below
        /// For example: `export SIG1=0x[r.s.v]` and `export SIG2=0x[r.s.v]`
        bytes memory ownerSig1 = vm.envBytes("SIG1");
        bytes memory ownerSig2 = vm.envBytes("SIG2");

        // signature formatting
        /// @notice Keep in mind that the signatures *must* be ordered by ascending signer address value.
        /// This means the following must be true: `uint160(address(ecrecover(sig1))) < uint160(address(ecrecover(sig2)))`
        signatures = abi.encodePacked(signatures, ownerSig1);
        signatures = abi.encodePacked(signatures, ownerSig2);

        // execution template
        multicallData = abi.encodeWithSignature("aggregate3((address,bool,bytes)[])", calls);

        // check signatures with transaction hash before executing
        uint256 currentNonce = founderSafe.nonce();
        bytes32 digest = founderSafe.getTransactionHash(
            multicall3, 0, multicallData, Enum.Operation.DelegateCall, 0, 0, 0, address(0), address(0), currentNonce
        );
        founderSafe.checkSignatures(digest, multicallData, signatures);

        // if signatures pass, execute transaction using env sigs
        bool r = founderSafe.execTransaction(
            to, value, multicallData, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, signatures
        );
        require(r, "Safe::execTransaction() failed");

        vm.stopBroadcast();
    }
}