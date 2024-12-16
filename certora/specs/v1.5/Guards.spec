/* A specification of the safe guard and module guard */

using ModuleGuardMock as modGuardMock;
using TxnGuardMock as txnGuardMock;
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
/// @status Done: https://prover.certora.com/output/39601/a05e24787c68404d877ae4acce693734?anonymousKey=02030d2ca97a19d0d7a70deb5a91dc4b75bca89d
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
/// @status Done: https://prover.certora.com/output/39601/a05e24787c68404d877ae4acce693734?anonymousKey=02030d2ca97a19d0d7a70deb5a91dc4b75bca89d

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
/// @status Done: https://prover.certora.com/output/39601/a05e24787c68404d877ae4acce693734?anonymousKey=02030d2ca97a19d0d7a70deb5a91dc4b75bca89d
rule setGetCorrespondenceGuard(address guard) {
    env e;
    setGuard(e,guard);
    address gotGuard = getSafeGuard();
    assert guard == gotGuard;
}

/// @dev set-get correspodnence for module guard
/// @status Done: https://prover.certora.com/output/39601/a05e24787c68404d877ae4acce693734?anonymousKey=02030d2ca97a19d0d7a70deb5a91dc4b75bca89d
rule setGetCorrespondenceModuleGuard(address guard) {
    env e;
    setModuleGuard(e,guard);
    address gotGuard = getModuleGuardExternal();
    assert guard == gotGuard;
}

/// @dev setGuard can only be called by contract itself.
/// @status Done: https://prover.certora.com/output/39601/b78bb57e77e444ad9d89861a8dc66e9f?anonymousKey=b6452b2c9f788d4a4dcd8d3c41f16a3e66e64a66
rule setGuardReentrant(address guard) {
    env e;
    setGuard(e,guard); // a successful call to setGuard
    assert (e.msg.sender == safe);
}

/// @dev setModuleGuard can only be called by contract itself.
/// @status Done: https://prover.certora.com/output/39601/8147e74eda404e61bcb6fc8e8849c5f3?anonymousKey=5c1e77468b6f5bff22c376894dca846f5ea83aab
rule setModuleGuardReentrant(address guard) {
    env e;
    setModuleGuard(e,guard);
    assert(e.msg.sender == safe);
}


/// @dev the transaction guard gets called both pre- and post- any execTransaction
/// @status Done: https://prover.certora.com/output/39601/a05e24787c68404d877ae4acce693734?anonymousKey=02030d2ca97a19d0d7a70deb5a91dc4b75bca89d
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

    // execTxn passes
    execTransaction(e,to,value,data,operation,safeTxGas,baseGas,
        gasPrice,gasToken,refundReceiver,signatures);
    
    // the pre- and post- module transaction guards were called
    assert (
        txnGuardMock.preCheckedTransactions() == true && 
        txnGuardMock.postCheckedTransactions() == true
    );
}

/// @dev the module guard gets called both pre- and post- any execTransactionFromModule
/// @status Done: https://prover.certora.com/output/39601/a05e24787c68404d877ae4acce693734?anonymousKey=02030d2ca97a19d0d7a70deb5a91dc4b75bca89d
rule moduleGuardCalled(
        address to,
        uint256 value,
        bytes data,
        Enum.Operation operation) {
    env e;
    // the module guard is the mock
    require (getModuleGuardExternal() == modGuardMock);
    
    modGuardMock.resetChecks(e); // reset the check triggers
    execTransactionFromModule(e,to,value,data,operation);

    // the pre- and post- module transaction guards were called
    assert (
        modGuardMock.preCheckedTransactions() == true && 
        modGuardMock.postCheckedTransactions() == true
    );
}

