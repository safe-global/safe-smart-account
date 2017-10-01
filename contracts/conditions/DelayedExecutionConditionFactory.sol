pragma solidity 0.4.17;
import "./DelayedExecutionCondition.sol";


contract DelayedExecutionConditionFactory {

    event DelayedExecutionConditionCreation(GnosisSafe indexed gnosisSafe, DelayedExecutionCondition delayedExecutionCondition);

    function create(uint delay)
        public
        returns (DelayedExecutionCondition delayedExecutionCondition)
    {
        delayedExecutionCondition = new DelayedExecutionCondition(GnosisSafe(msg.sender), delay);
        DelayedExecutionConditionCreation(GnosisSafe(msg.sender), delayedExecutionCondition);
    }
}
