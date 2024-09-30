// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
import "@safe-global/mock-contract/contracts/MockContract.sol";

interface Token {
    function transfer(address _to, uint256 value) external returns (bool);
}
