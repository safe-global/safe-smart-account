// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {StorageAccessible} from "../common/StorageAccessible.sol";

/**
 * @title ERC-721 Test Token
 */
contract ERC721Token is ERC721, StorageAccessible {
    constructor() ERC721("TestToken", "TT") {}

    function mint(address to, uint256 token) external {
        _mint(to, token);
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
