pragma solidity 0.4.23;
import "../Module.sol";


/// @title Create and Add Module - Allows to create and add a new module in one transaction.
/// @author Stefan George - <stefan@gnosis.pm>
contract CreateAndAddModule {

    /// @dev Function required to compile contract. Gnosis Safe function is called instead.
    /// @param module Not used.
    function enableModule(Module module)
        public
    {
        revert();
    }

    /// @dev Allows to create and add a new module in one transaction.
    /// @param proxyFactory Module proxy factory contract.
    /// @param data Module constructor payload.
    function createAndAddModule(address proxyFactory, bytes data)
        public
    {
        Module module = createModule(proxyFactory, data);
        this.enableModule(module);
    }

    function createModule(address proxyFactory, bytes data)
        internal
        returns (Module module)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let output := mload(0x40)
            if eq(delegatecall(gas, proxyFactory, add(data, 0x20), mload(data), output, 0x20), 0) { revert(0, 0) }
            module := and(mload(output), 0xffffffffffffffffffffffffffffffffffffffff)
        }
    }
}
