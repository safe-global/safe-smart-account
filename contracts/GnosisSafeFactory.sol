pragma solidity 0.4.19;
import "./GnosisSafe.sol";


contract GnosisSafeFactory {

    event GnosisSafeCreation(GnosisSafe gnosisSafe);

    function createGnosisSafe(address[] owners, uint8 threshold, address extensionFactory, bytes extensionData)
        public
        returns (GnosisSafe gnosisSafe)
    {
        // Create extension
        Extension extension;
        if (extensionFactory != 0) {
            bool success;
            uint256 extensionDataLength = extensionData.length;
            assembly {
                let output := mload(0x40)
                success := call(
                    sub(gas, 34710),
                    extensionFactory,
                    0,
                    add(extensionData, 32),
                    extensionDataLength,
                    output,
                    32
                )
                extension := and(mload(output), 0xffffffffffffffffffffffffffffffffffffffff)
            }
            require(success);
        }
        // Create Gnosis Safe
        gnosisSafe = new GnosisSafe(owners, threshold, extension);
        GnosisSafeCreation(gnosisSafe);
        // Update extension owner
        if (address(extension) > 0)
            extension.changeGnosisSafe(gnosisSafe);
    }
}
