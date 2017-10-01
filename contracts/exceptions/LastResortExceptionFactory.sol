pragma solidity 0.4.17;
import "./LastResortException.sol";


contract LastResortExceptionFactory {

    event LastResortExceptionCreation(GnosisSafe indexed gnosisSafe, LastResortException lastResortException);

    function create(uint requiredDeposit, uint challengePeriod)
        public
        returns (LastResortException lastResortException)
    {
        lastResortException = new LastResortException(GnosisSafe(msg.sender), requiredDeposit, challengePeriod);
        LastResortExceptionCreation(GnosisSafe(msg.sender), lastResortException);
    }
}
