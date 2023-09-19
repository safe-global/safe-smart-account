// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {ScriptUtils} from "script/utils/ScriptUtils.sol";
import {Safe} from "contracts/Safe.sol";
import {SafeProxyFactory} from "contracts/proxies/SafeProxyFactory.sol";
// import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract DeployScript is ScriptUtils {

    Safe public safeImpl;
    SafeProxyFactory public safeProxyFactory;

    function run() public {
        vm.startBroadcast();

        string memory saltString = ScriptUtils.readSalt("salt");
        bytes32 salt = bytes32(bytes(saltString));

        safeImpl = new Safe{salt: salt}();
        safeProxyFactory = new SafeProxyFactory{salt: salt}();

        vm.stopBroadcast();
    }
}
