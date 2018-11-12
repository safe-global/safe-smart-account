pragma solidity ^0.4.23;

import "../modules/TransferLimitModule.sol";

contract CurrentStartTimeMock is TransferLimitModule {
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

contract DaiAmountMock is TransferLimitModule {
    uint256 price;

    function setPrice(uint256 _price) external {
        price = _price;
    }

    function getDaiAmount(uint256 _num, uint256 _det) internal view returns (uint256, uint256) {
      return (_num * price, _det);
    }
}
