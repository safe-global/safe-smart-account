certoraRun  certora/harnesses/SafeHarness.sol \
    --verify SafeHarness:certora/specs/Safe.spec \
    --solc solc7.6 \
    --optimistic_loop \
    --settings -optimisticFallback=true \
    --loop_iter 3 \
    --optimistic_hashing \
    --rule_sanity \
    --send_only \
    --msg "Safe $1 "