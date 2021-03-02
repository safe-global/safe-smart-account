pragma solidity >=0.5.0 <0.6.0;
import "../handler/HandlerContext.sol";
contract TestHandler is HandlerContext {
	function dudududu() external returns (address sender, address manager) {
		return (_msgSender(), _manager());
	}
}
