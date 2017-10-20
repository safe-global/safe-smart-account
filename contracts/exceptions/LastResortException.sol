pragma solidity 0.4.17;
import "../Exception.sol";
import "../GnosisSafe.sol";


/// @title Last Resort Exception - Allows to execute a transaction without confirmations in case a deposit was paid and a challenge period passed.
/// @author Stefan George - <stefan@gnosis.pm>
contract LastResortException is Exception {

    event TransactionSubmission(address sender, bytes32 submittedTransactionHash);
    event TransactionCancellation(address sender, bytes32 submittedTransactionHash);

    GnosisSafe public gnosisSafe;
    uint public requiredDeposit;
    uint public challengePeriod;
    address public requestor;
    bytes32 public submittedTransactionHash;
    uint public submissionTimestamp;

    modifier onlyGnosisSafe() {
        require(msg.sender == address(gnosisSafe));
        _;
    }

    function LastResortException(uint _requiredDeposit, uint _challengePeriod)
        public
    {
        require(   _requiredDeposit > 0
                && _challengePeriod > 0);
        gnosisSafe = GnosisSafe(msg.sender);
        requiredDeposit = requiredDeposit;
        challengePeriod = _challengePeriod;
    }

    function submitTransaction(bytes32 _submittedTransactionHash)
        public
        payable
    {
        require(   msg.value >= requiredDeposit
                && submittedTransactionHash == 0);
        submittedTransactionHash = _submittedTransactionHash;
        submissionTimestamp = now;
        requestor = msg.sender;
        TransactionSubmission(msg.sender, _submittedTransactionHash);
    }

    function cancelTransaction()
        public
    {
        require(   gnosisSafe.isOwner(msg.sender)
                && gnosisSafe.send(this.balance));
        TransactionCancellation(msg.sender, submittedTransactionHash);
        submittedTransactionHash = bytes32(0);
        submissionTimestamp = 0;
    }

    function executeException(address to, uint value, bytes data)
        public
    {
        gnosisSafe.executeException(to, value, data, GnosisSafe.Operation.Call, this);
    }

    function isExecutable(address owner, address to, uint value, bytes data, GnosisSafe.Operation operation)
        public
        onlyGnosisSafe
        returns (bool)
    {
        if (   getTransactionHash(to, value, data, operation) == submittedTransactionHash
            && now - submissionTimestamp > challengePeriod)
        {
            require(requestor.send(this.balance));
            return true;
        }
        return false;
    }

    function getTransactionHash(address to, uint value, bytes data, GnosisSafe.Operation operation)
        public
        view
        returns (bytes32)
    {
        return keccak256(to, value, data, operation);
    }
}
