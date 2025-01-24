/* A specification of the safe guard and module guard */

using ModuleGuardMock as modGuardMock;
using ModuleGuardMockDuplicate as modGuardMock2;
using TxnGuardMock as txnGuardMock;
using TxnGuardMockDuplicate as txnGuardMock2;
using SafeHarness as safe;

// ---- Methods block ----------------------------------------------------------
methods {
    function getModuleGuardExternal() external returns (address) envfree;
    function getSafeGuard() external returns (address) envfree;
    
    function txnGuardMock.preCheckedTransactions() external returns (bool) envfree;
    function txnGuardMock.postCheckedTransactions() external returns (bool) envfree;
    function modGuardMock.preCheckedTransactions() external returns (bool) envfree;
    function modGuardMock.postCheckedTransactions() external returns (bool) envfree;

    function _.checkModuleTransaction(
        address to,
        uint256 value,
        bytes data,
        Enum.Operation operation,
        address module
    ) external => DISPATCHER(true) ;

    function _.checkAfterModuleExecution(bytes32 txHash, bool success) external
        => DISPATCHER(true) ;

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
    ) internal returns (bool) => NONDET;

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


// ---- Invariants -------------------------------------------------------------


// ---- Rules ------------------------------------------------------------------

/// @dev the only method that can change the guard is setGuard
rule guardAddressChange(method f) filtered {
    f -> f.selector != sig:simulateAndRevert(address,bytes).selector &&
         f.selector != sig:getStorageAt(uint256,uint256).selector
} {
    address guardBefore = getSafeGuard();

    calldataarg args; env e;
    f(e, args);

    address guardAfter = getSafeGuard();

    assert guardBefore != guardAfter =>
        f.selector == sig:setGuard(address).selector;
}

/// @dev the only method that can change the module guard is setModuleGuard
rule moduleGuardAddressChange(method f) filtered {
    f -> f.selector != sig:simulateAndRevert(address,bytes).selector &&
         f.selector != sig:getStorageAt(uint256,uint256).selector
} {
    address guardBefore = getModuleGuardExternal();
    
    calldataarg args; env e;
    f(e,args);
    
    address guardAfter = getModuleGuardExternal();

    assert guardBefore != guardAfter => 
        f.selector == sig:setModuleGuard(address).selector;
}

/// @dev set-get correspondence for (regular) guard
rule setGetCorrespondenceGuard(address guard) {
    env e;
    setGuard(e,guard);
    address gotGuard = getSafeGuard();
    assert guard == gotGuard;
}

/// @dev set-get correspodnence for module guard
rule setGetCorrespondenceModuleGuard(address guard) {
    env e;
    setModuleGuard(e,guard);
    address gotGuard = getModuleGuardExternal();
    assert guard == gotGuard;
}

/// @dev setGuard can only be called by contract itself.
rule setGuardReentrant(address guard) {
    env e;
    setGuard(e,guard); // a successful call to setGuard
    assert (e.msg.sender == safe);
}

/// @dev setModuleGuard can only be called by contract itself.
rule setModuleGuardReentrant(address guard) {
    env e;
    setModuleGuard(e,guard);
    assert(e.msg.sender == safe);
}


/// @dev the transaction guard gets called both pre- and post- any execTransaction
rule txnGuardCalled(
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
    // the txn guard is the mock
    require (getSafeGuard() == txnGuardMock);

    txnGuardMock.resetChecks(e); // reset the check triggers
    txnGuardMock2.resetChecks(e);

    execTransaction(e,to,value,data,operation,safeTxGas,baseGas,
        gasPrice,gasToken,refundReceiver,signatures);
    
    // the pre- and post- module transaction guards were called
    assert (
        txnGuardMock.preCheckedTransactions() && 
        txnGuardMock.postCheckedTransactions() &&
        // the right guard was called
        !txnGuardMock2.preCheckedTransactions(e) && 
        !txnGuardMock2.postCheckedTransactions(e)
    );
}

/// @dev the module guard gets called both pre- and post- any execTransactionFromModule
rule moduleGuardCalled(
        address to,
        uint256 value,
        bytes data,
        Enum.Operation operation) {
    env e;
    // the module guard is the mock
    require (getModuleGuardExternal() == modGuardMock);
    
    modGuardMock.resetChecks(e); // reset the check triggers
    modGuardMock2.resetChecks(e);
    
    execTransactionFromModule(e,to,value,data,operation);

    // the pre- and post- module transaction guards were called
    assert (
        modGuardMock.preCheckedTransactions() && 
        modGuardMock.postCheckedTransactions() &&
        // the correct guard was called
        !modGuardMock2.preCheckedTransactions(e) && 
        !modGuardMock2.postCheckedTransactions(e)
    );
}

/// @dev the module guard gets called both pre- and post- any execTransactionFromModuleReturnData
rule moduleGuardCalledReturn(
        address to,
        uint256 value,
        bytes data,
        Enum.Operation operation) {
    env e;
    // the module guard is the mock
    require (getModuleGuardExternal() == modGuardMock);
    
    modGuardMock.resetChecks(e); // reset the check triggers
    modGuardMock2.resetChecks(e);

    execTransactionFromModuleReturnData(e,to,value,data,operation);

    // the pre- and post- module transaction guards were called
    assert (
        modGuardMock.preCheckedTransactions() && 
        modGuardMock.postCheckedTransactions() &&
        // the correct guard was called
        !modGuardMock2.preCheckedTransactions(e) && 
        !modGuardMock2.postCheckedTransactions(e)
    );
}

