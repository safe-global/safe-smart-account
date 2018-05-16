pragma solidity 0.4.24;
import "./DelegateConstructorProxy.sol";

/// @title Paying Proxy - Generic proxy contract allows to execute all transactions applying the code of a master contract. It is possible to send along initialization data with the constructor. And sends funds after creation to a specified account.
/// @author Stefan George - <stefan@gnosis.pm>
/// @author Richard Meissner - <richard@gnosis.pm>
contract PayingProxy is DelegateConstructorProxy {

    /// @dev Constructor function sets address of master copy contract.
    /// @param _masterCopy Master copy address.
    /// @param initializer Data used for a delegate call to initialize the contract.
    constructor(address _masterCopy, bytes initializer, address funder, uint256 amount) DelegateConstructorProxy(_masterCopy, initializer)
        public
    {
        funder.transfer(amount);
    }
}
