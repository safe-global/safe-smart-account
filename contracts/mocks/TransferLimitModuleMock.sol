pragma solidity ^0.4.23;

import "../modules/TransferLimitModule.sol";

contract TransferLimitModuleMock is TransferLimitModule {
    uint256 mockedNow;

    function setMockedNow(uint256 _now) external {
        mockedNow = _now;
    }

    function currentStartTime()
        public
        view
        returns (uint)
    {
        return getNow() - (getNow() % timePeriod);
    }

    function getNow() internal view returns (uint256) {
        return mockedNow;
    }
}
