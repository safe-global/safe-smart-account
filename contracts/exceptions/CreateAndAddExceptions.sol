pragma solidity 0.4.17;
import "./DailyLimitExceptionFactory.sol";
import "./WhitelistExceptionFactory.sol";
import "./LastResortExceptionFactory.sol";


contract CreateAndAddExceptions {
    
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

    function createAndAddWhitelistException(WhitelistExceptionFactory whitelistExceptionFactory, address[] whitelist)
        public
    {
        Exception whitelistException = whitelistExceptionFactory.create(whitelist);
        this.addException(whitelistException);
    }

    function createAndAddLastResortException(LastResortExceptionFactory lastResortExceptionFactory, uint requiredDeposit, uint challengePeriod)
        public
    {
        Exception lastResortException = lastResortExceptionFactory.create(requiredDeposit, challengePeriod);
        this.addException(lastResortException);
    }
}
