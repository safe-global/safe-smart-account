// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

// import "forge-std/Test.sol";
import {ScriptUtils} from "script/utils/ScriptUtils.sol";
import {Safe} from "contracts/Safe.sol";
import {GuardManager} from "contracts/base/GuardManager.sol";
import {ModuleManager} from "contracts/base/ModuleManager.sol";
import {OwnerManager} from "contracts/base/OwnerManager.sol";
import {Enum} from "contracts/common/Enum.sol";
import {AdminGuard} from "contracts/examples/guards/AdminGuard.sol";
import {StorageAccessible} from "contracts/common/StorageAccessible.sol";

/// @dev Foundry script to fork the provided chain via RPC URL and simulate a multicall against the forked state.
/// Developed to test the initialization of the Station FounderSafe
/// To run the simulation script on a live chain, use the following Foundry command template:
///     `forge script script/fork/SimulateMulticall.s.sol:SimulateMulticallScript --fork-url $LINEA_RPC_URL -vvvv`
contract SimulateMulticallScript is ScriptUtils {

    Safe public founderSafe;
    AdminGuard public adminGuard;

    address module1;
    address module2;
    bytes symmetrySig;
    bytes paprikaSig;
    bytes signatures;

    function setUp() public {
        founderSafe = Safe(payable(0x5d347E9b0e348a10327F4368a90286b3d1E7FB15));
        adminGuard = AdminGuard(0x2370cB6D6909eAD72b322496628b824DAfDcc3F0);

        module1 = ScriptUtils.symmetry;
        module2 = ScriptUtils.robriks2;

        symmetrySig = bytes(hex'ce285cadc0e8ccef4f5f8bc863811934e074335016a433af83ff68b0b9f6ddbe7948494799a617e5dcdfb564f82829dc4b0bec21643baf5de0aa5a7b35b6a3e31c');
        paprikaSig = bytes(hex'ae5ef721887c166623fa89596d7325c9fb09e293b0792bd75531a5ecce4425137d087930e7981f12c08a91e6d00f46a639f294f4d833ab48faac485169844bad1b');
        signatures = abi.encodePacked(symmetrySig, paprikaSig);
    }

    function run() public {
        // format array of encoded transactions for Multicall3
        bytes memory addAdminGuardData = abi.encodeWithSelector(GuardManager.setGuard.selector, address(adminGuard));
        bytes memory addModule1Data = abi.encodeWithSelector(ModuleManager.enableModule.selector, module1);
        bytes memory addModule2Data = abi.encodeWithSelector(ModuleManager.enableModule.selector, module2);
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
        // to use as data param for `Safe::execTransaction()`
        bytes memory multicallData = abi.encodeWithSignature("aggregate3((address,bool,bytes)[])", calls);

        bool r = founderSafe.execTransaction(
            multicall3, 0, multicallData, Enum.Operation.DelegateCall, 0, 0, 0, address(0), payable(address(0)), signatures
        );
        require(r, "Safe::execTransaction() failed");

        bytes32 guardStorageSlot = keccak256("guard_manager.guard.address");
        address activeGuard =
            address(uint160(uint256(bytes32(StorageAccessible(msg.sender).getStorageAt(uint256(guardStorageSlot), 1)))));
        assert(activeGuard == address(adminGuard));

        (address[] memory modules,) = ModuleManager(msg.sender).getModulesPaginated(address(0x1), type(uint256).max);
        assert(modules[0] == ScriptUtils.symmetry);
        assert(modules[1] == ScriptUtils.robriks2);
    }
}