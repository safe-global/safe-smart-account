pragma solidity 0.4.17;
import "./GnosisSafeWithDescriptions.sol";


contract GnosisSafeWithDescriptionsFactory {

    event GnosisSafeWithDescriptionsCreation(address indexed creator, GnosisSafeWithDescriptions gnosisSafe);

    function create(address[] owners, uint8 required)
        public
        returns (GnosisSafeWithDescriptions gnosisSafe)
    {
        gnosisSafe = new GnosisSafeWithDescriptions(owners, required);
        GnosisSafeWithDescriptionsCreation(msg.sender, gnosisSafe);
    }
}
