// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {ERC1155TokenReceiver} from "../interfaces/ERC1155TokenReceiver.sol";
import {ERC721TokenReceiver} from "../interfaces/ERC721TokenReceiver.sol";
import {ERC777TokensRecipient} from "../interfaces/ERC777TokensRecipient.sol";
import {IERC1155} from "../interfaces/IERC1155.sol";
import {IERC165} from "../interfaces/IERC165.sol";
import {IERC721} from "../interfaces/IERC721.sol";
import {HandlerContext} from "./HandlerContext.sol";

/**
 * @title Token Callback Handler
 * @notice Handles supported tokens' callbacks, allowing Safes to receive these tokens.
 * @author Richard Meissner - @rmeissner
 */
contract TokenCallbackHandler is HandlerContext, ERC1155TokenReceiver, ERC777TokensRecipient, ERC721TokenReceiver, IERC165 {
    /**
     * @notice Handles ERC-1155 Token callback.
     * @return Standardized onERC1155Received return value.
     */
    function onERC1155Received(address, address, uint256 id, uint256, bytes calldata) external view override returns (bytes4) {
        // The ERC-1155 standard implies that the callback happens **after** the transfer completes,
        // so we can read the balance of the transferred token in order to ensure the transfer was
        // not to the token handler itself, and instead received by a Safe that has this contract
        // configured as a fallback handler. Note that this is best-effort to try and reduce the
        // number of lost tokens sent to the token fallback handler contract and not intended to
        // prevent all unintentional token transfers.
        uint256 balance = IERC1155(_msgSender()).balanceOf(address(this), id);
        require(balance == 0, "TokenCallbackHandler cannot receive tokens");

        return 0xf23a6e61;
    }

    /**
     * @notice Handles ERC-1155 Token batch callback.
     * @return Standardized onERC1155BatchReceived return value.
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
            require(balances[i] == 0, "TokenCallbackHandler cannot receive tokens");
        }

        return 0xbc197c81;
    }

    /**
     * @notice Handles ERC-721 Token callback.
     * @return Standardized onERC721Received return value.
     */
    function onERC721Received(address, address, uint256 tokenId, bytes calldata) external view override returns (bytes4) {
        // The ERC-721 standard implies that the callback happens **after** the transfer completes,
        // so we can read the owner of the transferred token in order to ensure that it wasn't
        // transferred to the token handler itself, and instead received by a Safe that has this
        // contract configured as a fallback handler. Note that this is best-effort to try and
        // reduce the number of lost tokens sent to the token fallback handler contract and not
        // intended to prevent all unintentional token transfers.
        address to = IERC721(_msgSender()).ownerOf(tokenId);
        require(to != address(this), "TokenCallbackHandler cannot receive tokens");

        return 0x150b7a02;
    }

    /**
     * @notice Handles ERC-777 Token callback.
     * @dev Account that wishes to receive the tokens also needs to register the implementer (this contract) via the ERC-1820 interface registry.
     *      From the standard: "This is done by calling the setInterfaceImplementer function on the ERC-1820 registry with the holder address as
     *      the address, the keccak256 hash of ERC777TokensSender (0x29ddb589b1fb5fc7cf394961c1adf5f8c6454761adf795e67fe149f658abe895) as the
     *      interface hash, and the address of the contract implementing the ERC777TokensSender as the implementer."
     */
    function tokensReceived(address, address, address, uint256, bytes calldata, bytes calldata) external pure override {
        // We implement this for completeness, doesn't really have any value
    }

    /**
     * @notice Implements ERC-165 interface support for ERC1155TokenReceiver, ERC721TokenReceiver and IERC165.
     * @param interfaceId Id of the interface.
     * @return if the interface is supported.
     */
    function supportsInterface(bytes4 interfaceId) external view virtual override returns (bool) {
        return
            interfaceId == type(ERC1155TokenReceiver).interfaceId ||
            interfaceId == type(ERC721TokenReceiver).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }
}
