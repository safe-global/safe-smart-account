// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {HandlerContext} from "../handler/HandlerContext.sol";

/**
 * @title TestHandler - A test FallbackHandler contract
 */
contract TestHandler is HandlerContext {
    /**
     * @notice Returns the sender and manager address provided by the HandlerContext
     * @return sender The sender address
     * @return manager The manager address
     */
    function dudududu() external view returns (address sender, address manager) {
        return (_msgSender(), _manager());
    }
}
