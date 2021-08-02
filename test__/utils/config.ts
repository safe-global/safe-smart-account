export const safeContractUnderTest = () => {
    return !process.env.SAFE_CONTRACT_UNDER_TEST ? "GnosisSafe" : process.env.SAFE_CONTRACT_UNDER_TEST
}