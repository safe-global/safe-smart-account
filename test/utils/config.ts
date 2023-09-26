export const safeContractUnderTest = (): "Safe" | "SafeL2" => {
    switch (process.env.SAFE_CONTRACT_UNDER_TEST) {
        case "SafeL2":
            return "SafeL2";
        default:
            return "Safe";
    }
};
