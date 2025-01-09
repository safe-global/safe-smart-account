// This spec is a separate file because we summarize checkSignatures here

methods {
    function checkSignatures(address, bytes32, bytes memory) internal => NONDET;

    function getNativeTokenBalanceFor(address) external returns (uint256) envfree;
    function getSafeGuard() external returns (address) envfree;
}

persistent ghost uint256 gasPriceEnv {
    init_state axiom gasPriceEnv == 1;
}

// We need to make sure that the gas price is not zero. There's no env variable available in the CVL, so we use an opcode hook with a
// ghost variable.
hook GASPRICE uint v {
    require v > 0;
    gasPriceEnv = v;
}

rule nativeTokenRefundIsSentToRefundReceiver(
    address to,
    uint256 value,
    bytes data,
    Enum.Operation operation,
    uint64 safeTxGas,
    uint64 baseGas,
    uint256 gasPrice,
    address gasToken,
    address refundReceiver,
    bytes signatures
) {
    env e;

    // gas token address must be zero for native token refund
    require gasToken == 0;
    // gas refund parameters must be set
    require baseGas > 0 && gasPrice > 0;

    // the refund receiver must not be zero, because in such a case tx.origin will be used and it'll come up with countexamples related to overflow
    // and adding pre-requirements is tricky
    // also, it shouldn't be the safe itself 
    require refundReceiver != 0 && refundReceiver != currentContract;
    // // We're being optimistic about the delegatecall and in the munged contracts the actual call was removed
    // // So it's possible the gas used to be 0 in the munged contracts, so no refund would be sent (a counterexample)
    // require operation == Enum.Operation.Call;

    // The guard has to be zero, because otherwise it makes an extcall and the prover HAVOCs;
    require getSafeGuard() == 0;

    uint256 balanceBefore = getNativeTokenBalanceFor(refundReceiver);
    require balanceBefore == 0;

    execTransaction(e, to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, signatures);

    uint256 balanceAfter = getNativeTokenBalanceFor(refundReceiver);

    // It's not possible to calculate the exact amount because it varies on many factors (such as gas used, actual gas price used, etc)
    assert to_mathint(balanceAfter) > to_mathint(balanceBefore);
}
