pragma solidity 0.4.17;
import "./WhitelistException.sol";


contract WhitelistExceptionFactory {

    event WhitelistExceptionCreation(GnosisSafe indexed gnosisSafe, WhitelistException whitelistException);

    function create(address[] whitelist)
        public
        returns (WhitelistException whitelistException)
    {
        whitelistException = new WhitelistException(GnosisSafe(msg.sender), whitelist);
        WhitelistExceptionCreation(GnosisSafe(msg.sender), whitelistException);
    }
}
