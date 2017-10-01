pragma solidity 0.4.17;
import "../Exception.sol";
import "../GnosisSafe.sol";


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

    function LastResortException(GnosisSafe _gnosisSafe, uint _requiredDeposit, uint _challengePeriod)
        public
    {
        require(   address(_gnosisSafe) != 0
                && _requiredDeposit > 0
                && _challengePeriod > 0);
        gnosisSafe = _gnosisSafe;
        requiredDeposit = requiredDeposit;
        challengePeriod = _challengePeriod;
    }

    function submitTransaction(bytes32 _submittedTransactionHash)
        public
        payable
    {
        require(msg.value >= requiredDeposit);
        submittedTransactionHash = _submittedTransactionHash;
        submissionTimestamp = now;
        requestor = msg.sender;
        TransactionSubmission(msg.sender, _submittedTransactionHash);
    }

    function cancelTransaction(bytes32 _submittedTransactionHash)
        public
    {
        require(   gnosisSafe.isOwner(msg.sender)
                && msg.sender.send(this.balance));
        submittedTransactionHash = bytes32(0);
        submissionTimestamp = 0;
        TransactionCancellation(msg.sender, _submittedTransactionHash);
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
        if (   keccak256(to, value, data, operation) == submittedTransactionHash
            && now - submissionTimestamp > challengePeriod)
        {
            require(requestor.send(this.balance));
            return true;
        }
        return false;
    }
}
