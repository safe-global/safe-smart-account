// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title ERC-721 Test Token
 */
contract ERC721Token is ERC721 {
    constructor() ERC721("TestToken", "TT") {}

    function mint(address to, uint256 token) external {
        _mint(to, token);
    }
}
