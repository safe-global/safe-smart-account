/* A specification for the exstensible fallback handler */

using ExtensibleFallbackHandlerHarness as fallbackHandler;
using DummyHandler as dummyHandler;
using SafeHarness as safe;

// ---- Methods block ----------------------------------------------------------
methods {

    function getFallbackHandler() external returns (address) envfree;
    function _.handle(address _safe, address sender, uint256 value, bytes data) external => DISPATCHER(true);

    unresolved external in safe._ => DISPATCH(use_fallback=true) [
        fallbackHandler._
    ] default NONDET;
    
    unresolved external in callDummyHandler(bytes4) => DISPATCH(use_fallback=true) [
        safe._
    ] default NONDET;

}

// ---- Functions and ghosts ---------------------------------------------------



// ---- Invariants -------------------------------------------------------------



// ---- Rules ------------------------------------------------------------------

/// @dev a handler, once set via setSafeMethod, is possible to call
rule handlerCallableIfSet(method f, bytes4 selector) filtered { f -> f.isFallback } {
    env e;

    // the fallback handler is in the scene
    require (getFallbackHandler() == fallbackHandler);

    // the dummy (sub) handler is a valid handler for this safe
    bytes32 dummy_bytes = to_bytes32(assert_uint256(dummyHandler));
    fallbackHandler.setSafeMethod(e,selector,dummy_bytes); // we've set the dummy as a handler

    // reset the check to see if dummy handler has been called
    dummyHandler.resetMethodCalled(e);

    // call the fallback method of the Safe contract
    calldataarg args ;
    f(e,args);

    // there is an execution path that calls the connected dummy handler
    satisfy (dummyHandler.methodCalled(e));
}

/// @dev a handler is called under expected conditions
rule handlerCalledIfSet() {
    env e;

    // the fallback handler is in the scene
    require (getFallbackHandler() == fallbackHandler);

    // the dummy (sub) handler is a valid handler for this safe
    bytes32 dummy = to_bytes32(assert_uint256(dummyHandler));
    bytes4 selector = to_bytes4(sig:dummyHandler.dummyMethod().selector);
    callSetSafeMethod(e,selector,dummy); // we've set the dummy as a handler

    // reset the check to see if dummy handler has been called
    dummyHandler.resetMethodCalled(e);

    callDummyHandler(e,selector);

    // there is an execution path that calls the connected dummy handler
    assert (dummyHandler.methodCalled(e));
}