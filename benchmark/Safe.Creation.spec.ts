import { setupBenchmarkContracts } from "./utils/setup";

const contractSetup = setupBenchmarkContracts(undefined, true);
describe("Safe", () => {
    it("creation", async () => {
        await contractSetup();
    });
});
