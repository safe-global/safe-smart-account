pragma solidity >=0.6.0 <0.7.0;
import "@gnosis.pm/mock-contract/contracts/MockContract.sol";
interface Token {
	function transfer(address _to, uint value) external returns (bool);
}
