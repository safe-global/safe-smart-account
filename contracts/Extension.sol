pragma solidity 0.4.19;
import "./GnosisSafe.sol";


/// @title Abstract Extension - Functions to be implemented by extensions.
/// @author Stefan George - <stefan@gnosis.pm>
contract Extension {

    function isExecutable(address sender, address to, uint256 value, bytes data, GnosisSafe.Operation operation) public returns (bool);
}
