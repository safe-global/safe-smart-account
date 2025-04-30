// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title ERC-165 Inteface
 * @dev More details at <https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/introspection/IERC165.sol>
 */
interface IERC165 {
    /**
     * @notice Returns true if this contract implements the interface defined by `interfaceId`.
     * @dev See the corresponding EIP section <https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified>
     *      to learn more about how these ids are created.
     *      This function call must use less than 30.000 gas.
     * @param interfaceId The ID of the interface to check support for.
     * @return Whether or not the interface is supported.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}
