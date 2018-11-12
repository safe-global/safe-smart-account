pragma solidity 0.4.24;

import "../base/Module.sol";
import "../base/ModuleManager.sol";
import "../base/OwnerManager.sol";
import "../common/Enum.sol";
import "../common/SignatureDecoder.sol";
import "../common/SecuredTokenTransfer.sol";

import "@gnosis.pm/dx-contracts/contracts/DutchExchange.sol";
import "@gnosis.pm/dx-contracts/contracts/Oracle/PriceOracleInterface.sol";


/// @title Transfer Limit Module - Allows to transfer limited amounts of ERC20 tokens and Ether.
contract TransferLimitModule is Module, SignatureDecoder, SecuredTokenTransfer {

    string public constant NAME = "Transfer Limit Module";
    string public constant VERSION = "0.0.2";

    // transferLimits mapping maps token address to transfer limit settings.
    mapping (address => TransferLimit) public transferLimits;

    // Time period for which the transfer limits apply, in seconds.
    uint256 public timePeriod;

    // Start of the time period, during which the last transfer occured (common for all tokens).
    uint256 public lastStartTime;

    // Global limit on all transfers, specified in Wei.
    uint256 public globalWeiCap;

    // Total amount of Wei spent in current time period.
    uint256 public totalWeiSpent;

    // Global limit on transfers, specified in usd (dai).
    uint256 public globalDaiCap;

    // Total amount of dai spent in current time period.
    uint256 public totalDaiSpent;

    // Number of required confirmations for a transfer.
    uint256 public threshold;

    uint256 public nonce;

    // Non-owner address who is allowed to perform transfers.
    address public delegate;

    // DutchExchange contract used as price oracle.
    DutchExchange dutchx;

    struct TransferLimit {
        uint256 transferLimit;
        uint256 spent;
    }

    /// @dev Setup function sets initial storage of contract.
    /// @param tokens List of token addresses. Ether is represented with address 0x0.
    /// @param _transferLimits List of transfer limits in smalles units (e.g. Wei for Ether).
    /// @param _timePeriod Time period for which the transfer limits apply, in seconds, between [1 hour, 1 year).
    /// @param _globalWeiCap Global limit on transfers, specified in Wei.
    /// @param _globalDaiCap Global limit on transfers, specified in dai.
    /// @param _threshold Number of required confirmations, within the range [1, safeThreshold - 1].
    /// @param _delegate A non-owner address who is allowed to perform transfers within limits (optional).
    /// @param _dutchxAddr Address of DutchX contract, which is used as price oracle.
    function setup(
        address[] tokens,
        uint256[] _transferLimits,
        uint256 _timePeriod,
        uint256 _globalWeiCap,
        uint256 _globalDaiCap,
        uint256 _threshold,
        address _delegate,
        address _dutchxAddr
    )
        public
    {
        setManager();

        // Greater than 1 hour and less than 1 year.
        require(isValidTimePeriod(_timePeriod), "Invalid time period");
        // In the range [1, safeThreshold - 1]
        require(isValidThreshold(_threshold), "Invalid threshold");
        require(_dutchxAddr != 0, "Invalid dutchx address");

        timePeriod = _timePeriod;
        globalWeiCap = _globalWeiCap;
        globalDaiCap = _globalDaiCap;
        threshold = _threshold;
        delegate = _delegate;
        dutchx = DutchExchange(_dutchxAddr);

        for (uint256 i = 0; i < tokens.length; i++) {
            transferLimits[tokens[i]].transferLimit = _transferLimits[i];
        }
    }

    /// @dev Allows to update the transfer limit for a specified token. This can only be done via a Safe transaction.
    /// @param token Token contract address.
    /// @param transferLimit Transfer limit in smallest token unit.
    function changeTransferLimit(address token, uint256 transferLimit)
        public
        authorized
    {
        transferLimits[token].transferLimit = transferLimit;
    }

    /// @dev Updates the delegate. This can only be done via a Safe transaction.
    /// @param _delegate New delegate, who is a non-owner account also allowed to make transfers.
    function setDelegate(address _delegate)
        public
        authorized
    {
        delegate = _delegate;
    }

    /// @dev Returns if Safe transaction is a valid transfer limit transaction.
    /// @param token Address of the token that should be transfered (0 for Ether)
    /// @param to Address to which the tokens should be transfered
    /// @param amount Amount of tokens (or Wei) that should be transfered
    /// @param safeTxGas Gas that should be used for the Safe transaction.
    /// @param dataGas Gas costs for data used to trigger the safe transaction and to pay the payment transfer
    /// @param gasPrice Gas price that should be used for the payment calculation.
    /// @param gasToken Token address (or 0 if ETH) that is used for the payment.
    /// @param refundReceiver Address of receiver of gas payment (or 0 if tx.origin).
    /// @param signatures Packed signature data ({bytes32 r}{bytes32 s}{uint8 v})
    /// @return Returns if transaction can be executed.
    function executeTransferLimit(
        address token,
        address to,
        uint256 amount,
        uint256 safeTxGas,
        uint256 dataGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        bytes signatures
    )
        public
    {
        require(to != 0, "Invalid to address provided");
        require(amount > 0, "Invalid amount provided");

        uint256 startGas = gasleft();
        bytes32 txHash = getTransactionHash(
            token, to, amount,
            safeTxGas, dataGas, gasPrice, gasToken, refundReceiver,
            nonce
        );
        require(checkSignatures(txHash, signatures), "Invalid signatures provided");
        // Increase nonce and execute transaction.
        nonce++;
        require(gasleft() >= safeTxGas, "Not enough gas to execute safe transaction");

        // Validate that transfer is not exceeding transfer limit, and
        // update state to keep track of spent values.
        require(handleTransferLimits(token, amount), "Transfer exceeds limits");

        // Perform transfer by invoking manager
        if (token == 0) {
            require(manager.execTransactionFromModule(to, amount, "", Enum.Operation.Call), "Could not execute ether transfer");
        } else {
            bytes memory data = abi.encodeWithSignature("transfer(address,uint256)", to, amount);
            require(manager.execTransactionFromModule(token, 0, data, Enum.Operation.Call), "Could not execute token transfer");
        }

        // We transfer the calculated tx costs to the tx.origin to avoid sending it to intermediate contracts that have made calls
        if (gasPrice > 0) {
            handlePayment(startGas, dataGas, gasPrice, gasToken, refundReceiver);
        }
    }

    /// @dev Returns hash to be signed by owners.
    /// @param token Address of the token that should be transfered (0 for Ether)
    /// @param to Address to which the tokens should be transfered
    /// @param amount Amount of tokens (or Wei) that should be transfered
    /// @param _nonce Nonce used for this Safe transaction.
    /// @param safeTxGas Gas that should be used for the Safe transaction.
    /// @param dataGas Gas costs for data used to trigger the safe transaction and to pay the payment transfer
    /// @param gasPrice Gas price that should be used for the payment calculation.
    /// @param gasToken Token address (or 0 if ETH) that is used for the payment.
    /// @param refundReceiver Address of receiver of gas payment (or 0 if tx.origin).
    /// @param _nonce Transaction nonce.
    /// @return Transaction hash.
    function getTransactionHash(
        address token,
        address to,
        uint256 amount,
        uint256 safeTxGas,
        uint256 dataGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 _nonce
    )
        public
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encodePacked(byte(0x19), byte(0), this, token, to, amount, safeTxGas, dataGas, gasPrice, gasToken, refundReceiver, _nonce)
        );
    }

    /// @dev Returns start of the current time period.
    /// @return Unix timestamp.
    function currentStartTime()
        public
        view
        returns (uint)
    {
        return now - (now % timePeriod);
    }

    function handleTransferLimits(address token, uint256 amount)
        internal
        returns (bool)
    {
        TransferLimit storage transferLimit = transferLimits[token];
        // If time period is over, reset expenditure.
        if (currentStartTime() > lastStartTime) {
            lastStartTime = currentStartTime();
            transferLimit.spent = 0;
            totalWeiSpent = 0;
            totalDaiSpent = 0;
        }

        // Transfer + previous expenditure shouldn't exceed limit specified for token.
        if (transferLimit.spent + amount > transferLimit.transferLimit ||
            transferLimit.spent + amount <= transferLimit.spent) {
            return false;
        }

        // If global a global cap is set, transfer amount + value of all
        // previous expenditures (for all tokens) shouldn't exceed global limit.
        if (globalWeiCap != 0 || globalDaiCap != 0) {
          // Calculate value in ether.
          uint256 ethNum;
          uint256 ethDen;
          (ethNum, ethDen) = getEthAmount(token, amount);
          // TODO: How precise should the comparison be?
          // Convert ether to wei
          uint256 weiAmount = (ethNum * 10**18) / ethDen;
          if (globalWeiCap > 0 && totalWeiSpent + weiAmount > globalWeiCap) {
              return false;
          }
          totalWeiSpent += weiAmount;

          if (globalDaiCap != 0) {
            // Calculate value in dai.
            uint256 daiNum;
            uint256 daiDen;
            (daiNum, daiDen) = getDaiAmount(ethNum, ethDen);
            uint256 daiAmount = daiNum / daiDen;
            if (totalDaiSpent + daiAmount > globalDaiCap) {
                return false;
            }
            totalDaiSpent += daiAmount;
          }
        }

        transferLimits[token].spent += amount;

        return true;
    }

    function isValidTimePeriod(uint256 _timePeriod)
        internal
        returns (bool)
    {
        if  (_timePeriod >= 1 hours &&
             _timePeriod < 1 years) {
            return true;
        }

        return false;
    }

    function isValidThreshold(uint256 _threshold)
        internal
        returns (bool)
    {
        if  (_threshold >= 1 &&
             _threshold < OwnerManager(manager).getThreshold()) {
            return true;
        }

        return false;
    }

    function checkSignatures(bytes32 transactionHash, bytes signatures)
        internal
        view
        returns (bool)
    {
        // There cannot be an owner with address 0.
        address lastOwner = address(0);
        address currentOwner;
        uint256 i;

        // Validate threshold is reached.
        for (i = 0; i < threshold; i++) {
            currentOwner = recoverKey(transactionHash, signatures, i);

            // Signatures must be sorted by their address, and
            // there shouldn't be duplicates.
            if (currentOwner <= lastOwner) {
                return false;
            }

            // Signer should either be one of the owners, or the delegate
            if (!(OwnerManager(manager).isOwner(currentOwner) || currentOwner == delegate)) {
                return false;
            }

            lastOwner = currentOwner;
        }

        return true;
    }

    function getEthAmount(address token, uint256 amount)
        internal
        view
        returns (uint256, uint256)
    {
        // Amount is in wei
        if (token == 0) {
            return (amount, 10**18);
        }

        uint256 num;
        uint256 den;
        (num, den) = dutchx.getPriceOfTokenInLastAuction(token);

        return (amount * num, den);
    }

    function getDaiAmount(uint256 ethNum, uint256 den)
        internal
        view
        returns (uint256, uint256)
    {
        PriceOracleInterface priceOracle = PriceOracleInterface(dutchx.ethUSDOracle());
        uint ethDaiPrice = priceOracle.getUSDETHPrice();
        return (ethNum * 10**18, den);
    }

    function handlePayment(
        uint256 gasUsed,
        uint256 dataGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver
    )
        private
    {
        uint256 amount = ((gasUsed - gasleft()) + dataGas) * gasPrice;
        // solium-disable-next-line security/no-tx-origin
        address receiver = refundReceiver == address(0) ? tx.origin : refundReceiver;
        if (gasToken == address(0)) {
                // solium-disable-next-line security/no-send
            require(receiver.send(amount), "Could not pay gas costs with ether");
        } else {
            require(transferToken(gasToken, receiver, amount), "Could not pay gas costs with token");
        }
    }
}
