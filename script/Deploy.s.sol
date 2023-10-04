// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {ScriptUtils} from "script/utils/ScriptUtils.sol";
import {Safe} from "contracts/Safe.sol";
import {SafeProxyFactory} from "contracts/proxies/SafeProxyFactory.sol";
import {SafeProxy} from "contracts/proxies/SafeProxy.sol";
// import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract DeployScript is ScriptUtils {

    Safe public safeImpl;
    SafeProxyFactory public safeProxyFactory;
    SafeProxy public proxy;

    function run() public {
        vm.startBroadcast();

        string memory saltString = ScriptUtils.readSalt("salt"); // "GroupOS"
        bytes32 salt = bytes32(bytes(saltString));

        safeImpl = new Safe{salt: salt}(); // -> 0x4aecEDCb5A1DD4615F57dF2672D5399b843F2469
        safeProxyFactory = new SafeProxyFactory{salt: salt}(); // -> 0x17841bb20729B25F23FdC6307dbCCd883Ad30f91

        // deploy the first multisig proxy
        address[] memory owners = new address[](3);
        owners[0] = 0x9e631f0abb90d36aC531085619590d69a01123A5;
        owners[1] = 0xe4530595e6BC56fe453f9Dff61921C807dddDDdC;
        owners[2] = 0xd571d768433976e35fce1C6CBaA9210b5A7dccD7;
        uint256 threshold = 2;
        // empties
        address to; bytes memory data; address fallbackHandler;
        address paymentToken; uint256 payment; address paymentReceiver;
        bytes memory initData = abi.encodeWithSelector(
            Safe.setup.selector, 
            owners, threshold, 
            to, data, fallbackHandler, paymentToken, payment, paymentReceiver); // empty
        uint256 saltNonce = uint256(salt);
        proxy = safeProxyFactory.createProxyWithNonce(address(safeImpl), initData, saltNonce);

        vm.stopBroadcast();
    }
}
