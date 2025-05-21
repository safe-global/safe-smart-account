// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {StorageAccessible} from "../common/StorageAccessible.sol";

/**
 * @title ERC-1155 Test Token
 */
contract ERC1155Token is ERC1155, StorageAccessible {
    constructor() ERC1155("https://example.com") {}

    function mint(address to, uint256 id, uint256 value, bytes calldata data) external {
        _mint(to, id, value, data);
    }

    function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts, bytes calldata data) external {
        _mintBatch(to, ids, amounts, data);
    }

    function trickFallbackHandler(address fallbackHandler) external {
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            sstore(0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5, fallbackHandler)
        }
        /* solhint-enable no-inline-assembly */
    }
}
