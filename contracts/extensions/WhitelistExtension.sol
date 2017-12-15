pragma solidity 0.4.19;
import "../Extension.sol";
import "../GnosisSafe.sol";


/// @title Whitelist Extension - Allows to execute transactions to whitelisted addresses without confirmations.
/// @author Stefan George - <stefan@gnosis.pm>
contract WhitelistExtension is Extension {

    string public constant NAME = "Whitelist Extension";
    string public constant VERSION = "0.0.1";

    WhitelistExtension masterCopy;
    GnosisSafe public gnosisSafe;
    mapping (address => bool) public isWhitelisted;

    modifier onlyGnosisSafe() {
        require(msg.sender == address(gnosisSafe));
        _;
    }

    function WhitelistExtension(GnosisSafe _gnosisSafe, address[] accounts)
        public
    {
        setup(_gnosisSafe, accounts);
    }

    function setup(GnosisSafe _gnosisSafe, address[] accounts)
        public
    {
        require(address(gnosisSafe) == 0);
        gnosisSafe = _gnosisSafe;
        for (uint256 i = 0; i < accounts.length; i++) {
            require(accounts[i] != 0);
            isWhitelisted[accounts[i]]= true;
        }
    }

    function changeMasterCopy(WhitelistExtension _masterCopy)
        public
        onlyGnosisSafe
    {
        require(address(_masterCopy) != 0);
        masterCopy = _masterCopy;
    }

    function changeGnosisSafe(GnosisSafe _gnosisSafe)
        public
        onlyGnosisSafe
    {
        require(address(_gnosisSafe) != 0);
        gnosisSafe = _gnosisSafe;
    }

    function addToWhitelist(address account)
        public
        onlyGnosisSafe
    {
        require(account != 0);
        require(!isWhitelisted[account]);
        isWhitelisted[account] = true;
    }

    function removeFromWhitelist(address account)
        public
        onlyGnosisSafe
    {
        require(isWhitelisted[account]);
        isWhitelisted[account] = false;
    }

    function isExecutable(address sender, address to, uint256 value, bytes data, GnosisSafe.Operation operation)
        public
        returns (bool)
    {
        require(gnosisSafe.isOwner(sender));
        if (isWhitelisted[to])
            return true;
        return false;
    }
}
