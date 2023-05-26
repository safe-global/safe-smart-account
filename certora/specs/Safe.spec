methods {
    // 
    function getThreshold() external returns (uint256) envfree;
    function disableModule(address,address) external;
    function nonce() external returns (uint256) envfree;

    // harnessed
    function getModule(address) external returns (address) envfree;
    function getNativeTokenBalance() external returns (uint256) envfree;

    // optional
    function execTransactionFromModuleReturnData(address,uint256,bytes,SafeHarness.Operation) external returns (bool, bytes memory);
    function execTransactionFromModule(address,uint256,bytes,SafeHarness.Operation) external returns (bool);
    function execTransaction(address,uint256,bytes,SafeHarness.Operation,uint256,uint256,uint256,address,address,bytes) external returns (bool);
}

definition noHavoc(method f) returns bool =
    f.selector != sig:execTransactionFromModuleReturnData(address,uint256,bytes,SafeHarness.Operation).selector
    && f.selector != sig:execTransactionFromModule(address,uint256,bytes,SafeHarness.Operation).selector 
    && f.selector != sig:execTransaction(address,uint256,bytes,SafeHarness.Operation,uint256,uint256,uint256,address,address,bytes).selector;

definition reachableOnly(method f) returns bool =
    f.selector != sig:setup(address[],uint256,address,bytes,address,address,uint256,address).selector
    && f.selector != sig:simulateAndRevert(address,bytes).selector;

definition MAX_UINT256() returns uint256 = 0xffffffffffffffffffffffffffffffff;

/// Nonce must never decrease
rule nonceMonotonicity(method f) filtered {
    f -> reachableOnly(f)
} {
    uint256 nonceBefore = nonce();

    // The nonce may overflow, but since it's increased only by 1 with each transaction, it is not realistically possible to overflow it.
    require nonceBefore < MAX_UINT256();

    calldataarg args; env e;
    f(e, args);

    uint256 nonceAfter = nonce();

    // assert nonceAfter == nonceBefore || to_mathint(nonceAfter) == nonceBefore + 1;
    assert nonceAfter != nonceBefore => 
        to_mathint(nonceAfter) == nonceBefore + 1 && f.selector == sig:execTransaction(address,uint256,bytes,SafeHarness.Operation,uint256,uint256,uint256,address,address,bytes).selector;
}


/// The sentinel must never point to the zero address.
/// @notice It should either point to itself or some nonzero value
invariant liveSentinel()
    getModule(1) != 0
    filtered { f -> noHavoc(f) && reachableOnly(f) }
    { preserved {
        requireInvariant noDeadEnds(getModule(1), 1);
    }}

/// Threshold must always be nonzero.
invariant nonzeroThreshold()
    getThreshold() > 0
    filtered { f -> noHavoc(f) && reachableOnly(f) }

/// Two different modules must not point to the same module/
invariant uniquePrevs(address prev1, address prev2)
    prev1 != prev2 && getModule(prev1) != 0 => getModule(prev1) != getModule(prev2)
    filtered { f -> noHavoc(f) && reachableOnly(f) }
    { 
        preserved {
            requireInvariant noDeadEnds(getModule(prev1), prev1);
            requireInvariant noDeadEnds(getModule(prev2), prev2);
            requireInvariant uniquePrevs(prev1, 1);
            requireInvariant uniquePrevs(prev2, 1);
            requireInvariant uniquePrevs(prev1, getModule(prev2));
            requireInvariant uniquePrevs(prev2, getModule(prev1));
        }
    }

/// A module that points to the zero address must not have another module pointing to it.
invariant noDeadEnds(address dead, address lost)
    dead != 0 && getModule(dead) == 0 => getModule(lost) != dead
    filtered { f -> noHavoc(f) && reachableOnly(f) }
    {
        preserved {
            requireInvariant liveSentinel();
            requireInvariant noDeadEnds(getModule(1), 1);
        }
        preserved disableModule(address prevModule, address module) with (env e) {
            requireInvariant uniquePrevs(prevModule, lost);
            requireInvariant uniquePrevs(prevModule, dead);
            requireInvariant noDeadEnds(dead, module);
            requireInvariant noDeadEnds(module, dead);
        }
    }

rule nativeTokenBalanceSpending(method f) filtered {
    f -> reachableOnly(f)
} {
    uint256 balanceBefore = getNativeTokenBalance();

    calldataarg args; env e;
    f(e, args);

    uint256 balanceAfter = getNativeTokenBalance();

    assert balanceAfter < balanceBefore => 
        f.selector == sig:execTransaction(address,uint256,bytes,SafeHarness.Operation,uint256,uint256,uint256,address,address,bytes).selector
        || f.selector == sig:execTransactionFromModule(address,uint256,bytes,SafeHarness.Operation).selector
        || f.selector == sig:execTransactionFromModuleReturnData(address,uint256,bytes,SafeHarness.Operation).selector;
}

rule nativeTokenBalanceSpendingExecTransaction(
        address to,
        uint256 value,
        bytes data,
        SafeHarness.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas, 
        uint256 gasPrice, 
        address gasToken, 
        address refundReceiver, 
        bytes signatures
    ) {
    uint256 balanceBefore = getNativeTokenBalance();

    env e;
    execTransaction(e, to, value, data , operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, signatures);

    uint256 balanceAfter = getNativeTokenBalance();

    assert balanceAfter < balanceBefore => 
        to_mathint(balanceBefore) - to_mathint(value) == to_mathint(balanceAfter);
}