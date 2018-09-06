pragma solidity ^0.4.23;
import "mock-contract/contracts/MockContract.sol";
contract Token {
	function transfer(address _to, uint value) public returns (bool);
}
