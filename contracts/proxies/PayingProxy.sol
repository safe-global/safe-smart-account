pragma solidity >=0.5.0 <0.7.0;
import "../common/SecuredTokenTransfer.sol";
import "./DelegateConstructorProxy.sol";

/// @title Paying Proxy - Generic proxy contract allows to execute all transactions applying the code of a master contract. It is possible to send along initialization data with the constructor. And sends funds after creation to a specified account.
/// @author Stefan George - <stefan@gnosis.pm>
/// @author Richard Meissner - <richard@gnosis.pm>
contract PayingProxy is DelegateConstructorProxy, SecuredTokenTransfer {

    /// @dev Constructor function sets address of master copy contract.
    /// @param _masterCopy Master copy address.
    /// @param initializer Data used for a delegate call to initialize the contract.
    /// @param funder Address that should be paid for the execution of this call
    /// @param paymentToken Token that should be used for the payment (0 is ETH)
    /// @param payment Value that should be paid
    constructor(address _masterCopy, bytes memory initializer, address payable funder, address paymentToken, uint256 payment)
        DelegateConstructorProxy(_masterCopy, initializer)
        public
    {
        if (payment > 0) {
            if (paymentToken == address(0)) {
                 // solium-disable-next-line security/no-send
                require(funder.send(payment), "Could not pay safe creation with ether");
            } else {
                require(transferToken(paymentToken, funder, payment), "Could not pay safe creation with token");
            }
        }
    }
}
