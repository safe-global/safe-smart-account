pragma solidity ^0.5.3;
import "./Proxy.sol";
import "./IProxyCreationCallback.sol";

/// @title Proxy Factory - Allows to create new proxy contact and execute a message call to the new proxy within one transaction.
/// @author Stefan George - <stefan@gnosis.pm>
contract ProxyFactory {

    event ProxyCreation(Proxy proxy);

    /// @dev Allows to create new proxy contact and execute a message call to the new proxy within one transaction.
    /// @param masterCopy Address of master copy.
    /// @param data Payload for message call sent to new proxy contract.
    function createProxy(address masterCopy, bytes memory data)
        public
        returns (Proxy proxy)
    {
        proxy = new Proxy(masterCopy);
        if (data.length > 0)
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                if eq(call(gas, proxy, 0, add(data, 0x20), mload(data), 0, 0), 0) { revert(0, 0) }
            }
        emit ProxyCreation(proxy);
    }

    /// @dev Allows to retrieve the runtime code of a deployed Proxy. This can be used to check that the expected Proxy was deployed.
    function proxyRuntimeCode() public pure returns (bytes memory) {
        return type(Proxy).runtimeCode;
    }

    /// @dev Allows to retrieve the creation code used for the Proxy deployment. With this it is easily possible to calculate predicted address.
    function proxyCreationCode() public pure returns (bytes memory) {
        return type(Proxy).creationCode;
    }

    /// @dev Allows to create new proxy contact using CREATE2 but it doesn't run the initializer.
    ///      This method is only meant as an utility to be called from other methods
    /// @param _mastercopy Address of master copy.
    /// @param initializer Payload for message call sent to new proxy contract.
    /// @param saltNonce Nonce that will be used to generate the salt to calculate the address of the new proxy contract.
    function deployProxyWithNonce(address _mastercopy, bytes memory initializer, uint256 saltNonce)
        internal
        returns (Proxy proxy)
    {
        // If the initializer changes the proxy address should change too. Hashing the initializer data is cheaper than just concatinating it
        bytes32 salt = keccak256(abi.encodePacked(keccak256(initializer), saltNonce));
        bytes memory deploymentData = abi.encodePacked(type(Proxy).creationCode, uint256(_mastercopy));
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            proxy := create2(0x0, add(0x20, deploymentData), mload(deploymentData), salt)
        }
        require(address(proxy) != address(0), "Create2 call failed");
    }

    /// @dev Allows to create new proxy contact and execute a message call to the new proxy within one transaction.
    /// @param _mastercopy Address of master copy.
    /// @param initializer Payload for message call sent to new proxy contract.
    /// @param saltNonce Nonce that will be used to generate the salt to calculate the address of the new proxy contract.
    function createProxyWithNonce(address _mastercopy, bytes memory initializer, uint256 saltNonce)
        public
        returns (Proxy proxy)
    {
        proxy = deployProxyWithNonce(_mastercopy, initializer, saltNonce);
        if (initializer.length > 0)
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                if eq(call(gas, proxy, 0, add(initializer, 0x20), mload(initializer), 0, 0), 0) { revert(0,0) }
            }
        emit ProxyCreation(proxy);
    }

    /// @dev Allows to create new proxy contact, execute a message call to the new proxy and call a specified callback within one transaction
    /// @param _mastercopy Address of master copy.
    /// @param initializer Payload for message call sent to new proxy contract.
    /// @param saltNonce Nonce that will be used to generate the salt to calculate the address of the new proxy contract.
    /// @param callback Callback that will be invoced after the new proxy contract has been successfully deployed and initialized.
    function createProxyWithCallback(address _mastercopy, bytes memory initializer, uint256 saltNonce, IProxyCreationCallback callback)
        public
        returns (Proxy proxy)
    {
        uint256 saltNonceWithCallback = uint256(keccak256(abi.encodePacked(saltNonce, callback)));
        proxy = createProxyWithNonce(_mastercopy, initializer, saltNonceWithCallback);
        if (address(callback) != address(0))
            callback.proxyCreated(proxy, _mastercopy, initializer, saltNonce);
    }

    /// @dev Allows to get the address for a new proxy contact created via `createProxyWithNonce`
    ///      This method is only meant for address calculation purpose when you use an initializer that would revert,
    ///      therefore the response is returned with a revert. When calling this method set `from` to the address of the proxy factory.
    /// @param _mastercopy Address of master copy.
    /// @param initializer Payload for message call sent to new proxy contract.
    /// @param saltNonce Nonce that will be used to generate the salt to calculate the address of the new proxy contract.
    function calculateCreateProxyWithNonceAddress(address _mastercopy, bytes calldata initializer, uint256 saltNonce)
        external
        returns (Proxy proxy)
    {
        proxy = deployProxyWithNonce(_mastercopy, initializer, saltNonce);
        revert(string(abi.encodePacked(proxy)));
    }

}
