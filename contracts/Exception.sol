pragma solidity 0.4.17;
import "./GnosisSafe.sol";


contract Exception {

    function isExecutable(address sender, address to, uint value, bytes data, GnosisSafe.Operation operation) public returns (bool);
}
