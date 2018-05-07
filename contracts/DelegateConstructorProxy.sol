pragma solidity 0.4.23;


/// @title Delegate Constructor Proxy - Generic proxy contract allows to execute all transactions applying the code of a master contract. It is possible to send along initialization data with the constructor.
/// @author Stefan George - <stefan@gnosis.pm>
/// @author Richard Meissner - <richard@gnosis.pm>
contract DelegateConstructorProxy {

    // masterCopy always needs to be first declared variable, to ensure that it is at the same location in the contracts to which calls are delegated.
    address masterCopy;

    /// @dev Constructor function sets address of master copy contract.
    /// @param _masterCopy Master copy address.
    /// @param initializer Data used for a delegate call to initialize the contract.
    constructor(address _masterCopy, bytes initializer)
        public
    {
        require(_masterCopy != 0);
        masterCopy = _masterCopy;
        if (initializer.length > 0) {
            delegate(initializer, false);
        }
    }

    /// @dev Fallback function forwards all transactions and returns all received return data.
    function ()
        external
        payable
    {
        delegate(msg.data, true);
    }

    function delegate(bytes _calldata, bool returnData)
        internal
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let masterCopy := and(sload(0), 0xffffffffffffffffffffffffffffffffffffffff)
            let success := delegatecall(sub(gas, 10000), masterCopy, add(_calldata, 0x20), mload(_calldata), 0, 0)
            let ptr := mload(0x40)
            returndatacopy(ptr, 0, returndatasize)
            if eq(success, 0) { revert(ptr, returndatasize) }
            if returnData { return(ptr, returndatasize) }
        }
    }

    function implementation()
        public
        view
        returns (address)
    {
        return masterCopy;
    }

    function proxyType()
        public
        pure
        returns (uint256)
    {
        return 2;
    }
}
