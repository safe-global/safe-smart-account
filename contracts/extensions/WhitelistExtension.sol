pragma solidity 0.4.21;
import "../Extension.sol";
import "../GnosisSafe.sol";


/// @title Whitelist Extension - Allows to execute transactions to whitelisted addresses without confirmations.
/// @author Stefan George - <stefan@gnosis.pm>
contract WhitelistExtension is Extension {

    string public constant NAME = "Whitelist Extension";
    string public constant VERSION = "0.0.1";

    WhitelistExtension masterCopy;
    GnosisSafe public gnosisSafe;

    // isWhitelisted mapping maps destination address to boolean.
    mapping (address => bool) public isWhitelisted;

    modifier onlyGnosisSafe() {
        require(msg.sender == address(gnosisSafe));
        _;
    }

    /// @dev Setup function sets initial storage of contract.
    /// @param accounts List of whitelisted accounts.
    function setup(address[] accounts)
        public
    {
        // gnosisSafe can only be 0 at initalization of contract.
        // Check ensures that setup function can only be called once.
        require(address(gnosisSafe) == 0);
        // Set whitelisted destinations.
        gnosisSafe = GnosisSafe(msg.sender);
        for (uint256 i = 0; i < accounts.length; i++) {
            require(accounts[i] != 0);
            isWhitelisted[accounts[i]]= true;
        }
    }

    /// @dev Allows to upgrade the contract. This can only be done via a Safe transaction.
    /// @param _masterCopy New contract address.
    function changeMasterCopy(WhitelistExtension _masterCopy)
        public
        onlyGnosisSafe
    {
        require(address(_masterCopy) != 0);
        masterCopy = _masterCopy;
    }

    /// @dev Function to be implemented by extension. This is used to check to what Safe the Extension is attached.
    /// @return Returns the safe the Extension is attached to.
    function getGnosisSafe()
        public
        returns (address)
    {
        return gnosisSafe;
    }

    /// @dev Allows to add destination to whitelist. This can only be done via a Safe transaction.
    /// @param account Destination address.
    function addToWhitelist(address account)
        public
        onlyGnosisSafe
    {
        require(account != 0);
        require(!isWhitelisted[account]);
        isWhitelisted[account] = true;
    }

    /// @dev Allows to remove destination from whitelist. This can only be done via a Safe transaction.
    /// @param account Destination address.
    function removeFromWhitelist(address account)
        public
        onlyGnosisSafe
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
        require(gnosisSafe.isOwner(msg.sender));
        require(isWhitelisted[to]);
        gnosisSafe.executeExtension(to, value, data, GnosisSafe.Operation.Call);
    }
}
