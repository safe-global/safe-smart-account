import "@nomiclabs/hardhat-ethers";
import { setupBenchmarkContracts } from "./utils/setup"

const contractSetup = setupBenchmarkContracts(undefined, true)
describe("GnosisSafe", async () => {
    it("creation", async () => {
        await contractSetup()
    })
})