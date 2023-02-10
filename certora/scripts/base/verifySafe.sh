solc-select use 0.8.9

certoraRun  certora/harnesses/SafeHarness.sol ComplexityCheck/DummyERC20A.sol ComplexityCheck/DummyERC20B.sol \
    --verify SafeHarness:certora/specs/Safe.spec \
    --staging master \
    --optimistic_loop \
    --settings -optimisticFallback=true \
    --loop_iter 3 \
    --optimistic_hashing \
    --rule_sanity \
    --send_only \
    --msg "Safe $1 "