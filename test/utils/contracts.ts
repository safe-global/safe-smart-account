import { Wallet } from "ethers";
import { deployContract } from "./setup";

export const killLibSource = `
contract Test {
    function killme() public {
        selfdestruct(payable(msg.sender));
    }

    function expose() public returns (address handler) {
        bytes32 slot = 0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5;
        assembly {
            handler := sload(slot)
        }
    }

    function estimate(address to, bytes memory data) public returns (uint256) {
        uint256 startGas = gasleft();
        (bool success,) = to.call{ gas: gasleft() }(data);
        require(success, "Transaction failed");
        return startGas - gasleft();
    }

    address singleton;
    uint256 public value = 0;
    function updateAndGet() public returns (uint256) {
        value++;
        return value;
    }

    function trever() public returns (address handler) {
        revert("Why are you doing this?");
    }
}`;
export const killLibContract = async (deployer: Wallet) => {
    return await deployContract(deployer, killLibSource);
};
