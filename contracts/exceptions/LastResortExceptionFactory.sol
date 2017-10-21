pragma solidity 0.4.17;
import "./LastResortException.sol";


contract LastResortExceptionFactory {

    event LastResortExceptionCreation(GnosisSafe gnosisSafe, LastResortException lastResortException);

    function addException(Exception exception)
        public
    {
        revert();
    }

    function create(uint requiredDeposit, uint challengePeriod)
        public
        returns (LastResortException lastResortException)
    {
        lastResortException = new LastResortException(requiredDeposit, challengePeriod);
        LastResortExceptionCreation(GnosisSafe(this), lastResortException);
        this.addException(lastResortException);
    }
}
