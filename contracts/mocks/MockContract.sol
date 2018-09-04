pragma solidity ^0.4.23;

contract MockContract {
	enum MockType { Return, Revert, OutOfGas }
	mapping(bytes => MockType) mockTypes;
	mapping(bytes => bytes) expectations;

	/**
	 * @dev Stores a response that the contract will return if the fallback function is called with the given method name and matching arguments.
	 * @param call ABI encoded calldata that if invoked on this contract will return `response`. Parameter values need to match exactly.
	 * @param response ABI encoded response that will be returned if this contract is invoked with `call`
	 */
	function givenReturn(bytes call, bytes response) public {
		mockTypes[call] = MockType.Return;
		expectations[call] = response;
	}

	function givenRevert(bytes call) public {
		mockTypes[call] = MockType.Revert;
	}

	function givenOutOfGas(bytes call) public {
		mockTypes[call] = MockType.OutOfGas;
	}

	function() payable public {
		if (mockTypes[msg.data] == MockType.Revert) {
			revert();
		}
		if (mockTypes[msg.data] == MockType.OutOfGas) {
			while(true) {
				assembly {
					sstore(sload(0x40), 1)
				}
			}
		}
		bytes memory result = expectations[msg.data];
		uint resultSize = result.length;
		assembly {
			return(add(0x20, result), resultSize)
		}
	}
}
