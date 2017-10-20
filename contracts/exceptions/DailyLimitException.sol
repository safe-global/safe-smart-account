pragma solidity 0.4.17;
import "../Exception.sol";
import "../GnosisSafe.sol";


/// @title Daily Limit Exception - Allows to transfer limited amounts of ERC20 tokens and Ether without confirmations.
/// @author Stefan George - <stefan@gnosis.pm>
contract DailyLimitException is Exception {

    event DailyLimitChange(address token, uint dailyLimit);

    bytes4 public constant TRANSFER_FUNCTION_IDENTIFIER = hex"a9059cbb";

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

    function DailyLimitException(address[] tokens, uint[] _dailyLimits)
        public
    {
        gnosisSafe = GnosisSafe(msg.sender);
        for (uint i = 0; i < tokens.length; i++) {
            dailyLimits[tokens[i]].dailyLimit = _dailyLimits[i];
            DailyLimitChange(tokens[i], _dailyLimits[i]);
        }
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
            bytes4 functionIdentifier;
            assembly {
                functionIdentifier := mload(add(data, 32))
                receiver := mload(add(data, 36))
                amount := mload(add(data, 68))
            }
            require(functionIdentifier == TRANSFER_FUNCTION_IDENTIFIER);
        }
        require(   receiver != 0
                && amount > 0);
        if (isUnderLimit(token, amount)) {
            dailyLimits[token].spentToday += amount;
            return true;
        }
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
