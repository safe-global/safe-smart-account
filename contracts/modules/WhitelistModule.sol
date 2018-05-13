pragma solidity 0.4.23;
import "../Enum.sol";
import "../Module.sol";
import "../ModuleManager.sol";
import "../OwnerManager.sol";


/// @title Whitelist Module - Allows to execute transactions to whitelisted addresses without confirmations.
/// @author Stefan George - <stefan@gnosis.pm>
contract WhitelistModule is Module {

    string public constant NAME = "Whitelist Module";
    string public constant VERSION = "0.0.1";

    // isWhitelisted mapping maps destination address to boolean.
    mapping (address => bool) public isWhitelisted;

    /// @dev Setup function sets initial storage of contract.
    /// @param accounts List of whitelisted accounts.
    function setup(address[] accounts)
        public
    {
        setManager();
        for (uint256 i = 0; i < accounts.length; i++) {
            address account = accounts[i];
            require(account != 0);
            isWhitelisted[account] = true;
        }
    }

    /// @dev Allows to add destination to whitelist. This can only be done via a Safe transaction.
    /// @param account Destination address.
    function addToWhitelist(address account)
        public
        authorized
    {
        require(account != 0);
        require(!isWhitelisted[account]);
        isWhitelisted[account] = true;
    }

    /// @dev Allows to remove destination from whitelist. This can only be done via a Safe transaction.
    /// @param account Destination address.
    function removeFromWhitelist(address account)
        public
        authorized
    {
        require(isWhitelisted[account]);
        isWhitelisted[account] = false;
    }

    /// @dev Returns if Safe transaction is to a whitelisted destination.
    /// @param to Whitelisted destination address.
    /// @param value Not checked.
    /// @param data Not checked.
    /// @return Returns if transaction can be executed.
    function executeWhitelisted(address to, uint256 value, bytes data)
        public
        returns (bool)
    {
        // Only Safe owners are allowed to execute transactions to whitelisted accounts.
        require(OwnerManager(manager).isOwner(msg.sender));
        require(isWhitelisted[to]);
        manager.execTransactionFromModule(to, value, data, Enum.Operation.Call);
    }
}
