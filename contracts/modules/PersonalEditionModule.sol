pragma solidity 0.4.21;
import "../Enum.sol";
import "../Module.sol";
import "../ModuleManager.sol";
import "../OwnerManager.sol";
import "../PersonalEditionBase.sol";


/// @title Personal Edition Module
/// @author Richard Meissner - <richard@gnosis.pm>
contract PersonalEditionModule is MasterCopy, PersonalEditionBase, OwnerManager, Module  {

    string public constant NAME = "Personal Edition Module";
    string public constant VERSION = "0.0.1";

    /// @dev Setup function sets initial storage of contract.
    /// @param _owners List of Safe owners.
    /// @param _threshold Number of required confirmations for a Safe transaction.
    function setup(address[] _owners, uint8 _threshold)
        public
    {
        setManager();
        setupOwners(_owners, _threshold);
        setupPersonalEdition();
    }

    function execute(address to, uint256 value, bytes data, Enum.Operation operation, uint256 gasAdjustment)
        internal
        returns (bool success)
    {
        success = manager.executeModule.gas(gasleft() - gasAdjustment)(to, value, data, operation);
    }

    function transfer(address to, uint256 value)
        internal
    {
        require(execute(to, value, "", Enum.Operation.Call, 0));
    }

}
