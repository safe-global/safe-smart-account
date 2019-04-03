pragma solidity ^0.5.0;
import "../base/Module.sol";


/// @title Create and Add Modules - Allows to create and add multiple module in one transaction.
/// @author Stefan George - <stefan@gnosis.pm>
/// @author Richard Meissner - <richard@gnosis.pm>
contract CreateAndAddModules {

    /// @dev Function required to compile contract. Gnosis Safe function is called instead.
    /// @param module Not used.
    function enableModule(Module module)
        public
    {
        revert();
    }

    /// @dev Allows to create and add multiple module in one transaction.
    /// @param proxyFactory Module proxy factory contract.
    /// @param data Modules constructor payload. This is the data for each proxy factory call concatinated. (e.g. <byte_array_len_1><byte_array_data_1><byte_array_len_2><byte_array_data_2>)
    function createAndAddModules(address proxyFactory, bytes memory data)
        public
    {
        uint256 length = data.length;
        Module module;
        uint256 i = 0;
        while (i < length) {
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                let createBytesLength := mload(add(0x20, add(data, i)))
                let createBytes := add(0x40, add(data, i))

                let output := mload(0x40)
                if eq(delegatecall(gas, proxyFactory, createBytes, createBytesLength, output, 0x20), 0) { revert(0, 0) }
                module := and(mload(output), 0xffffffffffffffffffffffffffffffffffffffff)

                // Data is always padded to 32 bytes
                i := add(i, add(0x20, mul(div(add(createBytesLength, 0x1f), 0x20), 0x20)))
            }
            this.enableModule(module);
        }
    }
}
