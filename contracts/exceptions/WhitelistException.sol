pragma solidity 0.4.17;
import "../Exception.sol";
import "../GnosisSafe.sol";


contract WhitelistException is Exception {

    event WhitelistAddition(address account);
    event WhitelistRemoval(address account);

    GnosisSafe public gnosisSafe;
    mapping (address => bool) isWhitelisted;

    modifier onlyGnosisSafe() {
        require(msg.sender == address(gnosisSafe));
        _;
    }

    function WhitelistException(GnosisSafe _gnosisSafe, address[] accounts)
        public
    {
        require(address(_gnosisSafe) != 0);
        gnosisSafe = _gnosisSafe;
        for (uint i = 0; i < accounts.length; i++) {
            require(accounts[i] != 0);
            isWhitelisted[accounts[i]]= true;
            WhitelistAddition(accounts[i]);
        }
    }

    function addToWhitelist(address account)
        public
        onlyGnosisSafe
    {
        require(   account != 0
                && !isWhitelisted[account]);
        isWhitelisted[account] = true;
        WhitelistAddition(account);
    }

    function removeFromWhitelist(address account)
        public
        onlyGnosisSafe
    {
        require(isWhitelisted[account]);
        isWhitelisted[account] = false;
        WhitelistRemoval(account);
    }

    function isExecutable(address owner, address to, uint value, bytes data, GnosisSafe.Operation operation)
        public
        onlyGnosisSafe
        returns (bool)
    {
        if (isWhitelisted[to])
            return true;
        return false;
    }
}
