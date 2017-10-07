pragma solidity 0.4.17;
import "./LastResortException.sol";


contract LastResortExceptionFactory {

    event LastResortExceptionCreation(GnosisSafe gnosisSafe, LastResortException lastResortException);

    uint8 required;

    function addException(Exception exception)
        public
    {

    }

    function addOwner(address owner, uint8 _required)
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
        this.addOwner(lastResortException, required);
    }
}
