// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "./Safe.sol";

abstract contract ERC20 {
    function transfer(address to, uint tokens) virtual public returns (bool success);
}

contract OutSafe is Safe {
    // Mapping to keep track of hot wallets/verifier limits
    mapping(address => mapping(address => uint256)) public limits;
    // Mapping to keep track of wallet nonces
    mapping(address => uint256) public nonces;
    // // Mapping to keep track of asset type
    // // 1 - ERC20, allow for future expansion
    // mapping(address => uint8) public assetTypes;

    bool public ownerWithdrawal = false;

    // keccak256(
    //   "OutWithdrawal(address to,address asset,uint256 amount,uint256 nonce,uint256 expiry)"
    // );
    bytes32 private constant OUT_WITHDRAWAL_TYPEHASH = 0xb2830d38de4ffb8d95f281c56095abd1f5b13c05f2ecd8ab1a572c4304fdace9;

    function encodeWithdrawal(
        address to,
        address asset,
        uint256 amount,
        uint256 nonce,
        uint256 expiry
    ) public view returns (bytes memory) {
        bytes32 withdrawHash = keccak256(
            abi.encode(
                OUT_WITHDRAWAL_TYPEHASH,
                to,
                asset,
                amount,
                nonce,
                expiry
            )
        );
        return abi.encodePacked(bytes1(0x19), bytes1(0x01), domainSeparator(), withdrawHash);
    }

    function setVerifier(address verifier, address[] calldata assets, uint256[] calldata _limits) public authorized {
      for (uint256 i = 0; i < assets.length; i++) {
        limits[verifier][assets[i]] = _limits[i];
      }
    }

    function setOwnerWithdrawal(bool val) public authorized {
      ownerWithdrawal = val;
    }

    function getLimit(address verifier, address asset) public view returns (uint256) {
      return limits[verifier][asset];
    }

    function getNonce(address user) public view returns (uint256) {
      return nonces[user];
    }

    // Asset type: 0 - ETH, 1 - ERC20
    function withdrawTo(address user, address asset, uint256 assetType, uint256 amount, uint256 nonce, uint256 expiry, bytes calldata signature) public {
      if (!ownerWithdrawal || !isOwner(msg.sender)) {
        uint8 v;
        bytes32 r;
        bytes32 s;
        (v, r, s) = signatureSplit(signature, 0);
        address verifier = ecrecover(keccak256(encodeWithdrawal(user, asset, amount, nonce, expiry)), v, r, s);
        require(nonces[user] < nonce, "OS01");
        require(expiry > block.number, "OS02");
        require(limits[verifier][asset] > 0, "OS03");
        require(limits[verifier][asset] >= amount, "OS04");
        require(asset == address(0) || assetType == 1, "OS05");
        nonces[user] = nonce;
        limits[verifier][asset] -= amount;
      }
      if (asset == address(0)) {
        payable(user).transfer(amount);
      } else if (assetType == 1) {
        bool success = ERC20(asset).transfer(user, amount);
        require(success, "OS07");
      } else {
        revert("OS06");
      }
    }

    function withdraw(address asset, uint256 assetType, uint256 amount, uint256 nonce, uint256 expiry, bytes calldata signature) public {
      withdrawTo(msg.sender, asset, assetType, amount, nonce, expiry, signature);
    }

    function deposit() external payable {
    }
}