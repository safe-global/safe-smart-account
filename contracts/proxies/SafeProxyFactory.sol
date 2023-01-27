// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "./SafeProxy.sol";
import "./IProxyCreationCallback.sol";

/// @title Proxy Factory - Allows to create a new proxy contract and execute a message call to the new proxy within one transaction.
/// @author Stefan George - <stefan@gnosis.pm>
contract SafeProxyFactory {
    event ProxyCreation(SafeProxy proxy, address singleton);

    /// @dev Allows to retrieve the creation code used for the Proxy deployment. With this it is easily possible to calculate predicted address.
    function proxyCreationCode() public pure returns (bytes memory) {
        return type(SafeProxy).creationCode;
    }

    /// @dev Allows to create a new proxy contract using CREATE2. Optionally executes an initializer call to a new proxy.
    ///      This method is only meant as an utility to be called from other methods
    /// @param _singleton Address of singleton contract. Must be deployed at the time of execution.
    /// @param initializer Payload for a message call to be sent to a new proxy contract.
    /// @param salt Create2 salt to use for calculating the address of the new proxy contract.
    function deployProxy(address _singleton, bytes memory initializer, bytes32 salt) internal returns (SafeProxy proxy) {
        require(isContract(_singleton), "Singleton contract not deployed");

        bytes memory deploymentData = abi.encodePacked(type(SafeProxy).creationCode, uint256(uint160(_singleton)));
        // solhint-disable-next-line no-inline-assembly
        assembly {
            proxy := create2(0x0, add(0x20, deploymentData), mload(deploymentData), salt)
        }
        require(address(proxy) != address(0), "Create2 call failed");

        if (initializer.length > 0) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                if eq(call(gas(), proxy, 0, add(initializer, 0x20), mload(initializer), 0, 0), 0) {
                    revert(0, 0)
                }
            }
        }
    }

    /// @dev Allows to create a new proxy contract and execute a message call to the new proxy within one transaction.
    /// @param _singleton Address of singleton contract. Must be deployed at the time of execution.
    /// @param initializer Payload for a message call to be sent to a new proxy contract.
    /// @param saltNonce Nonce that will be used to generate the salt to calculate the address of the new proxy contract.
    function createProxyWithNonce(address _singleton, bytes memory initializer, uint256 saltNonce) public returns (SafeProxy proxy) {
        // If the initializer changes the proxy address should change too. Hashing the initializer data is cheaper than just concatinating it
        bytes32 salt = keccak256(abi.encodePacked(keccak256(initializer), saltNonce));
        proxy = deployProxy(_singleton, initializer, salt);
        emit ProxyCreation(proxy, _singleton);
    }

    /// @dev Allows to create a new proxy contract that should exist only on 1 network (e.g. specific governance or admin accounts)
    ///      by including the chain id in the create2 salt. Such proxies cannot be created on other networks by replaying the transaction.
    /// @param _singleton Address of singleton contract. Must be deployed at the time of execution.
    /// @param initializer Payload for a message call to be sent to a new proxy contract.
    /// @param saltNonce Nonce that will be used to generate the salt to calculate the address of the new proxy contract.
    function createChainSpecificProxyWithNonce(
        address _singleton,
        bytes memory initializer,
        uint256 saltNonce
    ) public returns (SafeProxy proxy) {
        // If the initializer changes the proxy address should change too. Hashing the initializer data is cheaper than just concatinating it
        bytes32 salt = keccak256(abi.encodePacked(keccak256(initializer), saltNonce, getChainId()));
        proxy = deployProxy(_singleton, initializer, salt);
        emit ProxyCreation(proxy, _singleton);
    }

    /// @dev Allows to create a new proxy contract, execute a message call to the new proxy and call a specified callback within one transaction
    /// @param _singleton Address of singleton contract. Must be deployed at the time of execution.
    /// @param initializer Payload for a message call to be sent to a new proxy contract.
    /// @param saltNonce Nonce that will be used to generate the salt to calculate the address of the new proxy contract.
    /// @param callback Callback that will be invoked after the new proxy contract has been successfully deployed and initialized.
    function createProxyWithCallback(
        address _singleton,
        bytes memory initializer,
        uint256 saltNonce,
        IProxyCreationCallback callback
    ) public returns (SafeProxy proxy) {
        uint256 saltNonceWithCallback = uint256(keccak256(abi.encodePacked(saltNonce, callback)));
        proxy = createProxyWithNonce(_singleton, initializer, saltNonceWithCallback);
        if (address(callback) != address(0)) callback.proxyCreated(proxy, _singleton, initializer, saltNonce);
    }

    /// @dev Returns true if `account` is a contract.
    /// @param account The address being queried
    function isContract(address account) internal view returns (bool) {
        uint256 size;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }

    /// @dev Returns the chain id used by this contract.
    function getChainId() public view returns (uint256) {
        uint256 id;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            id := chainid()
        }
        return id;
    }
}
