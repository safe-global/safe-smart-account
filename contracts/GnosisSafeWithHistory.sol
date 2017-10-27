pragma solidity 0.4.17;
import "./GnosisSafe.sol";


/// @title Gnosis Safe with History - Extend the Gnosis Safe with the option to add a history entry hash to every transaction.
/// @author Stefan George - <stefan@gnosis.pm>
contract GnosisSafeWithHistory is GnosisSafe {

    event HistoryAddition(address indexed owner, bytes32 historyEntryHash);
    event ConfigChange(bytes32 configHash);

    string public constant NAME = "Gnosis Safe with History";
    string public constant VERSION = "0.0.1";
    
    bytes32[] public historyEntryHashes;
    bytes32 public configHash;

    function GnosisSafeWithHistory(address[] _owners, uint8 _required, bytes32 _configHash)
        public
        GnosisSafe(_owners, _required)
    {
        require(_configHash != 0);
        configHash = _configHash;
        ConfigChange(_configHash);
    }

    function confirmTransaction(bytes32 transactionHash, bytes32 historyEntryHash)
        public
    {
        addHistoryEntry(historyEntryHash);
        super.confirmTransaction(transactionHash);
    }

    function confirmAndExecuteTransaction(address to, uint value, bytes data, GnosisSafe.Operation operation, uint nonce, bytes32 historyEntryHash)
        public
    {
        addHistoryEntry(historyEntryHash);
        super.confirmAndExecuteTransaction(to, value, data, operation, nonce);
    }

    function confirmTransactionWithSignatures(bytes32 transactionHash,  uint8[] v, bytes32[] r, bytes32[] s, bytes32 historyEntryHash)
        public
        onlyOwner
    {
        addHistoryEntry(historyEntryHash);
        super.confirmTransactionWithSignatures(transactionHash, v, r, s);
    }

    function confirmAndExecuteTransactionWithSignatures(address to, uint value, bytes data, GnosisSafe.Operation operation, uint nonce, uint8[] v, bytes32[] r, bytes32[] s, bytes32 historyEntryHash)
        public
        onlyOwner
    {
        addHistoryEntry(historyEntryHash);
        super.confirmAndExecuteTransactionWithSignatures(to, value, data, operation, nonce, v, r, s);
    }

    function changeConfig(bytes32 _configHash)
        public
        onlyOwner
    {
        require(_configHash != 0);
        configHash = _configHash;
        ConfigChange(_configHash);
    }

    function addHistoryEntry(bytes32 historyEntryHash)
        internal
    {
        if (historyEntryHash != 0) {
            historyEntryHashes.push(historyEntryHash);
            HistoryAddition(msg.sender, historyEntryHash);
        }
    }

    function getHistory(uint from, uint to)
        public
        view
        returns (bytes32[] _historyEntryHashes)
    {
        _historyEntryHashes = new bytes32[](to - from);
        for (uint i = from; i < to; i++)
            _historyEntryHashes[i - from] = historyEntryHashes[i];
    }

    function getHistoryEntryCount()
        public
        view
        returns (uint)
    {
        return historyEntryHashes.length;
    }
}
