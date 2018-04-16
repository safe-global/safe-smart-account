pragma solidity 0.4.21;
import "./GnosisSafe.sol";


/// @title Abstract Extension - Functions to be implemented by extensions.
/// @author Stefan George - <stefan@gnosis.pm>
contract Extension {

    /// @dev Function to be implmeneted by extension. Returns if Safe transaction is valid and can be executed.
    /// @param sender Safe transaction sender address. This is not necessarily a Safe owner and needs to be
    ///        verified in case only Safe owners are allowed.
    /// @param to Destination address.
    /// @param value Ether value.
    /// @param data Data payload.
    /// @param operation Operation type.
    /// @return Returns if transaction can be executed.
    function isExecutable(address sender, address to, uint256 value, bytes data, GnosisSafe.Operation operation) public returns (bool);
}
