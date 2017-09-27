pragma solidity 0.4.17;
import "./GnosisSafe.sol";


contract GnosisSafeWithDescriptions is GnosisSafe {

    event DescriptionAddition(address sender, bytes32 descriptionHash);
    
    bytes32[] descriptionHashes;

    function GnosisSafeWithDescriptions(address[] _owners, uint8 _required)
        public
        GnosisSafe(_owners, _required)
    {

    }

    function confirmTransaction(bytes32 transactionHash, bytes32 descriptionHash)
        public
    {
        addDescription(descriptionHash);
        super.confirmTransaction(transactionHash);
    }

    function confirmAndExecuteTransaction(address to, uint value, bytes data, GnosisSafe.Operation operation, uint nonce, bytes32 descriptionHash)
        public
    {
        addDescription(descriptionHash);
        super.confirmAndExecuteTransaction(to, value, data, operation, nonce);
    }

    function confirmTransactionWithSignatures(bytes32 transactionHash,  uint8[] v, bytes32[] r, bytes32[] s, bytes32 descriptionHash)
        public
    {
        addDescription(descriptionHash);
        super.confirmTransactionWithSignatures(transactionHash, v, r, s);
    }

    function confirmAndExecuteTransactionWithSignatures(address to, uint value, bytes data, GnosisSafe.Operation operation, uint nonce, uint8[] v, bytes32[] r, bytes32[] s, bytes32 descriptionHash)
        public
        onlyOwner
    {
        addDescription(descriptionHash);
        super.confirmAndExecuteTransactionWithSignatures(to, value, data, operation, nonce, v, r, s);
    }

    function executeTransaction(address to, uint value, bytes data, GnosisSafe.Operation operation, uint nonce, bytes32 descriptionHash)
        public
    {
        addDescription(descriptionHash);
        super.executeTransaction(to, value, data, operation, nonce);
    }

    function executeException(address to, uint value, bytes data, GnosisSafe.Operation operation, Exception exception, bytes32 descriptionHash)
        public
    {
        addDescription(descriptionHash);
        super.executeException(to, value, data, operation, exception);
    }

    function addDescription(bytes32 descriptionHash)
        internal
    {
        if (descriptionHash > 0) {
            descriptionHashes.push(descriptionHash);
            DescriptionAddition(msg.sender, descriptionHash);
        }
    }

    function getDescriptions(uint from, uint to)
        public
        view
        returns (bytes32[] _descriptionHashes)
    {
        _descriptionHashes = new bytes32[](to - from);
        for (uint i = from; i < to; i++)
            _descriptionHashes[i - from] = descriptionHashes[i];
    }

    function getDescriptionCount()
        public
        view
        returns (uint)
    {
        return descriptionHashes.length;
    }
}
