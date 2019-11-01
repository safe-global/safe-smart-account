pragma solidity >=0.5.0 <0.7.0;

import "../interfaces/ERC1155TokenReceiver.sol";
import "../external/SafeMath.sol";

contract ERC1155Token {

    using SafeMath for uint256;

    // Mapping from token ID to owner balances
    mapping (uint256 => mapping(address => uint256)) private _balances;

    // Mapping from owner to operator approvals
    mapping (address => mapping(address => bool)) private _operatorApprovals;

    /**
        @dev Get the specified address' balance for token with specified ID.
        @param owner The address of the token holder
        @param id ID of the token
        @return The owner's balance of the token type requested
     */
    function balanceOf(address owner, uint256 id) public view returns (uint256) {
        require(owner != address(0), "ERC1155: balance query for the zero address");
        return _balances[id][owner];
    }

    /**
        @dev Transfers `value` amount of an `id` from the `from` address to the `to` address specified.
        Caller must be approved to manage the tokens being transferred out of the `from` account.
        If `to` is a smart contract, will call `onERC1155Received` on `to` and act appropriately.
        @param from Source address
        @param to Target address
        @param id ID of the token type
        @param value Transfer amount
        @param data Data forwarded to `onERC1155Received` if `to` is a contract receiver
    */
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 value,
        bytes calldata data
    )
        external
    {
        require(to != address(0), "ERC1155: target address must be non-zero");
        require(
            from == msg.sender || _operatorApprovals[from][msg.sender] == true,
            "ERC1155: need operator approval for 3rd party transfers."
        );

        _balances[id][from] = _balances[id][from].sub(value);
        _balances[id][to] = value.add(_balances[id][to]);

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

        _balances[id][to] = value.add(_balances[id][to]);

        _doSafeTransferAcceptanceCheck(msg.sender, address(0), to, id, value, data);
    }

    function isContract(address account) internal view returns (bool) {
        // This method relies in extcodesize, which returns 0 for contracts in
        // construction, since the code is only stored at the end of the
        // constructor execution.

        uint256 size;
        // solium-disable-next-line security/no-inline-assembly
        assembly { size := extcodesize(account) }
        return size > 0;
    }

    function _doSafeTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256 id,
        uint256 value,
        bytes memory data
    )
        internal
    {
        if(isContract(to)) {
            require(
                ERC1155TokenReceiver(to).onERC1155Received(operator, from, id, value, data) ==
                    ERC1155TokenReceiver(to).onERC1155Received.selector,
                "ERC1155: got unknown value from onERC1155Received"
            );
        }
    }
}