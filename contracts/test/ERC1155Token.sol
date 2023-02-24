// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "../interfaces/ERC1155TokenReceiver.sol";
import "../external/SafeMath.sol";

/**
 * @title ERC1155Token - A test ERC1155 token contract
 */
contract ERC1155Token {
    using SafeMath for uint256;

    // Mapping from token ID to owner balances
    mapping(uint256 => mapping(address => uint256)) private _balances;

    // Mapping from owner to operator approvals
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    /**
     * @dev Get the specified address' balance for token with specified ID.
     * @param owner The address of the token holder
     * @param id ID of the token
     * @return The owner's balance of the token type requested
     */
    function balanceOf(address owner, uint256 id) public view returns (uint256) {
        require(owner != address(0), "ERC1155: balance query for the zero address");
        return _balances[id][owner];
    }

    /**
     * @notice Transfers `value` amount of an `id` from the `from` address to the `to` address specified.
     *         Caller must be approved to manage the tokens being transferred out of the `from` account.
     *         If `to` is a smart contract, will call `onERC1155Received` on `to` and act appropriately.
     * @param from Source address
     * @param to Target address
     * @param id ID of the token type
     * @param value Transfer amount
     * @param data Data forwarded to `onERC1155Received` if `to` is a contract receiver
     */
    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes calldata data) external {
        require(to != address(0), "ERC1155: target address must be non-zero");
        require(
            from == msg.sender || _operatorApprovals[from][msg.sender] == true,
            "ERC1155: need operator approval for 3rd party transfers."
        );

        _balances[id][from] = _balances[id][from] - value;
        _balances[id][to] = value + _balances[id][to];

        _doSafeTransferAcceptanceCheck(msg.sender, from, to, id, value, data);
    }

    /**
     * @dev Test function to mint an amount of a token with the given ID
     * @param to The address that will own the minted token
     * @param id ID of the token to be minted
     * @param value Amount of the token to be minted
     * @param data Data forwarded to `onERC1155Received` if `to` is a contract receiver
     */
    function mint(address to, uint256 id, uint256 value, bytes calldata data) external {
        require(to != address(0), "ERC1155: mint to the zero address");

        _balances[id][to] = value + _balances[id][to];

        _doSafeTransferAcceptanceCheck(msg.sender, address(0), to, id, value, data);
    }

    /**
     * @notice Returns true if `account` is a contract.
     * @dev This function will return false if invoked during the constructor of a contract,
     *      as the code is not actually created until after the constructor finishes.
     * @param account The address being queried
     * @return True if `account` is a contract
     */
    function isContract(address account) internal view returns (bool) {
        uint256 size;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }

    /**
     * @dev Internal function to invoke `onERC1155Received` on a target address
     * The call is not executed if the target address is not a contract
     * @param operator  The address which initiated the transfer (i.e. msg.sender)
     * @param from      The address which previously owned the token
     * @param to        The address which will now own the token
     * @param id        The id of the token being transferred
     * @param value     The amount of tokens being transferred
     * @param data      Additional data with no specified format
     */
    function _doSafeTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256 id,
        uint256 value,
        bytes memory data
    ) internal {
        if (isContract(to)) {
            require(
                ERC1155TokenReceiver(to).onERC1155Received(operator, from, id, value, data) ==
                    ERC1155TokenReceiver(to).onERC1155Received.selector,
                "ERC1155: got unknown value from onERC1155Received"
            );
        }
    }
}
