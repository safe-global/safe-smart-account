// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "./Safe.sol";

abstract contract ERC20 {
    function transfer(address to, uint tokens) virtual public returns (bool success);
}

contract OutSafe is Safe {
    // Mapping to keep track of hot wallets limits
    mapping(address => mapping(address => uint256)) public limits;
    // Mapping to keep track of user nonces
    mapping(address => uint256) public nonces;

    // keccak256(
    //   "OutWithdrawal(address to,address asset,uint8 assetType,uint256 amount,uint256 blockNonce,uint32 expiry)"
    // );
    bytes32 private constant OUT_WITHDRAWAL_TYPEHASH = 0x58d511d6ac1b4ac3b7e60f8a9929daf3fbcd0ca72a6d986bdf03e2b69333af10;

    function encodeWithdrawal(
        address to,
        address asset,
        uint8 assetType,
        uint256 amount,
        uint256 blockNonce,
        uint32 expiry
    ) public view returns (bytes memory) {
        bytes32 withdrawHash = keccak256(
            abi.encode(
                OUT_WITHDRAWAL_TYPEHASH,
                to,
                asset,
                assetType,
                amount,
                blockNonce,
                expiry
            )
        );
        return abi.encodePacked(bytes1(0x19), bytes1(0x01), domainSeparator(), withdrawHash);
    }

    function setHotWallet(address _hotWallet, address[] calldata assets, uint256[] calldata _limits) public authorized {
      for (uint256 i = 0; i < assets.length; i++) {
        if (_limits[i] == 0) {
          delete limits[_hotWallet][assets[i]];
        } else {
          limits[_hotWallet][assets[i]] = _limits[i];
        }
      }
    }

    function getLimit(address _hotWallet, address asset) public view returns (uint256) {
      return limits[_hotWallet][asset];
    }

    // Asset type: 0 - ETH, 1 - ERC20
    function withdrawTo(address user, address asset, uint8 assetType, uint256 amount, uint256 blockNonce, uint32 expiry, address verifier, bytes memory signature) public {
      require(nonces[user] < blockNonce, "OS01");
      require(blockNonce + expiry > block.number, "OS02");
      require(block.number >= blockNonce, "OS03");
      require(limits[verifier][asset] >= amount, "OS04");
      bytes memory wData = encodeWithdrawal(user, asset, assetType, amount, blockNonce, expiry);
      bytes32 wHash = keccak256(wData);
      require(verifier == checkNSignatures(wHash, wData, signature, 1, false), "OS05");
      nonces[user] = blockNonce;
      limits[verifier][asset] -= amount;
      if (assetType == 0) {
        payable(user).transfer(amount);
      } else if (assetType == 1) {
        bool success = ERC20(asset).transfer(user, amount);
        require(success, "OS07");
      } else {
        revert("OS06");
      }
    }

    function withdraw(address asset, uint8 assetType, uint256 amount, uint256 blockNonce, uint32 expiry, address verifier, bytes memory signature) public {
      withdrawTo(msg.sender, asset, assetType, amount, blockNonce, expiry, verifier, signature);
    }

    function deposit() external payable {
    }
}