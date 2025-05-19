// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Partial ERC-721 Interface
 * @dev More details at <https://eips.ethereum.org/EIPS/eip-721>.
 */
interface IERC721 {
    /**
     * @notice Find the owner of an NFT.
     * @param tokenId The identifier for an NFT.
     * @return The address of the owner of the NFT.
     */
    function ownerOf(uint256 tokenId) external view returns (address);
}
