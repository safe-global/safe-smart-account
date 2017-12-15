pragma solidity 0.4.19;
import "./DailyLimitExtension.sol";
import "../Proxy.sol";


contract DailyLimitExtensionFactory {

    event DailyLimitExtensionCreation(DailyLimitExtension dailyLimitExtension);

    DailyLimitExtension masterCopy;

    function DailyLimitExtensionFactory()
        public
    {
        masterCopy = new DailyLimitExtension(GnosisSafe(this), new address[](0), new uint256[](0));
    }

    function createDailyLimitExtension(GnosisSafe gnosisSafe, address[] tokens, uint256[] dailyLimits)
        public
        returns (DailyLimitExtension dailyLimitExtension)
    {
        dailyLimitExtension = DailyLimitExtension(new Proxy(masterCopy));
        dailyLimitExtension.setup(gnosisSafe, tokens, dailyLimits);
        DailyLimitExtensionCreation(dailyLimitExtension);
    }
}
