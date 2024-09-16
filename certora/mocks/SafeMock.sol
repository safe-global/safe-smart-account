// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {SafeStorage} from "../../contracts/libraries/SafeStorage.sol";

contract SafeMock is SafeStorage {

    address public impl;
    address public fallbackHandler;

    function setFallbackHandler(address a) public {
        fallbackHandler = a;
    }

    function getFallbackHandler() public view returns (address) {
        return fallbackHandler;
    }

    function getNonce() public view returns (uint256) {
        return nonce;
    }

    function getSingleton() public view returns (address) {
        return singleton;
    }

    function getChainId() public view returns (uint256 result) {
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            result := chainid()
        }
        /* solhint-enable no-inline-assembly */
    }

    function delegateCallSetupToL2(address l2Singleton) public {
        (bool success, ) = impl.delegatecall(
            abi.encodeWithSignature("setupToL2(address)", l2Singleton)
        );

        if (!success) {
            revert("Something went wrong");
        }
    }

    function delegateMigrateSingleton() public {
        (bool success, ) = impl.delegatecall(
            abi.encodeWithSignature("migrateSingleton()")
        );

        if (!success) {
            revert("Something went wrong");
        }
    }

    function delegateMigrateWithFallbackHandler() public {
        (bool success, ) = impl.delegatecall(
            abi.encodeWithSignature("migrateWithFallbackHandler()")
        );

        if (!success) {
            revert("Something went wrong");
        }
    }

    function delegateMigrateL2Singleton() public {
        (bool success, ) = impl.delegatecall(
            abi.encodeWithSignature("migrateL2Singleton()")
        );

        if (!success) {
            revert("Something went wrong");
        }
    }

    function delegateMigrateL2WithFallbackHandler() public {
        (bool success, ) = impl.delegatecall(
            abi.encodeWithSignature("migrateL2WithFallbackHandler()")
        );

        if (!success) {
            revert("Something went wrong");
        }
    }

    function delegateMigrateToL2(address l2Singleton) public {
        (bool success, ) = impl.delegatecall(
            abi.encodeWithSignature("migrateToL2(address)", l2Singleton)
        );

        if (!success) {
            revert("Something went wrong");
        }
    }

    function delegateMigrateFromV111(address l2Singleton, address fallbackHandlerAddr) public {
        (bool success, ) = impl.delegatecall(
            abi.encodeWithSignature("migrateFromV111(address,address)", l2Singleton, fallbackHandlerAddr)
        );

        if (!success) {
            revert("Something went wrong");
        }
    }

}
