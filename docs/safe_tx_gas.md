### Safe Transaction Gas Limit (safeTxGas)

In this document will describe the behaviour of the internal gas limit (aka `safeTxGas`) for the [1.3.0](https://github.com/safe-global/safe-contracts/releases/tag/v1.3.0-libs.0) version of the Safe Contracts.

There have been changes to this behaviour with the [1.3.0](https://github.com/safe-global/safe-contracts/blob/main/CHANGELOG.md#version-130) version of the Safe contract (see [#274](https://github.com/safe-global/safe-contracts/issues/274))

The behaviour of `safeTxGas` depends on the `gasPrice` value of the Safe transaction.

#### With gas refund

If `gasPrice` is set to a value `>0` the Safe contracts will issue a refund for the gas costs incurred the execution of the Safe transaction. An example where this can be used is the relayers. These would execute the Safe transaction after it has been signed by the owners and then would get refunded for the execution.

The logic for this can be seen in [`Safe.sol`](https://github.com/safe-global/safe-contracts/blob/main/contracts/Safe.sol#L183-L185):

```js
if (gasPrice > 0) {
  payment = handlePayment(gasUsed, baseGas, gasPrice, gasToken, refundReceiver);
}
```

In this case the Safe contract will use the gas specified by the `safeTxGas` to execute the Safe transaction as it is not possible to adjust this later on by sending more gas along. This is important to prevent that the "relayer" can increase the amount of gas used and therefore also increase the refund being issued.

The Safe contract will "catch" the error if the Safe transaction fails (e.g. because of a revert in the target contract or out of gas) and still issue a refund for the used gas.

This also results in the `nonce` of this transaction being used, so it is not possible to retry the transaction at a later point.

#### Without gas refund

If `gasPrice` is set to `0` then the Safe contracts will **not** issue a refund after the Safe transaction exection.

Therefore it is not necessary to be as strict on the gas being passed along with the execution of the Safe transaction. As no refund is triggered the Safe will not pay for the execution costs, based on this the Safe contracts will send along all available case when no refund is used.

Before the execution the Safe contracts always check if enough gas is available to satisfy the `safeTxGas`. This can be seen in [`Safe.sol`](hhttps://github.com/safe-global/safe-contracts/blob/main/contracts/Safe.sol#L168-L170):

```js
require(gasleft() >=
  ((safeTxGas * 64) / 63).max(safeTxGas + 2500) + 500, "GS010");
```

**Therefore the `safeTxGas` behaves like a "minimum" gas value, that needs to be available, when it is set to a value > 0**

If the Safe transaction fails (e.g. because of a revert in the target contract or out of gas) the Safe contract will "catch" the error and still increase the `nonce` so that the transaction cannot be tried again.

This essentially means if you set a `safeTxGas` that is too low, your transaction might fail with out of gas and it is not possible to retry the same transaction, therefore it is important to set a correct `safeTxGas` value.

Most wallets will estimate Ethereum transaction by checking with what gas limit the transaction does not revert. As the Safe contracts will "catch" the internal revert, most wallets will estimate the gas limit to the minimum value required to satisfy the `safeTxGas`. This makes it very important to correctly estimate the `safeTxGas` value.

To make it easier to set the `safeTxGas` value a change has been made with the 1.3.0 version of the Safe contracts:

**When `safeTxGas` is set to `0`, the Safe contract will revert if the internal Safe transaction fails** (see [#274](https://github.com/safe-global/safe-contracts/issues/274))

That means if `safeTxGas` is set to `0` the Safe contract sends along all the available gas when performing the internal Safe transaction. If that transaction fails the Safe will revert and therefore also undo all State changes. This can be seen in [`Safe.sol`](https://github.com/safe-global/safe-contracts/blob/main/contracts/Safe.sol#L178-L180):

```js
require(success || safeTxGas != 0 || gasPrice != 0, "GS013");
```

As this also means that the `nonce` for this transaction is **not** used, **it is possible to retry the transaction in the future**.

This logic also improves how the default Ethereum gas estimation works for Safe transaction executions. As the Safe contract reverts if the internal Safe transactions fails (e.g. because of a revert in the target contract or out of gas) the Wallet will propose a gas limit high enough to ensure that internal Safe transaction is successful or the wallet will display an error that the gas limit for the transaction could not be estimated.

It is potentially dangerous to have a signed, but unexecuted, Safe transaction sitting around. To cancel such a transaction it is necessary to execute another Safe transaction with the same `nonce` (e.g. a Safe transaction to the Safe itself with `value = 0`, `data = '0x'` and `operation = 0`).

#### Migration from <1.3.0

To get the same behaviour of previous Safe contract versions with `safeTxGas` set to `0` it is possible to set the `safeTxGas` to `1`.
