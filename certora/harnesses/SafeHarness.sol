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

    // harnessed functions

    function signatureSplitPublic(bytes memory signatures, uint256 pos) public pure returns (uint8 v, bytes32 r, bytes32 s) {
        return signatureSplit(signatures, pos);
    }

    // harnessed getters
    function getModule(address module) public view returns (address) {
        return modules[module];
    }

    function getSafeGuard() public view returns (address) {
        return getGuard();
    }

    function getNativeTokenBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function getOwnersCount() public view returns (uint256) {
        return ownerCount;
    }

    function getOwnersCountFromArray() public view returns (uint256) {
        return getOwners().length;
    }
}
