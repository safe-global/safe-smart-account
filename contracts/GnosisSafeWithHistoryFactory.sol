pragma solidity 0.4.17;
import "./GnosisSafeWithHistory.sol";


contract GnosisSafeWithHistoryFactory {

    event GnosisSafeWithHistoryCreation(address creator, GnosisSafeWithHistory gnosisSafeWithHistory);

    function create(address[] owners, uint8 required, bytes32 configHash)
        public
        returns (GnosisSafeWithHistory gnosisSafeWithHistory)
    {
        gnosisSafeWithHistory = new GnosisSafeWithHistory(owners, required, configHash);
        GnosisSafeWithHistoryCreation(msg.sender, gnosisSafeWithHistory);
    }
}
