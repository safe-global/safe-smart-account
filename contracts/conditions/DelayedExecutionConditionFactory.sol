pragma solidity 0.4.17;
import "./DelayedExecutionCondition.sol";


contract DelayedExecutionConditionFactory {

    event DelayedExecutionConditionCreation(GnosisSafe gnosisSafe, DelayedExecutionCondition delayedExecutionCondition);

    function changeCondition(Condition _condition)
        public
    {
        revert();
    }

    function create(uint delay)
        public
        returns (DelayedExecutionCondition delayedExecutionCondition)
    {
        delayedExecutionCondition = new DelayedExecutionCondition(GnosisSafe(this), delay);
        DelayedExecutionConditionCreation(GnosisSafe(this), delayedExecutionCondition);
        this.changeCondition(delayedExecutionCondition);
    }
}
