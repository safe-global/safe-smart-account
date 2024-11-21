// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {ISafe} from "../interfaces/ISafe.sol";
import {Safe} from "../Safe.sol";

/**
 * @title SafeEIP7702 - A multisignature wallet with support for confirmations using signed messages based on EIP-712.
 *                      This contract is designed to be used as a delegation designator for EIP-7702.
 * @dev Most important concepts:
 *      - Threshold: Number of required confirmations for a Safe transaction.
 *      - Owners: List of addresses that control the Safe. They are the only ones that can add/remove owners, change the threshold and
 *        approve transactions. Managed in `OwnerManager`.
 *      - Transaction Hash: Hash of a transaction is calculated using the EIP-712 typed structured data hashing scheme.
 *      - Nonce: Each transaction should have a different nonce to prevent replay attacks.
 *      - Signature: A valid signature of an owner of the Safe for a transaction hash.
 *      - Guards: Guards are contracts that can execute pre- and post- transaction checks. There are two types of guards:
 *          1. Transaction Guard: managed in `GuardManager` for transactions executed with `execTransaction`.
 *          2. Module Guard: managed in `ModuleManager` for transactions executed with `execTransactionFromModule`
 *      - Modules: Modules are contracts that can be used to extend the write functionality of a Safe. Managed in `ModuleManager`.
 *      - Fallback: Fallback handler is a contract that can provide additional read-only functional for Safe. Managed in `FallbackManager`.
 *      Note: This version of the implementation contract doesn't emit events for the sake of gas efficiency and therefore requires a tracing node for indexing/
 *      For the events-based implementation see `SafeL2.sol`.
 * @author Stefan George - @Georgi87
 * @author Richard Meissner - @rmeissner
 */
contract SafeEIP7702 is Safe {
    /**
     * @inheritdoc ISafe
     */
    function setup(
        address[] calldata /*_owners*/,
        uint256 /*_threshold*/,
        address /*to*/,
        bytes calldata /*data*/,
        address /*fallbackHandler*/,
        address /*paymentToken*/,
        uint256 /*payment*/,
        address payable /*paymentReceiver*/
    ) external pure override {
        revertWithError("GS003");
    }

    function setupEIP7702(
        address to,
        bytes calldata data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver,
        bytes calldata signature
    ) external {
        address[] memory _owners = new address[](1);
        _owners[0] = address(this);

        // setupOwners checks if the Threshold is already set, therefore preventing that this method is called twice
        setupOwners(_owners, 1);
        if (fallbackHandler != address(0)) internalSetFallbackHandler(fallbackHandler);
        // As setupOwners can only be called if the contract has not been initialized we don't need a check for setupModules
        setupModules(to, data);

        if (payment > 0) {
            // To avoid running into issues with EIP-170 we reuse the handlePayment function (to avoid adjusting code of that has been verified we do not adjust the method itself)
            // baseGas = 0, gasPrice = 1 and gas = payment => amount = (payment + 0) * 1 = payment
            handlePayment(payment, 0, 1, paymentToken, paymentReceiver);
        }
        checkSignatures(keccak256(abi.encode(to, data, fallbackHandler, paymentToken, payment, paymentReceiver)), signature);
        emit SafeSetup(msg.sender, _owners, 1, to, fallbackHandler);
    }
}
