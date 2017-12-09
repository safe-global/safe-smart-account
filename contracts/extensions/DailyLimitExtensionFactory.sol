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

    function createDailyLimitExtension(GnosisSafe gnosisSafe, address[] tokens, uint256[] dailyLimits)
        public
        returns (DailyLimitExtension dailyLimitExtension)
    {
        dailyLimitExtension = new DailyLimitExtension(gnosisSafe, tokens, dailyLimits);
        DailyLimitExtensionCreation(dailyLimitExtension);
    }

    function createAndAddDailyLimitExtension(GnosisSafe gnosisSafe, address[] tokens, uint256[] dailyLimits)
        public
        returns (DailyLimitExtension dailyLimitExtension)
    {
        dailyLimitExtension = createDailyLimitExtension(gnosisSafe, tokens, dailyLimits);
        this.addExtension(dailyLimitExtension);
    }
}
