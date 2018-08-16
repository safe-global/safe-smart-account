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

    /// @dev Allows to estimate a Safe transaction. 
    ///      This method is only meant for estimation purpose, therfore two different protection mechanism against execution in a transaction have been made:
    ///      1.) The method can only be called from the safe itself
    ///      2.) The response is returned with a revert
    ///      When estimating set `from` to the address of the safe.
    ///      Since the `estimateGas` function includes refunds, call this method to get an estimated of the costs required by the Safe to call `execute`
    /// @param to Destination address of Safe transaction.
    /// @param value Ether value of Safe transaction.
    /// @param data Data payload of Safe transaction.
    /// @param operation Operation type of Safe transaction.
    /// @return Estimate without refunds and overhead fees (base transaction and payload data gas costs).
    function requiredTxGas(address to, uint256 value, bytes data, Enum.Operation operation)
        public
        authorized
        returns (uint256)
    {
        uint256 startGas = gasleft();
        // We don't provide an error message here, as we use it to return the estimate
        // solium-disable-next-line error-reason
        require(execute(to, value, data, operation, gasleft()));
        uint256 requiredGas = startGas - gasleft();
        // Convert response to string and return via error message
        revert(string(abi.encodePacked(requiredGas)));
    }
}
