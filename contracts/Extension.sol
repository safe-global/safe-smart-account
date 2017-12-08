pragma solidity 0.4.19;
import "./GnosisSafe.sol";


contract Extension {

    function isExecutable(address sender, address to, uint256 value, bytes data, GnosisSafe.Operation operation) public returns (bool);
    function changeGnosisSafe(GnosisSafe gnosisSafe) public;
}
