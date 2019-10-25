pragma solidity >=0.5.0 <0.7.0;


/// @title EtherPaymentFallback - A contract that has a fallback to accept ether payments
/// @author Richard Meissner - <richard@gnosis.pm>
contract EtherPaymentFallback {

    /// @dev Fallback function accepts Ether transactions.
    function ()
        external
        payable
    {

    }
}
