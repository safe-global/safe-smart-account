pragma solidity 0.4.21;
import "./GnosisSafe.sol";


/// @title Abstract Extension - Functions to be implemented by extensions.
/// @author Stefan George - <stefan@gnosis.pm>
contract Extension {

    /// @dev Function to be implemented by extension. This is used to check to what Safe the Extension is attached.
    /// @return Returns the safe the Extension is attached to.
    function getGnosisSafe() public returns (address);
}
