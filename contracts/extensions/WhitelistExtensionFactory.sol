pragma solidity 0.4.19;
import "./WhitelistExtension.sol";
import "../Proxy.sol";


contract WhitelistExtensionFactory {

    event WhitelistExtensionCreation(WhitelistExtension whitelistExtension);

    WhitelistExtension masterCopy;

    function WhitelistExtensionFactory()
        public
    {
        masterCopy = new WhitelistExtension(GnosisSafe(this), new address[](0));
    }

    function createWhitelistExtension(GnosisSafe gnosisSafe, address[] accounts)
        public
        returns (WhitelistExtension whitelistExtension)
    {
        whitelistExtension = WhitelistExtension(new Proxy(masterCopy));
        whitelistExtension.setup(gnosisSafe, accounts);
        WhitelistExtensionCreation(whitelistExtension);
    }
}
