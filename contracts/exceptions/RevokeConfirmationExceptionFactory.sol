pragma solidity 0.4.17;
import "./RevokeConfirmationException.sol";


contract RevokeConfirmationExceptionFactory {

    event RevokeConfirmationExceptionCreation(GnosisSafe gnosisSafe, RevokeConfirmationException revokeConfirmationException);

    function addException(Exception exception)
        public
    {
        revert();
    }

    function create()
        public
        returns (RevokeConfirmationException revokeConfirmationException)
    {
        revokeConfirmationException = new RevokeConfirmationException();
        RevokeConfirmationExceptionCreation(GnosisSafe(this), revokeConfirmationException);
        this.addException(revokeConfirmationException);
    }
}
