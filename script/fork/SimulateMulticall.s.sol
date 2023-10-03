// SPDX-License-Identifier: AGPL
pragma solidity ^0.8.13;

import {console} from "forge-std/console.sol";
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

    /// @dev *Important* See documentation below at the assignment of these variables
    bytes symmetrySig;
    bytes paprikaSig;
    bytes signatures;

    function setUp() public {
        founderSafe = Safe(payable(0x5d347E9b0e348a10327F4368a90286b3d1E7FB15));
        adminGuard = AdminGuard(0x2370cB6D6909eAD72b322496628b824DAfDcc3F0);

        module1 = ScriptUtils.symmetry;
        module2 = ScriptUtils.robriks2;

        /// @notice The owners' signatures should be generated using Foundry's `cast wallet sign` command which uses `eth_sign` under the hood.
        /// As a result, the transaction hash (aka message) that was signed was first prefixed with the following string: "\x19Ethereum Signed Message:\n32"
        /// To pass the deployed Gnosis Safe's signature verification schema, the `eth_sign` branch must be executed.
        /// Therefore, 4 must be added to the signature's `uint8 v` which resides on the far small endian side (64th index).
        /// @notice In keeping with best security practices, the owners' ECDSA signatures should be set as environment variables using the key names below
        /// For example: `export SIG1=0x[r.s.v]` and `export SIG2=0x[r.s.v]`
        symmetrySig = vm.envBytes("SIG1");
        paprikaSig = vm.envBytes("SIG2");
        /// @notice Keep in mind that the signatures *must* be ordered by ascending signer address value.
        /// This means the following must be true: `uint160(address(ecrecover(sig1))) < uint160(address(ecrecover(sig2)))`
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

        // guard storage slot must be checked explicitly
        bytes32 guardStorageSlot = keccak256("guard_manager.guard.address");
        address activeGuard =
            address(uint160(uint256(bytes32(StorageAccessible(founderSafe).getStorageAt(uint256(guardStorageSlot), 1)))));
        
        // assert guard value is correct
        assert(activeGuard == address(adminGuard));

        (address[] memory modules,) = ModuleManager(founderSafe).getModulesPaginated(address(0x1), 32);
        
        // assert module values are correct
        for (uint256 i; i < modules.length; ++i) {
            assert(modules[i] == ScriptUtils.symmetry || modules[i] == ScriptUtils.robriks2);
        }
    }
}