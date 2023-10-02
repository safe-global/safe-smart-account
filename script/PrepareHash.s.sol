// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {ScriptUtils} from "script/utils/ScriptUtils.sol";
import {Safe} from "contracts/Safe.sol";
import {SafeProxyFactory} from "contracts/proxies/SafeProxyFactory.sol";
import {SafeProxy} from "contracts/proxies/SafeProxy.sol";
import {Enum} from "contracts/common/Enum.sol";
// import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract PrepareHashScript is ScriptUtils {
    Safe public safeImpl;
    SafeProxyFactory public safeProxyFactory;
    SafeProxy public proxy;

    function run() public {
        vm.startBroadcast();

        bytes memory 

        vm.stopBroadcast();
    }

    function getTransactionHash(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 _nonce
    ) public view returns (bytes32) {
        return keccak256(
            encodeTransactionData(
                to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, _nonce
            )
        );
    }

    function encodeTransactionData(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 _nonce
    ) private view returns (bytes memory) {
        // keccak256(
        //     "SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)"
        // );
        bytes32 SAFE_TX_TYPEHASH = 0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8;
        bytes32 safeTxHash = keccak256(
            abi.encode(
                SAFE_TX_TYPEHASH,
                to,
                value,
                keccak256(data),
                operation,
                safeTxGas,
                baseGas,
                gasPrice,
                gasToken,
                refundReceiver,
                _nonce
            )
        );
        return abi.encodePacked(bytes1(0x19), bytes1(0x01), domainSeparator(), safeTxHash);
    }

    function domainSeparator() public view returns (bytes32) {
        uint256 chainId;
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            chainId := chainid()
        }
        /* solhint-enable no-inline-assembly */

        // keccak256(
        //     "EIP712Domain(uint256 chainId,address verifyingContract)"
        // );
        bytes32 DOMAIN_SEPARATOR_TYPEHASH = 0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218;
        return keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, chainId, stationFounderSafe));
    }
}
