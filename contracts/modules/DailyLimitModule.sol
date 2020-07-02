pragma solidity >=0.5.0 <0.7.0;
import "../base/Module.sol";
import "../base/ModuleManager.sol";
import "../base/OwnerManager.sol";
import "../common/Enum.sol";


/// @title Daily Limit Module - Allows to transfer limited amounts of ERC20 tokens and Ether without confirmations.
/// @author Stefan George - <stefan@gnosis.pm>
contract DailyLimitModule is Module {

    string public constant NAME = "Daily Limit Module";
    string public constant VERSION = "0.1.0";

    // dailyLimits mapping maps token address to daily limit settings.
    mapping (address => DailyLimit) public dailyLimits;

    struct DailyLimit {
        uint256 dailyLimit;
        uint256 spentToday;
        uint256 lastDay;
    }

    /// @dev Setup function sets initial storage of contract.
    /// @param tokens List of token addresses. Ether is represented with address 0x0.
    /// @param _dailyLimits List of daily limits in smalles units (e.g. Wei for Ether).
    function setup(address[] memory tokens, uint256[] memory _dailyLimits)
        public
    {
        setManager();
        for (uint256 i = 0; i < tokens.length; i++)
            dailyLimits[tokens[i]].dailyLimit = _dailyLimits[i];
    }

    /// @dev Allows to update the daily limit for a specified token. This can only be done via a Safe transaction.
    /// @param token Token contract address.
    /// @param dailyLimit Daily limit in smallest token unit.
    function changeDailyLimit(address token, uint256 dailyLimit)
        public
        authorized
    {
        dailyLimits[token].dailyLimit = dailyLimit;
    }

    /// @dev Returns if Safe transaction is a valid daily limit transaction.
    /// @param token Address of the token that should be transfered (0 for Ether)
    /// @param to Address to which the tokens should be transfered
    /// @param amount Amount of tokens (or Ether) that should be transfered
    /// @return Returns if transaction can be executed.
    function executeDailyLimit(address token, address to, uint256 amount)
        public
    {
        // Only Safe owners are allowed to execute daily limit transactions.
        require(OwnerManager(address(manager)).isOwner(msg.sender), "Method can only be called by an owner");
        require(to != address(0), "Invalid to address provided");
        require(amount > 0, "Invalid amount provided");
        // Validate that transfer is not exceeding daily limit.
        require(isUnderLimit(token, amount), "Daily limit has been reached");
        dailyLimits[token].spentToday += amount;
        if (token == address(0)) {
            require(manager.execTransactionFromModule(to, amount, "", Enum.Operation.Call), "Could not execute ether transfer");
        } else {
            bytes memory data = abi.encodeWithSignature("transfer(address,uint256)", to, amount);
            require(manager.execTransactionFromModule(token, 0, data, Enum.Operation.Call), "Could not execute token transfer");
        }
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
        if (dailyLimit.spentToday + amount <= dailyLimit.dailyLimit && 
            dailyLimit.spentToday + amount > dailyLimit.spentToday)
            return true;
        return false;
    }

    /// @dev Returns last midnight as Unix timestamp.
    /// @return Unix timestamp.
    function today()
        public
        view
        returns (uint)
    {
        return now - (now % 1 days);
    }
}
