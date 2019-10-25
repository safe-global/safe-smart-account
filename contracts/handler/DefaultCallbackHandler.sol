pragma solidity >=0.5.0 <0.7.0;

import "../interfaces/ERC1155TokenReceiver.sol";
import "../interfaces/ERC721TokenReceiver.sol";
import "../interfaces/ERC777TokensRecipient.sol";

/// @title Default Callback Handler - returns true for known token callbacks
/// @author Richard Meissner - <richard@gnosis.pm>
contract DefaultCallbackHandler is ERC1155TokenReceiver, ERC777TokensRecipient, ERC721TokenReceiver {

    string public constant NAME = "Default Callback Handler";
    string public constant VERSION = "1.0.0";

    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external
        returns(bytes4)
    {
        return 0xf23a6e61;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        returns(bytes4)
    {
        return 0xbc197c81;
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external
        returns(bytes4)
    {
        return 0x150b7a02;
    }

    // solium-disable-next-line no-empty-blocks
    function tokensReceived(address, address, address, uint256, bytes calldata, bytes calldata) external {
        // We implement this for completeness, doesn't really have any value
    }

}