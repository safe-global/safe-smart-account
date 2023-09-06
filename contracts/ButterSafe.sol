// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "./Safe.sol";

abstract contract ERC20 {
    function transfer(address to, uint tokens) virtual external returns (bool success);

    function transferFrom(address from, address to, uint tokens) virtual external returns (bool success);
}

abstract contract ERC721 {
    function transferFrom(address _from, address _to, uint256 _tokenId) virtual external;
}

abstract contract ERC1155 {
    function safeTransferFrom(address _from, address _to, uint256 _id, uint256 _value, bytes calldata _data) virtual external;
}

// Asset Type
// 1 - ERC20
// 2 - ERC721
// 3 - ERC1155
contract ButterSafe is Safe {
    // Mapping to keep track of hot wallets/verifier limits
    mapping(address => mapping(address => uint256)) public limits;
    // Mapping to keep track of wallet nonces
    mapping(address => uint256) public nonces;

    bool public ownerWithdrawal = true;

    // keccak256(
    //   "OutWithdrawal(address to,address asset,uint256 assetType,uint256 tokenId,uint256 amount,uint256 nonce,uint256 expiry)"
    // );
    bytes32 private constant OUT_WITHDRAWAL_TYPEHASH = 0x6e981a3f933da9dbccf8fe67d5369be9d303da2242b2c97863e301ded93c6e92;

    function encodeWithdrawal(
        address to,
        address asset,
        uint256 assetType,
        uint256 tokenId,
        uint256 amount,
        uint256 nonce,
        uint256 expiry
    ) public view returns (bytes memory) {
        bytes32 withdrawHash = keccak256(
            abi.encode(
                OUT_WITHDRAWAL_TYPEHASH,
                to,
                asset,
                assetType,
                tokenId,
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

    function withdrawTo(address user, address asset, uint256 assetType, uint256 tokenId, uint256 amount, uint256 nonce, uint256 expiry, bytes calldata signature) public {
      if (!ownerWithdrawal || !isOwner(msg.sender)) {
        uint8 v;
        bytes32 r;
        bytes32 s;
        (v, r, s) = signatureSplit(signature, 0);
        address verifier = ecrecover(keccak256(encodeWithdrawal(user, asset, assetType, tokenId, amount, nonce, expiry)), v, r, s);
        require(nonces[user] < nonce, "OS01");
        require(expiry > block.number, "OS02");
        require(limits[verifier][asset] > 0, "OS03");
        require(limits[verifier][asset] >= (assetType == 2 ? 1 : amount) , "OS04");
        nonces[user] = nonce;
        limits[verifier][asset] -= amount;
      }
      if (asset == address(0)) {
        payable(user).transfer(amount);
      } else if (assetType == 1) {
        bool success = ERC20(asset).transfer(user, amount);
        require(success, "OS06");
      } else if (assetType == 2) {
        ERC721(asset).transferFrom(address(this), user, tokenId);
      } else if (assetType == 3) {
        ERC1155(asset).safeTransferFrom(address(this), user, tokenId, amount, "");
      } else {
        revert("OS05");
      }
    }

    function withdraw(address asset, uint256 assetType, uint256 tokenId, uint256 amount, uint256 nonce, uint256 expiry, bytes calldata signature) public {
      withdrawTo(msg.sender, asset, assetType, tokenId , amount, nonce, expiry, signature);
    }

    function deposit(address asset, uint256 assetType, uint256 tokenId, uint256 amount) external payable {
      if (asset == address(0)) return;
      if (assetType == 1) {
        bool success = ERC20(asset).transferFrom(msg.sender, address(this), amount);
        require(success, "OS07");
      } else if (assetType == 2) {
        ERC721(asset).transferFrom(msg.sender, address(this), tokenId);
      } else if (assetType == 3) {
        ERC1155(asset).safeTransferFrom(msg.sender, address(this), tokenId, amount, "");
      } else {
        revert("OS05");
      }
    }
}