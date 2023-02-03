export const safeContractUnderTest = () => {
    return !process.env.SAFE_CONTRACT_UNDER_TEST ? "Safe" : process.env.SAFE_CONTRACT_UNDER_TEST;
};
