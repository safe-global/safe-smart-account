pragma solidity ^0.5.0;
import "./Module.sol";
import "./ModuleManager.sol";
import "./OwnerManager.sol";


/// @title Base Safe - A multisignature wallet with support for modules and owners. This contract needs to be extented to add functionality to execute transactions.
/// @author Stefan George - <stefan@gnosis.pm>
/// @author Richard Meissner - <richard@gnosis.pm>
contract BaseSafe is ModuleManager, OwnerManager {

    /// @dev Setup function sets initial storage of contract.
    /// @param _owners List of Safe owners.
    /// @param _threshold Number of required confirmations for a Safe transaction.
    /// @param to Contract address for optional delegate call.
    /// @param data Data payload for optional delegate call.
    function setupSafe(address[] memory _owners, uint256 _threshold, address to, bytes memory data)
        internal
    {
        setupOwners(_owners, _threshold);
        // As setupOwners can only be called if the contract has not been initialized we don't need a check for setupModules
        setupModules(to, data);
    }
}
