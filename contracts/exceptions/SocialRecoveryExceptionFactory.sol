pragma solidity 0.4.17;
import "./SocialRecoveryException.sol";


contract SocialRecoveryExceptionFactory {

    event SocialRecoveryExceptionCreation(GnosisSafe gnosisSafe, SocialRecoveryException socialRecoveryException);

    function addException(Exception exception)
        public
    {
        revert();
    }

    function create(address[] _friends, uint8 _required)
        public
        returns (SocialRecoveryException socialRecoveryException)
    {
        socialRecoveryException = new SocialRecoveryException(_friends, _required);
        SocialRecoveryExceptionCreation(GnosisSafe(this), socialRecoveryException);
        this.addException(socialRecoveryException);
    }
}
