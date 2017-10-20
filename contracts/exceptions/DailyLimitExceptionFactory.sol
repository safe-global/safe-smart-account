pragma solidity 0.4.17;
import "./DailyLimitException.sol";


contract DailyLimitExceptionFactory {

    event DailyLimitExceptionCreation(GnosisSafe gnosisSafe, DailyLimitException dailyLimitException);

    function addException(Exception exception)
        public
    {
        revert();
    }

    function create(address[] tokens, uint[] dailyLimits)
        public
        returns (DailyLimitException dailyLimitException)
    {
        dailyLimitException = new DailyLimitException(tokens, dailyLimits);
        DailyLimitExceptionCreation(GnosisSafe(this), dailyLimitException);
        this.addException(dailyLimitException);
    }
}
