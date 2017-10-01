pragma solidity 0.4.17;
import "./GnosisSafe.sol";


contract Exception {

    function isExecutable(address owner, address to, uint value, bytes data, GnosisSafe.Operation operation) public returns (bool);
}
