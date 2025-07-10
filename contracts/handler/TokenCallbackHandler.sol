// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {ERC1155TokenReceiver} from "../interfaces/ERC1155TokenReceiver.sol";
import {ERC721TokenReceiver} from "../interfaces/ERC721TokenReceiver.sol";
import {ERC777TokensRecipient} from "../interfaces/ERC777TokensRecipient.sol";
import {IERC165} from "../interfaces/IERC165.sol";
import {HandlerContext} from "./HandlerContext.sol";

/**
 * @title Token Callback Handler
 * @notice Handles supported tokens' callbacks, allowing Safes to receive these tokens.
 * @dev ⚠️ WARNING: This contract implements various token callback functions, which makes it
 *      possible for itself to receive these tokens despite not being designed to do so,
 *      PERMANENTLY LOCKING THOSE TOKENS. Do not send tokens to this contract.
 * @author Richard Meissner - @rmeissner
 */
contract TokenCallbackHandler is HandlerContext, ERC1155TokenReceiver, ERC777TokensRecipient, ERC721TokenReceiver, IERC165 {
    /**
     * @inheritdoc ERC1155TokenReceiver
     */
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external view override onlyFallback returns (bytes4) {
        return 0xf23a6e61;
    }

    /**
     * @inheritdoc ERC1155TokenReceiver
     */
    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external view override onlyFallback returns (bytes4) {
        return 0xbc197c81;
    }

    /**
     * @inheritdoc ERC721TokenReceiver
     */
    function onERC721Received(address, address, uint256, bytes calldata) external view override onlyFallback returns (bytes4) {
        return 0x150b7a02;
    }

    /**
     * @inheritdoc ERC777TokensRecipient
     * @dev Account that wishes to receive the tokens also needs to register the implementer (this contract) via the ERC-1820 interface registry.
     *      From the standard: "This is done by calling the setInterfaceImplementer function on the ERC-1820 registry with the holder address as
     *      the address, the keccak256 hash of ERC777TokensSender (0x29ddb589b1fb5fc7cf394961c1adf5f8c6454761adf795e67fe149f658abe895) as the
     *      interface hash, and the address of the contract implementing the ERC777TokensSender as the implementer."
     */
    function tokensReceived(address, address, address, uint256, bytes calldata, bytes calldata) external pure override {
        // We implement this for completeness, doesn't really have any value
    }

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(bytes4 interfaceId) external view virtual override returns (bool) {
        return
            interfaceId == type(ERC1155TokenReceiver).interfaceId ||
            interfaceId == type(ERC721TokenReceiver).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }
}
