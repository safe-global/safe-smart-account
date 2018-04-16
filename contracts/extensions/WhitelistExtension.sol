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
    /// @param sender Safe owner sending Safe transaction.
    /// @param to Whitelisted destination address.
    /// @param value Not checked.
    /// @param data Not checked.
    /// @param operation Only Call operations are allowed.
    /// @return Returns if transaction can be executed.
    function isExecutable(address sender, address to, uint256 value, bytes data, GnosisSafe.Operation operation)
        public
        returns (bool)
    {
        // Only Safe owners are allowed to execute transactions to whitelisted accounts.
        require(gnosisSafe.isOwner(sender));
        require(operation == GnosisSafe.Operation.Call);
        if (isWhitelisted[to])
            return true;
        return false;
    }
}
