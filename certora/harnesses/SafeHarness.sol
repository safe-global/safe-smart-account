// SPDX-License-Identifier: LGPL-3.0-only
import "../munged/Safe.sol";

contract SafeHarness is Safe {
    constructor(
        address[] memory _owners,
        uint256 _threshold,
        address to,
        bytes memory data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) {
        this.setup(_owners, _threshold, to, data, fallbackHandler, paymentToken, payment, paymentReceiver);
    }

    // harnessed getters
    function getModule(address module) public view returns (address) {
        return modules[module];
    }

    function getOwner(address owner) public view returns (address) {
        return owners[owner];
    }

    // harnessed getters
    function getOwnersCount() public view returns (uint256) {
        return ownerCount;
    }

    // harnessed getters
    function getOwnersCountFromArray() public view returns (uint256) {
        return getOwners().length;
    }
}
