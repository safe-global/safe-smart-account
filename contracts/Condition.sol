pragma solidity 0.4.17;
import "./GnosisSafe.sol";


contract Condition {

    function isExecutable(address owner, address to, uint value, bytes data, GnosisSafe.Operation operation, uint nonce) public returns (bool);
}
