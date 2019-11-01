pragma solidity >=0.5.0 <0.7.0;
import "@gnosis.pm/mock-contract/contracts/MockContract.sol";
contract Token {
	function transfer(address _to, uint value) public returns (bool);
}
