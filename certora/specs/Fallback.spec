/* A specification for the exstensible fallback handler */

using ExtensibleFallbackHandlerHarness as fallbackHandler;
using SafeHarness as safe;

// ---- Methods block ----------------------------------------------------------
methods {

    function getFallbackHandler() external returns (address) envfree;
    function _.handle(address _safe, address sender, uint256 value, bytes data) external => DISPATCHER(true);

}

// ---- Functions and ghosts ---------------------------------------------------



// ---- Invariants -------------------------------------------------------------



// ---- Rules ------------------------------------------------------------------

/// @dev fallback handler gets set by setFallbackHandler
rule setFallbackIntegrity(address handler) {
    env e;

    setFallbackHandler(e,handler);
    address this_handler = getFallbackHandler();

    assert (this_handler == handler);
}

/// @dev invariant: the address in fallback handler slot is never self
invariant fallbackHandlerNeverSelf() 
    getFallbackHandler() != safe
    filtered { 
        f -> f.selector != sig:simulateAndRevert(address,bytes).selector 
    }

/// @dev for soundness of fallbackHandlerNeverSelf, we prove a rule that simulateAndRevert always reverts
rule simulateAndRevertReverts(address caddr, bytes b) {
    env e;
    simulateAndRevert@withrevert(e,caddr,b);
    assert lastReverted;
}

/// @dev setSafeMethod sets the handler
rule setSafeMethodSets(bytes4 selector, address newMethodCaddr) {
    env e;

    bytes32 newMethod = to_bytes32(assert_uint256(newMethodCaddr));

    fallbackHandler.setSafeMethod(e,selector,newMethod);
    bytes32 thisMethod = fallbackHandler.getSafeMethod(e,e.msg.sender,selector);

    assert (thisMethod == newMethod);
}

/// @dev setSafeMethod removes the handler
rule setSafeMethodRemoves(bytes4 selector) {
    env e; 

    bytes32 newMethod = to_bytes32(0); // call setSafeMethod with the zero address

    fallbackHandler.setSafeMethod(e,selector,newMethod);
    bytes32 thisMethod = fallbackHandler.getSafeMethod(e,e.msg.sender,selector);

    assert (thisMethod == to_bytes32(0)); // there is nothing stored
}

/// @dev setSafeMethod changes the handler
rule setSafeMethodChanges(bytes4 selector, address newMethodCaddr) {
    env e; 

    bytes32 newMethod = to_bytes32(assert_uint256(newMethodCaddr));
    bytes32 oldMethod = fallbackHandler.getSafeMethod(e,e.msg.sender,selector);
    require (newMethod != oldMethod); // we are changing the method address

    fallbackHandler.setSafeMethod(e,selector,newMethod);    
    bytes32 thisMethod = fallbackHandler.getSafeMethod(e,e.msg.sender,selector);

    assert (thisMethod == newMethod);
}