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
        require(signatures.length >= 65 * (pos + 1));
        return signatureSplit(signatures, pos);
    }

    function getCurrentOwner(bytes32 dataHash, uint8 v, bytes32 r, bytes32 s) public pure returns (address currentOwner) {
        if (v == 0 || v == 1) {
            currentOwner = address(uint160(uint256(r)));
        } else if (v > 30) {
            currentOwner = ecrecover(keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", dataHash)), v - 4, r, s);
        } else {
            currentOwner = ecrecover(dataHash, v, r, s);
        }
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
