/* A specification for the exstensible fallback handler */


// ---- Methods block ----------------------------------------------------------
methods {

    // envfree
    function numSigsSufficient(bytes signatures,uint256 requiredSignatures) external returns (bool) envfree;

    function _.checkTransaction(
        address to,
        uint256 value,
        bytes data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        bytes signatures,
        address msgSender
    ) external => DISPATCHER(true) ;

    function _.checkAfterExecution(bytes32 hash, bool success) external 
        => DISPATCHER(true);

    function Executor.execute(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        uint256 txGas
    ) internal returns (bool) => execute_summary();

    function SecuredTokenTransfer.transferToken(address token, address receiver, uint256 amount) internal returns (bool) => NONDET ;
    function Safe.handlePayment(
        uint256 gasUsed,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver
    ) internal returns (uint256) => NONDET ;

}

// ---- Functions and ghosts ---------------------------------------------------

persistent ghost bool execute_called { init_state axiom execute_called == false; }

function execute_summary() returns bool {
    execute_called = true ;    
    bool new_var ;
    return new_var ;
}

// ---- Invariants -------------------------------------------------------------


// ---- Rules ------------------------------------------------------------------

/// @dev a successful call to execTransactionFromModule must be from enabled module
rule execTxnModulePermissions(
        address to,
        uint256 value,
        bytes data,
        Enum.Operation operation) {
    env e;
    bool module_enabled = isModuleEnabled(e,e.msg.sender) ;

    // execTxn from module passes
    execTransactionFromModule(e,to,value,data,operation);
    
    // msg sender is the module
    assert (module_enabled);
}

/// @dev a successful call to execTransactionFromModuleReturnData must be from enabled module
rule execTxnModuleReturnDataPermissions(
        address to,
        uint256 value,
        bytes data,
        Enum.Operation operation) {
    env e;
    bool module_enabled = isModuleEnabled(e,e.msg.sender) ;

    // execTxn from module passes
    execTransactionFromModuleReturnData(e,to,value,data,operation);
    
    // msg sender is the module
    assert (module_enabled);
}


/// @dev execute can only be called by execTransaction or execTransactionFromModule 
rule executePermissions(method f) filtered {
    f -> f.selector != sig:simulateAndRevert(address,bytes).selector &&
         f.selector != sig:getStorageAt(uint256,uint256).selector
} {
    env e;
    require !execute_called;

    calldataarg args;
    f(e, args);

    assert (execute_called => 
        f.selector == sig:execTransaction(
                            address,
                            uint256,
                            bytes,
                            Enum.Operation,
                            uint256,
                            uint256,
                            uint256,
                            address,
                            address,
                            bytes).selector ||
        f.selector == sig:execTransactionFromModule(
                            address,
                            uint256,
                            bytes,
                            Enum.Operation).selector) ||
        f.selector == sig:execTransactionFromModuleReturnData(
                            address,
                            uint256,
                            bytes,
                            Enum.Operation).selector || 
        f.selector == sig:setup(
                            address[],
                            uint256,
                            address,
                            bytes,
                            address,
                            address,
                            uint256,
                            address).selector;
}


/// @dev at least "threshold" signatures provided
rule executeThresholdMet(
        address to,
        uint256 value,
        bytes data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        bytes signatures
) {
    env e;
    uint256 threshold = getThreshold(e);

    // a call to execTxn succeeds
    execTransaction(e,to,value,data,operation,safeTxGas,baseGas,
        gasPrice,gasToken,refundReceiver,signatures);
    
    // an added function to the harness SafeHarness.sol that checks signature numbers
    assert (numSigsSufficient(signatures,threshold));
}