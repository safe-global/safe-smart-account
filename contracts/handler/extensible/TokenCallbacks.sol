// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {ERC1155TokenReceiver} from "../../interfaces/ERC1155TokenReceiver.sol";
import {ERC721TokenReceiver} from "../../interfaces/ERC721TokenReceiver.sol";
import {IERC1155} from "../../interfaces/IERC1155.sol";
import {IERC721} from "../../interfaces/IERC721.sol";

import {ExtensibleBase} from "./ExtensibleBase.sol";

/**
 * @title TokenCallbacks - ERC-1155 and ERC-721 token callbacks for Safes
 * @author mfw78 <mfw78@rndlabs.xyz>
 * @notice Refactored from https://github.com/safe-global/safe-contracts/blob/3c3fc80f7f9aef1d39aaae2b53db5f4490051b0d/contracts/handler/TokenCallbackHandler.sol
 */
abstract contract TokenCallbacks is ExtensibleBase, ERC1155TokenReceiver, ERC721TokenReceiver {
    /**
     * @notice Handles ERC-1155 Token callback.
     * return Standardized onERC1155Received return value.
     */
    function onERC1155Received(address, address, uint256 id, uint256, bytes calldata) external view override returns (bytes4) {
        // The ERC-1155 standard implies that the callback happens **after** the transfer completes,
        // so we can read the balance of the transferred token in order to ensure the transfer was
        // not to the token handler itself, and instead received by a Safe that has this contract
        // configured as a fallback handler. Note that this is best-effort to try and reduce the
        // number of lost tokens sent to the token fallback handler contract and not intended to
        // prevent all unintentional token transfers.
        uint256 balance = IERC1155(_msgSender()).balanceOf(address(this), id);
        require(balance == 0, "cannot receive tokens");

        // Else return the standard value
        return 0xf23a6e61;
    }

    /**
     * @notice Handles ERC-1155 Token batch callback.
     * return Standardized onERC1155BatchReceived return value.
     */
    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata ids,
        uint256[] calldata,
        bytes calldata
    ) external view override returns (bytes4) {
        // Batched version of `onERC1155Received`, see comment there for more details.
        address[] memory owners = new address[](ids.length);
        for (uint256 i = 0; i < owners.length; i++) {
            owners[i] = address(this);
        }
        uint256[] memory balances = IERC1155(_msgSender()).balanceOfBatch(owners, ids);
        for (uint256 i = 0; i < balances.length; i++) {
            require(balances[i] == 0, "cannot receive tokens");
        }

        return 0xbc197c81;
    }

    /**
     * @notice Handles ERC-721 Token callback.
     *  return Standardized onERC721Received return value.
     */
    function onERC721Received(address, address, uint256 tokenId, bytes calldata) external view override returns (bytes4) {
        // The ERC-721 standard implies that the callback happens **after** the transfer completes,
        // so we can read the owner of the transferred token in order to ensure that it wasn't
        // transferred to the token handler itself, and instead received by a Safe that has this
        // contract configured as a fallback handler. Note that this is best-effort to try and
        // reduce the number of lost tokens sent to the token fallback handler contract and not
        // intended to prevent all unintentional token transfers.
        address to = IERC721(_msgSender()).ownerOf(tokenId);
        require(to != address(this), "cannot receive tokens");

        return 0x150b7a02;
    }
}
