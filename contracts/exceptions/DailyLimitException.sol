pragma solidity 0.4.17;
import "../Exception.sol";
import "../GnosisSafe.sol";


contract DailyLimitException is Exception {

    event DailyLimitChange(address token, uint dailyLimit);

    GnosisSafe public gnosisSafe;
    mapping (address => DailyLimit) public dailyLimits;

    struct DailyLimit {
        uint dailyLimit;
        uint spentToday;
        uint lastDay;
    }

    modifier onlyGnosisSafe() {
        require(msg.sender == address(gnosisSafe));
        _;
    }

    function DailyLimitException(GnosisSafe _gnosisSafe, uint dailyLimit)
        public
    {
        require(address(_gnosisSafe) != 0);
        gnosisSafe = _gnosisSafe;
        dailyLimits[0].dailyLimit = dailyLimit;
        DailyLimitChange(0, dailyLimit);
    }

    function changeDailyLimit(address token, uint dailyLimit)
        public
        onlyGnosisSafe
    {
        dailyLimits[token].dailyLimit = dailyLimit;
        DailyLimitChange(token, dailyLimit);
    }

    function isExecutable(address owner, address to, uint value, bytes data, GnosisSafe.Operation operation)
        public
        onlyGnosisSafe
        returns (bool)
    {
        require(operation == GnosisSafe.Operation.Call);
        address token;
        address receiver;
        uint amount;
        if (data.length == 0) {
            token = 0;
            receiver = to;
            amount = value;
        }
        else if (value == 0) {
            token = to;
            assembly {
                receiver := mload(add(data, 32))
                amount := mload(add(data, 64))
            }
        }
        require(   receiver != 0
                && amount > 0);
        if (isUnderLimit(token, amount))
            return true;
        return false;
    }

    function isUnderLimit(address token, uint amount)
        internal
        returns (bool)
    {
        DailyLimit storage dailyLimit = dailyLimits[token];
        if (today() > dailyLimit.lastDay) {
            dailyLimit.lastDay = today();
            dailyLimit.spentToday = 0;
        }
        if (   dailyLimit.spentToday + amount <= dailyLimit.dailyLimit
            && dailyLimit.spentToday + amount > dailyLimit.spentToday)
            return true;
        return false;
    }

    function today()
        public
        view
        returns (uint)
    {
        return now - (now % 1 days);
    }
}
