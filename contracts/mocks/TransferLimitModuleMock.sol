pragma solidity ^0.4.23;

import "../modules/TransferLimitModule.sol";

contract TransferLimitModuleMock is TransferLimitModule {
    uint256 mockedNow;
    uint256 price;

    function setMockedNow(uint256 _now) external {
        mockedNow = _now;
    }

    function getNow() internal view returns (uint256) {
        return mockedNow != 0 ? mockedNow : super.getNow();
    }

    function setPrice(uint256 _price) external {
        price = _price;
    }

    function getDaiAmount(uint256 _num, uint256 _det) internal view returns (uint256, uint256) {
        return price != 0 ? (_num * price, _det) : super.getDaiAmount(_num, _det);
    }
}
