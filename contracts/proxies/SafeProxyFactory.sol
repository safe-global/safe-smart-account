// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {IProxyCreationCallback} from "./IProxyCreationCallback.sol";
import {SafeProxy} from "./SafeProxy.sol";

/**
 * @title Safe Proxy Factory
 * @notice Atomically create and initialize Safe smart accounts.
 * @author Stefan George - @Georgi87
 */
contract SafeProxyFactory {
    /**
     * @notice A new Safe proxy was created.
     * @param proxy The address of the created proxy.
     * @param singleton The proxy's initially configured singleton address.
     */
    event ProxyCreation(SafeProxy indexed proxy, address singleton);

    /**
     * @notice A new Safe proxy was created.
     * @dev This event is similar to {ProxyCreation}, but includes additional creation details to faciliate indexing.
     * @param proxy The address of the created proxy.
     * @param singleton The proxy's initially configured singleton address.
     * @param initializer The initialization payload sent to the proxy after creation.
     * @param saltNonce The salt nonce the proxy was created with.
     */
    event ProxyCreationL2(SafeProxy indexed proxy, address singleton, bytes initializer, uint256 saltNonce);

    /**
     * @notice Retrive the {SafeProxy} creation code.
     * @dev The returned creation code can be used to compute a {SafeProxy} creation address.
     */
    function proxyCreationCode() public pure returns (bytes memory) {
        return type(SafeProxy).creationCode;
    }

    /**
     * @notice Internal method to create a new proxy contract using `CREATE2`. Optionally executes an initializer call to a new proxy.
     * @param _singleton Address of singleton contract. Must be deployed at the time of execution.
     * @param initializer Optional payload for a message call to be sent to a new proxy contract.
     * @param salt `CREATE2` salt to use for calculating the address of the new proxy contract.
     * @return proxy Address of the new proxy contract.
     */
    function deployProxy(address _singleton, bytes memory initializer, bytes32 salt) internal returns (SafeProxy proxy) {
        require(isContract(_singleton), "Singleton contract not deployed");

        bytes memory deploymentData = abi.encodePacked(type(SafeProxy).creationCode, uint256(uint160(_singleton)));
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            proxy := create2(0x0, add(0x20, deploymentData), mload(deploymentData), salt)
        }
        /* solhint-enable no-inline-assembly */
        require(address(proxy) != address(0), "Create2 call failed");

        if (initializer.length > 0) {
            /* solhint-disable no-inline-assembly */
            /// @solidity memory-safe-assembly
            assembly {
                if iszero(call(gas(), proxy, 0, add(initializer, 0x20), mload(initializer), 0, 0)) {
                    revert(0, 0)
                }
            }
            /* solhint-enable no-inline-assembly */
        }
    }

    /**
     * @notice Deploys a new proxy with `_singleton` singleton and `saltNonce` salt. Optionally executes an initializer call to a new proxy.
     * @param _singleton Address of singleton contract. Must be deployed at the time of execution.
     * @param initializer Payload for a message call to be sent to a new proxy contract.
     * @param saltNonce Nonce that will be used to generate the salt to calculate the address of the new proxy contract.
     */
    function createProxyWithNonce(address _singleton, bytes memory initializer, uint256 saltNonce) public returns (SafeProxy proxy) {
        // If the initializer changes, the proxy address should change too. Hashing the initializer data is cheaper than just concatenating it
        bytes32 salt = keccak256(abi.encodePacked(keccak256(initializer), saltNonce));
        proxy = deployProxy(_singleton, initializer, salt);
        emit ProxyCreation(proxy, _singleton);
    }

    /**
     * @notice Deploys a new proxy with `_singleton` singleton and `saltNonce` salt. Optionally executes an initializer call to a new proxy.
     * @dev Emits an extra event to allow tracking of `initializer` and `saltNonce`.
     * @param _singleton Address of singleton contract. Must be deployed at the time of execution.
     * @param initializer Payload for a message call to be sent to a new proxy contract.
     * @param saltNonce Nonce that will be used to generate the salt to calculate the address of the new proxy contract.
     */
    function createProxyWithNonceL2(address _singleton, bytes memory initializer, uint256 saltNonce) public returns (SafeProxy proxy) {
        proxy = createProxyWithNonce(_singleton, initializer, saltNonce);
        emit ProxyCreationL2(proxy, _singleton, initializer, saltNonce);
    }

    /**
     * @notice Deploys a new chain-specific proxy with `_singleton` singleton and `saltNonce` salt. Optionally executes an initializer call to a new proxy.
     * @dev Allows the creation of a new proxy contract that should exist only on a single network (e.g. specific governance or admin accounts)
     *      by including the chain ID in the `CREATE2` salt. Such proxies cannot be created to the same address on other networks by replaying the transaction.
     * @param _singleton Address of singleton contract. Must be deployed at the time of execution.
     * @param initializer Payload for a message call to be sent to a new proxy contract.
     * @param saltNonce Nonce that will be used to generate the salt to calculate the address of the new proxy contract.
     */
    function createChainSpecificProxyWithNonce(
        address _singleton,
        bytes memory initializer,
        uint256 saltNonce
    ) public returns (SafeProxy proxy) {
        // If the initializer changes the proxy address should change too. Hashing the initializer data is cheaper than just concatenating it
        bytes32 salt = keccak256(abi.encodePacked(keccak256(initializer), saltNonce, getChainId()));
        proxy = deployProxy(_singleton, initializer, salt);
        emit ProxyCreation(proxy, _singleton);
    }

    /**
     * @notice Deploy a new proxy with `_singleton` singleton and `saltNonce` salt.
     *         Optionally executes an initializer call to a new proxy and calls a specified callback address `callback`.
     * @param _singleton Address of singleton contract. Must be deployed at the time of execution.
     * @param initializer Payload for a message call to be sent to a new proxy contract.
     * @param saltNonce Nonce that will be used to generate the salt to calculate the address of the new proxy contract.
     * @param callback Callback that will be invoked after the new proxy contract has been successfully deployed and initialized.
     */
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

    /**
     * @notice Deploy a new proxy with `_singleton` singleton and `saltNonce` salt.
     *         Optionally executes an initializer call to a new proxy and calls a specified callback address `callback`.
     * @dev Emits an extra event to allow tracking of `initializer` and `saltNonce`.
     * @param _singleton Address of singleton contract. Must be deployed at the time of execution.
     * @param initializer Payload for a message call to be sent to a new proxy contract.
     * @param saltNonce Nonce that will be used to generate the salt to calculate the address of the new proxy contract.
     * @param callback Callback that will be invoked after the new proxy contract has been successfully deployed and initialized.
     */
    function createProxyWithCallbackL2(
        address _singleton,
        bytes memory initializer,
        uint256 saltNonce,
        IProxyCreationCallback callback
    ) public returns (SafeProxy proxy) {
        uint256 saltNonceWithCallback = uint256(keccak256(abi.encodePacked(saltNonce, callback)));
        proxy = createProxyWithNonceL2(_singleton, initializer, saltNonceWithCallback);
        if (address(callback) != address(0)) callback.proxyCreated(proxy, _singleton, initializer, saltNonce);
    }

    /**
     * @notice Best-effort check of whether an address corresponds to a contract or an externally owned account (EOA).
     * @dev This function relies on the `EXTCODESIZE` assembly opcode to determine whether an address is a contract.
     *      It may return incorrect results in some edge cases (for example, during contract creation).
     * @param account The address of the account to be checked.
     * @return A boolean value indicating whether the address has code (true) or not (false).
     */
    function isContract(address account) internal view returns (bool) {
        uint256 size;
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            size := extcodesize(account)
        }
        /* solhint-enable no-inline-assembly */

        // If the code size is greater than 0, it appears to be a contract; otherwise, it appears to be an EOA.
        return size > 0;
    }

    /**
     * @notice Returns the ID of the chain the contract is currently deployed on.
     * @return The ID of the current chain as a {uint256}.
     */
    function getChainId() public view returns (uint256) {
        uint256 id;
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            id := chainid()
        }
        /* solhint-enable no-inline-assembly */
        return id;
    }
}
