pragma solidity 0.4.19;
import "../Extension.sol";
import "../GnosisSafe.sol";


/// @title Daily Limit Extension - Allows to transfer limited amounts of ERC20 tokens and Ether without confirmations.
/// @author Stefan George - <stefan@gnosis.pm>
contract DailyLimitExtension is Extension {

    string public constant NAME = "Daily Limit Extension";
    string public constant VERSION = "0.0.1";
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

    function DailyLimitExtension(address[] tokens, uint[] _dailyLimits)
        public
    {
        gnosisSafe = GnosisSafe(msg.sender);
        for (uint i = 0; i < tokens.length; i++)
            dailyLimits[tokens[i]].dailyLimit = _dailyLimits[i];
    }

    function changeGnosisSafe(GnosisSafe _gnosisSafe)
        public
        onlyGnosisSafe
    {
        require(address(_gnosisSafe) != 0);
        gnosisSafe = _gnosisSafe;
    }

    function changeDailyLimit(address token, uint dailyLimit)
        public
        onlyGnosisSafe
    {
        dailyLimits[token].dailyLimit = dailyLimit;
    }

    function isExecutable(address sender, address to, uint value, bytes data, GnosisSafe.Operation operation)
        public
        onlyGnosisSafe
        returns (bool)
    {
        require(operation == GnosisSafe.Operation.Call);
        require(gnosisSafe.isOwner(sender));
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
        require(receiver != 0);
        require(amount > 0);
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
