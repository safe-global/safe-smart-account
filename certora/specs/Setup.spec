/* A specification for the Safe setup function */


// ---- Methods block ----------------------------------------------------------
methods {
    function getThreshold() external returns (uint256) envfree;

    function SecuredTokenTransfer.transferToken(address token, address receiver, uint256 amount) internal returns (bool) => NONDET ;
}

// ---- Functions and ghosts ---------------------------------------------------


// ---- Invariants -------------------------------------------------------------


// ---- Rules ------------------------------------------------------------------

/// @dev setup can only be called if threshold = 0 and setup sets threshold > 0 
rule setupThresholdZeroAndSetsPositiveThreshold(
        address[] _owners,
        uint256 _threshold,
        address to,
        bytes data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address paymentReceiver) {
    env e;

    uint256 old_threshold = getThreshold();

    // a successful call to setup
    setup(e,_owners,_threshold,to,data,fallbackHandler,
        paymentToken,payment,paymentReceiver);

    uint256 new_threshold = getThreshold();

    assert (
        new_threshold >  0 &&
        old_threshold == 0
    );
}
