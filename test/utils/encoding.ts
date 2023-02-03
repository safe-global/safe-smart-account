import hre from "hardhat";

export const Erc20 = [
    "function transfer(address _receiver, uint256 _value) public returns (bool success)",
    "function approve(address _spender, uint256 _value) public returns (bool success)",
    "function allowance(address _owner, address _spender) public view returns (uint256 remaining)",
    "function balanceOf(address _owner) public view returns (uint256 balance)",
    "event Approval(address indexed _owner, address indexed _spender, uint256 _value)",
];

export const Erc20Interface = new hre.ethers.utils.Interface(Erc20);

export const encodeTransfer = (target: string, amount: string | number): string => {
    return Erc20Interface.encodeFunctionData("transfer", [target, amount]);
};

export const chainId = async () => {
    return (await hre.ethers.provider.getNetwork()).chainId;
};
