pragma solidity 0.4.19;
import "./GnosisSafe.sol";


contract GnosisSafeFactory {

    event GnosisSafeCreation(GnosisSafe gnosisSafe);

    function createGnosisSafe(address[] owners, uint8 threshold, address extensionFactory, bytes extensionData)
        public
        returns (GnosisSafe gnosisSafe)
    {
        // Create extension
        if (extensionFactory != 0) {
            Extension extension;
            bool success;
            uint256 extensionDataLength = extensionData.length;
            assembly {
                let o := mload(0x40)
                success := call(
                    sub(gas, 34710),
                    extensionFactory,
                    0,
                    add(extensionData, 32),
                    extensionDataLength,
                    mload(0x40),
                    32
                )
                extension := and(mload(o), 0xffffffffffffffffffffffffffffffffffffffff)
            }
            require(success);
        }
        // Create Gnosis Safe
        gnosisSafe = new GnosisSafe(owners, threshold, extension);
        GnosisSafeCreation(gnosisSafe);
        // Update extension owner
        extension.changeGnosisSafe(gnosisSafe);
    }
}
