pragma solidity 0.4.19;
import "./DailyLimitExtension.sol";


contract DailyLimitExtensionFactory {

    event DailyLimitExtensionCreation(DailyLimitExtension dailyLimitExtension);

    function addExtension(Extension extension)
        public
        pure
    {
        revert();
    }

    function createDailyLimitExtension(address[] tokens, uint[] dailyLimits)
        public
        returns (DailyLimitExtension dailyLimitExtension)
    {
        dailyLimitExtension = new DailyLimitExtension(tokens, dailyLimits);
        DailyLimitExtensionCreation(dailyLimitExtension);
    }

    function createAndAddDailyLimitExtension(address[] tokens, uint[] dailyLimits)
        public
        returns (DailyLimitExtension dailyLimitExtension)
    {
        dailyLimitExtension = createDailyLimitExtension(tokens, dailyLimits);
        this.addExtension(dailyLimitExtension);
    }
}
