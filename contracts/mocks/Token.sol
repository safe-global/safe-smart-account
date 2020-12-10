// SPDX-License-Identifier: LGPL-3.0-or-later
pragma solidity >=0.6.0 <0.8.0;
import "@gnosis.pm/mock-contract/contracts/MockContract.sol";
abstract contract Token {
	function transfer(address _to, uint value) public virtual returns (bool);
}
