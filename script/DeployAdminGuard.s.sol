// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {ScriptUtils} from "script/utils/ScriptUtils.sol";
import {AdminGuard} from "contracts/examples/guards/AdminGuard.sol";

contract DeployAdminGuardScript is ScriptUtils {

    // following contracts will be deployed:
    AdminGuard public adminGuard;

    function run() public {
        vm.startBroadcast();
        string memory saltString = ScriptUtils.readSalt("salt"); // "GroupOS"
        bytes32 salt = bytes32(bytes(saltString));
        
        adminGuard = new AdminGuard{salt: salt}(); // -> 0xDB9A089A20D4b8cDef355ca474323b6C832D9776
    }
}