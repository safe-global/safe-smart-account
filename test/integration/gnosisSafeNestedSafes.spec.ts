import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { parseEther } from "@ethersproject/units";
import { defaultAbiCoder } from "@ethersproject/abi";
import { getSafeWithOwners, getCompatFallbackHandler } from "../utils/setup";
import { buildSignatureBytes, signHash, executeContractCallWithSigners, buildContractSignature, SafeSignature} from "../../src/utils/execution";


describe("NestedSafes", async () => {
    const [user1, user2, user3, user4, user5] = waffle.provider.getWallets();
    
    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const signLib = await (await hre.ethers.getContractFactory("SignMessageLib")).deploy();
        const handler = await getCompatFallbackHandler()
        const safe1 = await getSafeWithOwners([user1.address, user2.address], 2, handler.address)
        const safe2 = await getSafeWithOwners([user3.address, user4.address], 2, handler.address)
        const parentSafe = await getSafeWithOwners([safe1.address, safe2.address], 2, handler.address)
        const handlerSafe1 = handler.attach(safe1.address)
        const handlerSafe2 = handler.attach(safe2.address)
        return {
            safe1,
            safe2,
            parentSafe, 
            handlerSafe1,
            handlerSafe2,
            signLib
        }
    })

    it('should use EIP-1271 (contract signatures)', async () => {
        const { safe1, safe2, parentSafe, handlerSafe1, handlerSafe2, staticPart} = await setupTests()
        // Deposit some spare money for execution to parent safe
        await expect(await hre.ethers.provider.getBalance(parentSafe.address)).to.be.equal(0)
        await user1.sendTransaction({to: parentSafe.address, value: parseEther("1")})
        await expect(await hre.ethers.provider.getBalance(parentSafe.address)).to.be.equal(parseEther("1"))

        // Withdraw 1 ETH
        const to = user5.address
        const value = parseEther("1")
        const data = "0x"
        const operation = 0
        const nonce = await parentSafe.nonce()
        const messageData = await parentSafe.encodeTransactionData(to, value, data, operation, 0, 0, 0, AddressZero, AddressZero, nonce)
        
        // Get hash transaction for each safe
        const messageHashSafe1 = await handlerSafe1.getMessageHashForSafe(safe1.address, messageData)
        const messageHashSafe2 = await handlerSafe2.getMessageHashForSafe(safe2.address, messageData)
        
        // Get all signs for each owner Safe1 (user1, user2) Safe2 (user3, user4)
        const sig1 = await signHash(user1, messageHashSafe1)
        const sig2 = await signHash(user2, messageHashSafe1)
        const sig3 = await signHash(user3, messageHashSafe2)
        const sig4 = await signHash(user4, messageHashSafe2)

        const ownersSignSafe1 =  buildSignatureBytes([sig1, sig2])
        const ownersSignSafe2 =  buildSignatureBytes([sig3, sig4])
        
        // Check if signature for each safe is correct
        expect(await handlerSafe1.callStatic['isValidSignature(bytes,bytes)'](messageData, ownersSignSafe1)).to.be.eq("0x20c13b0b")
        expect(await handlerSafe2.callStatic['isValidSignature(bytes,bytes)'](messageData, ownersSignSafe2)).to.be.eq("0x20c13b0b")

        const signerSafe1 = buildContractSignature(safe1.address, ownersSignSafe1)
        const signerSafe2 = buildContractSignature(safe2.address, ownersSignSafe2)
        const signature = buildSignatureBytes([signerSafe1, signerSafe2])
        // Should execute transaction withdraw 1 ether
        expect(await parentSafe.execTransaction(to, value, data, operation, 0, 0, 0, AddressZero, AddressZero, signature)).to.be.ok
        
        // Should be 0 
        await expect(await hre.ethers.provider.getBalance(parentSafe.address)).to.be.deep.eq(parseEther("0"))
    })

    it('should revert with hash not approved ', async () => {
        const { safe1, safe2, parentSafe, handlerSafe1, signLib} = await setupTests()
        // Deposit some spare money for execution to parent safe
        await expect(await hre.ethers.provider.getBalance(parentSafe.address)).to.be.equal(0)
        await user1.sendTransaction({to: parentSafe.address, value: parseEther("1")})
        await expect(await hre.ethers.provider.getBalance(parentSafe.address)).to.be.equal(parseEther("1"))

        // Withdraw 1 ETH
        const to = user5.address
        const value = parseEther("1")
        const data = "0x"
        const operation = 0
        const nonce = await parentSafe.nonce()
        const messageData = await parentSafe.encodeTransactionData(to, value, data, operation, 0, 0, 0, AddressZero, AddressZero, nonce)
        
        // Get hash transaction for each safe
        const messageHashSafe1 = await handlerSafe1.getMessageHashForSafe(safe1.address, messageData)

        // Get all signs for each owner Safe1 (user1, user2) Safe2 (user3, user4)
        const sig1 = await signHash(user1, messageHashSafe1)
        const sig2 = await signHash(user2, messageHashSafe1)
        const ownersSignSafe1 =  buildSignatureBytes([sig1, sig2])
         
        // Check if signature for each safe is correct
        expect(await handlerSafe1.callStatic['isValidSignature(bytes,bytes)'](messageData, ownersSignSafe1)).to.be.eq("0x20c13b0b")

        const signerSafe1 = buildContractSignature(safe1.address, ownersSignSafe1)
        //Create an empty signature to with dynamic true to include this address in the staticpart
        const emptySignSafe2: SafeSignature = {
            signer: safe2.address,
            data: "",
            dynamic: true,
        };
        const signature = buildSignatureBytes([signerSafe1, emptySignSafe2])
        // Should revert with message hash not approved
        await expect(parentSafe.execTransaction(to, value, data, operation, 0, 0, 0, AddressZero, AddressZero, signature),
        "Transaction should fail because hash is not approved").to.be.revertedWith("Hash not approved");
        
        // Approve transaction from safe2
        await executeContractCallWithSigners(safe2, signLib, "signMessage", [messageData], [user3, user4], true)
        
        // Execute Transaction
        await parentSafe.execTransaction(to, value, data, operation, 0, 0, 0, AddressZero, AddressZero, signature)

        // Should be 0 
        await expect(await hre.ethers.provider.getBalance(parentSafe.address)).to.be.deep.eq(parseEther("0"))
    })

});