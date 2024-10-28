// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {MarshalLib} from "../handler/extensible/MarshalLib.sol";

/**
 * @title TestMarshalLib - A test contract for MarshalLib
 */
contract TestMarshalLib {
    function encode(bool isStatic, address handler) external pure returns (bytes32 data) {
        return MarshalLib.encode(isStatic, handler);
    }

    function encodeWithSelector(bool isStatic, bytes4 selector, address handler) external pure returns (bytes32 data) {
        return MarshalLib.encodeWithSelector(isStatic, selector, handler);
    }

    function decode(bytes32 data) external pure returns (bool isStatic, address handler) {
        return MarshalLib.decode(data);
    }

    function decodeWithSelector(bytes32 data) external pure returns (bool isStatic, bytes4 selector, address handler) {
        return MarshalLib.decodeWithSelector(data);
    }
}
