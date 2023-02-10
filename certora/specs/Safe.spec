methods {
    // 
    getThreshold() returns (uint256) envfree
    disableModule(address,address)
    nonce() returns (uint256) envfree

    // harnessed
    getModule(address) returns (address) envfree
}

definition noHavoc(method f) returns bool =
    f.selector != execTransactionFromModuleReturnData(address,uint256,bytes,uint8).selector
    && f.selector != execTransactionFromModule(address,uint256,bytes,uint8).selector 
    && f.selector != execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes).selector;

definition reachableOnly(method f) returns bool =
    f.selector != setup(address[],uint256,address,bytes,address,address,uint256,address).selector
    && f.selector != simulateAndRevert(address,bytes).selector;

/// Nonce must never decrease
rule nonceMonotonicity(method f) filtered {
    f -> noHavoc(f)
} {
    uint256 nonceBefore = nonce();

    calldataarg args; env e;
    f(e, args);

    uint256 nonceAfter = nonce();

    assert nonceAfter == nonceBefore || nonceAfter == nonceBefore + 1;
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