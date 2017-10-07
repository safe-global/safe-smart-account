pragma solidity 0.4.17;
import "./DailyLimitExceptionFactory.sol";


contract DailyLimitHelper {
    
    function addException(Exception exception)
        public
    {

    }

    function createAndAddDailyLimitException(DailyLimitExceptionFactory dailyLimitExceptionFactory, address[] tokens, uint[] dailyLimits)
        public
    {
        Exception dailyLimitException = dailyLimitExceptionFactory.create(tokens, dailyLimits);
        this.addException(dailyLimitException);
    }
}
