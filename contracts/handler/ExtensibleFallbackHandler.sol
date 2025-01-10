// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {ERC165Handler} from "./extensible/ERC165Handler.sol";
import {IFallbackHandler, FallbackHandler} from "./extensible/FallbackHandler.sol";
import {ERC1271, ISignatureVerifierMuxer, SignatureVerifierMuxer} from "./extensible/SignatureVerifierMuxer.sol";
import {ERC721TokenReceiver, ERC1155TokenReceiver, TokenCallbacks} from "./extensible/TokenCallbacks.sol";

/**
 * @title ExtensibleFallbackHandler - A fully extensible fallback handler for Safes
 * @dev Designed to be used with Safe >= 1.3.0.
 * @author mfw78 <mfw78@rndlabs.xyz>
 */
contract ExtensibleFallbackHandler is FallbackHandler, SignatureVerifierMuxer, TokenCallbacks, ERC165Handler {
    /**
     * Specify specific interfaces (ERC721 + ERC1155) that this contract supports.
     * @param interfaceId The interface ID to check for support
     */
    function _supportsInterface(bytes4 interfaceId) internal pure override returns (bool) {
        return
            interfaceId == type(ERC721TokenReceiver).interfaceId ||
            interfaceId == type(ERC1155TokenReceiver).interfaceId ||
            interfaceId == type(ERC1271).interfaceId ||
            interfaceId == type(ISignatureVerifierMuxer).interfaceId ||
            interfaceId == type(ERC165Handler).interfaceId ||
            interfaceId == type(IFallbackHandler).interfaceId;
    }
}
