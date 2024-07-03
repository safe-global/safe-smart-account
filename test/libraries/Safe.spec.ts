import { expect } from "chai";
import hre from "hardhat";
import { EXPECTED_SAFE_STORAGE_LAYOUT, getContractStorageLayout } from "../utils/storage";

describe("SafeStorage", () => {
    it("follows the expected storage layout", async () => {
        const safeStorageLayout = await getContractStorageLayout(hre, "SafeStorage");

        expect(safeStorageLayout).to.deep.eq(EXPECTED_SAFE_STORAGE_LAYOUT);
    });
});
