/* A specification for the Safe setup function */


// ---- Methods block ----------------------------------------------------------
methods {
    function getThreshold() external returns (uint256) envfree;

    function SecuredTokenTransfer.transferToken(address token, address receiver, uint256 amount) internal returns (bool) => NONDET ;
}

// ---- Functions and ghosts ---------------------------------------------------


// ---- Invariants -------------------------------------------------------------


// ---- Rules ------------------------------------------------------------------

/// @dev approvedHashes[user][hash] can only be changed by msg.sender==user
rule approvedHashesUpdate(method f,bytes32 userHash,address user) filtered {
    f -> f.selector != sig:simulateAndRevert(address,bytes).selector
} {
    env e;

    uint256 hashBefore = approvedHashVal(e,user,userHash);

    calldataarg args;
    f(e,args);

    uint256 hashAfter = approvedHashVal(e,user,userHash);

    assert (hashBefore != hashAfter =>
        (e.msg.sender == user)
    );
}


/// @dev approvedHashes is set when calling approveHash
rule approvedHashesSet(bytes32 hashToApprove) {
    env e;
    approveHash(e,hashToApprove);
    assert(approvedHashVal(e,e.msg.sender,hashToApprove) == 1);
}