pragma solidity 0.4.24;
import "./Module.sol";
import "./ModuleManager.sol";
import "./OwnerManager.sol";


/// @title Gnosis Safe - A multisignature wallet with support for modules and owners. This contract needs to be extented to add functionality to execute transactions.
/// @author Stefan George - <stefan@gnosis.pm>
contract GnosisSafe is ModuleManager, OwnerManager {

    //keccak256(
    //    "EIP712Domain(address verifyingContract)"
    //);
    bytes32 public constant DOMAIN_SEPERATOR_TYPEHASH = 0x035aff83d86937d35b32e04f0ddc6ff469290eef2f1b692d8a815c89404d4749;

    bytes32 public domainSeperator;

    /// @dev Setup function sets initial storage of contract.
    /// @param _owners List of Safe owners.
    /// @param _threshold Number of required confirmations for a Safe transaction.
    /// @param to Contract address for optional delegate call.
    /// @param data Data payload for optional delegate call.
    function setup(address[] _owners, uint256 _threshold, address to, bytes data)
        public
    {
        require(domainSeperator == 0, "Domain Seperator already set!");
        domainSeperator = keccak256(abi.encode(DOMAIN_SEPERATOR_TYPEHASH, this));
        setupOwners(_owners, _threshold);
        // As setupOwners can only be called if the contract has not been initialized we don't need a check for setupModules
        setupModules(to, data);
    }
}
