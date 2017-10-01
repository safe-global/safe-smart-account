pragma solidity 0.4.17;
import "./DailyLimitException.sol";


contract DailyLimitExceptionFactory {

    event DailyLimitExceptionCreation(GnosisSafe indexed gnosisSafe, DailyLimitException dailyLimitException);

    function create(uint dailyLimit)
        public
        returns (DailyLimitException dailyLimitException)
    {
        dailyLimitException = new DailyLimitException(GnosisSafe(msg.sender), dailyLimit);
        DailyLimitExceptionCreation(GnosisSafe(msg.sender), dailyLimitException);
    }
}
