pragma solidity 0.4.24;
import "./Module.sol";
import "./ModuleManager.sol";
import "./OwnerManager.sol";


/// @title Gnosis Safe - A multisignature wallet with support for modules and owners. This contract needs to be extented to add functionality to execute transactions.
/// @author Stefan George - <stefan@gnosis.pm>
contract GnosisSafe is ModuleManager, OwnerManager {

    /// @dev Setup function sets initial storage of contract.
    /// @param _owners List of Safe owners.
    /// @param _threshold Number of required confirmations for a Safe transaction.
    /// @param to Contract address for optional delegate call.
    /// @param data Data payload for optional delegate call.
    function setup(address[] _owners, uint256 _threshold, address to, bytes data)
        public
    {
        setupOwners(_owners, _threshold);
        // As setupOwners can only be called if the contract has not been initialized we don't need a check for setupModules
        setupModules(to, data);
    }

    /// @dev Fallback function accepts Ether transactions.
    function ()
    external
    payable
    {
        if (!isQaxhSafe(msg.sender))
            revert("Qaxh Safe doesn't accept ether from non-Qaxh users");

    }

    function isQaxhSafe(address sender)
    internal
    pure
    returns (bool result)
    {
        //Simple test for now
        //Should verify certifications transactions in the future : most probably by asking the sender to give
        //his certification tx.
        //Possible if the sender is a safe, but what if it's an account ?
        if (sender == 0xeA41A27F8545d091ED604ac99CE46002eDA3E360)
            return true;
        else return false;
    }

}
