pragma solidity 0.4.17;
import "./LastResortException.sol";


contract LastResortExceptionFactory {

    event LastResortExceptionCreation(GnosisSafe gnosisSafe, LastResortException lastResortException);

    function addException(Exception exception)
        public
    {

    }

    function create(uint requiredDeposit, uint challengePeriod)
        public
        returns (LastResortException lastResortException)
    {
        lastResortException = new LastResortException(GnosisSafe(this), requiredDeposit, challengePeriod);
        LastResortExceptionCreation(GnosisSafe(this), lastResortException);
        this.addException(lastResortException);
    }
}
