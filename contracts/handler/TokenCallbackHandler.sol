// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {ERC1155TokenReceiver} from "../interfaces/ERC1155TokenReceiver.sol";
import {ERC721TokenReceiver} from "../interfaces/ERC721TokenReceiver.sol";
import {ERC777TokensRecipient} from "../interfaces/ERC777TokensRecipient.sol";
import {IERC165} from "../interfaces/IERC165.sol";

/**
 * @title Default Callback Handler - Handles supported tokens' callbacks, allowing Safes to receive these tokens.
 * @author Richard Meissner - @rmeissner
 */
contract TokenCallbackHandler is ERC1155TokenReceiver, ERC777TokensRecipient, ERC721TokenReceiver, IERC165 {
    /**
     * @notice Handles ERC1155 Token callback.
     * @return Standardized onERC1155Received return value.
     */
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure override returns (bytes4) {
        return 0xf23a6e61;
    }

    /**
     * @notice Handles ERC1155 Token batch callback.
     * @return Standardized onERC1155BatchReceived return value.
     */
    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return 0xbc197c81;
    }

    /**
     * @notice Handles ERC721 Token callback.
     * @return Standardized onERC721Received return value.
     */
    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return 0x150b7a02;
    }

    /**
     * @notice Handles ERC777 Token callback.
     * @dev Account that wishes to receive the tokens also needs to register the implementer (this contract) via the ERC-1820 interface registry.
     *      From the standard: "This is done by calling the setInterfaceImplementer function on the ERC-1820 registry with the holder address as
     *      the address, the keccak256 hash of ERC777TokensSender (0x29ddb589b1fb5fc7cf394961c1adf5f8c6454761adf795e67fe149f658abe895) as the
     *      interface hash, and the address of the contract implementing the ERC777TokensSender as the implementer."
     */
    function tokensReceived(address, address, address, uint256, bytes calldata, bytes calldata) external pure override {
        // We implement this for completeness, doesn't really have any value
    }

    /**
     * @notice Implements ERC165 interface support for ERC1155TokenReceiver, ERC721TokenReceiver and IERC165.
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
