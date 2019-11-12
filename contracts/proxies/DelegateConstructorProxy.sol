pragma solidity >=0.5.0 <0.7.0;
import "./Proxy.sol";


/// @title Delegate Constructor Proxy - Generic proxy contract allows to execute all transactions applying the code of a master contract. It is possible to send along initialization data with the constructor.
/// @author Stefan George - <stefan@gnosis.pm>
/// @author Richard Meissner - <richard@gnosis.pm>
contract DelegateConstructorProxy is Proxy {

    /// @dev Constructor function sets address of master copy contract.
    /// @param _masterCopy Master copy address.
    /// @param initializer Data used for a delegate call to initialize the contract.
    constructor(address _masterCopy, bytes memory initializer) Proxy(_masterCopy)
        public
    {
        if (initializer.length > 0) {
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                let masterCopy := and(sload(0), 0xffffffffffffffffffffffffffffffffffffffff)
                let success := delegatecall(sub(gas, 10000), masterCopy, add(initializer, 0x20), mload(initializer), 0, 0)
                let ptr := mload(0x40)
                returndatacopy(ptr, 0, returndatasize())
                if eq(success, 0) { revert(ptr, returndatasize()) }
            }
        }
    }
}
