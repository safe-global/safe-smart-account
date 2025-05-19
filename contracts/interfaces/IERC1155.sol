// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Partial ERC-1155 Interface
 * @dev More details at <https://eips.ethereum.org/EIPS/eip-1155>.
 */
interface IERC1155 {
    /**
     * @notice Get the balance of an account's tokens.
     * @param owner The address of the token holder.
     * @param id ID of the token.
     * @return The `owner`'s balance of the token type requested.
     */
    function balanceOf(address owner, uint256 id) external view returns (uint256);

    /**
     * @notice Get the balance of multiple account/token pairs.
     * @param owners The addresses of the token holders.
     * @param ids ID of the tokens.
     * @return The `owner`'s balance of the token types requested (i.e. balance for each (owner, id) pair)
     */
    function balanceOfBatch(address[] calldata owners, uint256[] calldata ids) external view returns (uint256[] memory);
}
