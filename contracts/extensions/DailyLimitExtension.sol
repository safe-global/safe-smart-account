pragma solidity 0.4.19;
import "../Extension.sol";
import "../GnosisSafe.sol";


/// @title Daily Limit Extension - Allows to transfer limited amounts of ERC20 tokens and Ether without confirmations.
/// @author Stefan George - <stefan@gnosis.pm>
contract DailyLimitExtension is Extension {

    string public constant NAME = "Daily Limit Extension";
    string public constant VERSION = "0.0.1";
    bytes4 public constant TRANSFER_FUNCTION_IDENTIFIER = hex"a9059cbb";

    DailyLimitExtension masterCopy;
    GnosisSafe public gnosisSafe;
    mapping (address => DailyLimit) public dailyLimits;

    struct DailyLimit {
        uint256 dailyLimit;
        uint256 spentToday;
        uint256 lastDay;
    }

    modifier onlyGnosisSafe() {
        require(msg.sender == address(gnosisSafe));
        _;
    }

    function DailyLimitExtension(address[] tokens, uint256[] _dailyLimits)
        public
    {
        setup(tokens, _dailyLimits);
    }

    function setup(address[] tokens, uint256[] _dailyLimits)
        public
    {
        require(address(gnosisSafe) == 0);
        gnosisSafe = GnosisSafe(msg.sender);
        for (uint256 i = 0; i < tokens.length; i++)
            dailyLimits[tokens[i]].dailyLimit = _dailyLimits[i];
    }

    function changeMasterCopy(DailyLimitExtension _masterCopy)
        public
        onlyGnosisSafe
    {
        require(address(_masterCopy) != 0);
        masterCopy = _masterCopy;
    }

    function changeDailyLimit(address token, uint256 dailyLimit)
        public
        onlyGnosisSafe
    {
        dailyLimits[token].dailyLimit = dailyLimit;
    }

    function isExecutable(address sender, address to, uint256 value, bytes data, GnosisSafe.Operation operation)
        public
        onlyGnosisSafe
        returns (bool)
    {
        require(gnosisSafe.isOwner(sender));
        require(operation == GnosisSafe.Operation.Call);
        require(data.length == 0 && value > 0 || data.length > 0 && value == 0);
        address token;
        address receiver;
        uint256 amount;
        if (data.length == 0) {
            token = 0;
            receiver = to;
            amount = value;
        }
        else {
            token = to;
            bytes4 functionIdentifier;
            assembly {
                functionIdentifier := mload(add(data, 0x20))
                receiver := mload(add(data, 0x24))
                amount := mload(add(data, 0x44))
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

    function isUnderLimit(address token, uint256 amount)
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
