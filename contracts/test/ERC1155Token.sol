// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

/**
 * @title ERC-1155 Test Token
 */
contract ERC1155Token is ERC1155 {
    constructor() ERC1155("https://example.com") {}

    function mint(address to, uint256 id, uint256 value, bytes calldata data) external {
        _mint(to, id, value, data);
    }

    function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts, bytes calldata data) external {
        _mintBatch(to, ids, amounts, data);
    }
}
