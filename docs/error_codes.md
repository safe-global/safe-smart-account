## Error codes

### General init related
- **GS000: Could not finish initialization**

- **GS001: Threshold needs to be defined**   
Threshold is `equal to zero`, some error could happen during the Safe setup.

### General gas/ execution related
- **GS010: Not enough gas to execute Safe transaction**  
SafeTxGas is too high or gas limit is too low to execute the transaction, keep in mind that we require some gas, at least `2500` is needed for events and at least `500` to perform code until execution.  

- **GS011: Could not pay gas costs with ether**   
There are not enough funds of `ether` to execute the transaction.   
Make sure that you have enough funds of `ether` or choose other token with enough funds setting it in `gasToken`.  

- **GS012: Could not pay gas costs with token**  
There are not enough funds of the token choosen on `gasToken` to execute the transaction.      
Make sure you have enough of the gasToken or set it to `address(0)` if you want use ether.  

- **GS013: Safe transaction failed when gasPrice and safeTxGas were 0**  
Transaction is not succesful, this could be for due to multiple reasons.

### General signature validation related
- **GS020: Signatures data too short**  
The length of required signatures is less than 65*threeshold.
Each signature has a constant length of 65 bytes `{32-bytes r}{32-bytes s}{1-byte v}`. If more data is necessary it can be appended to the end. 
More information about signatures:   
https://docs.gnosis-safe.io/contracts/signatures

- **GS021: Invalid contract signature location:** inside static part  
Wrong contract `v=0` signature because `s` value is pointing inside the static part, instead to dynamic part (should point to the corresponding data signature).   
Review the value of `s` to point to the beginning of the correct signature.  
More information about signatures:  
https://docs.gnosis-safe.io/contracts/signatures  

- **GS022: Invalid contract signature location:** length not present  
Wrong contract `v=0` signature because `s` value is greater than the last position of signatures (it's pointing to empty value).   
Review `s` value points to the correct data signature position or add the missing data signature.   
More information about contract signature:  
https://docs.gnosis-safe.io/contracts/signatures  

- **GS023: Invalid contract signature location:** data not complete  
Wrong contract `v=0` signature because `startingPosition + contractSignatureLen` is out of bounds.   

- **GS024: Invalid contract signature provided**  
The `EIP-1271` signature provided is wrong.  
If you don't want to use this type of signature review the `v` value (0 for a contract signature).   
The `hash` to generate the `signature` must be calculated by the account address provided in `r` value.  
More information about signatures:  
https://docs.gnosis-safe.io/contracts/signatures     
https://eips.ethereum.org/EIPS/eip-1271   

- **GS025: Hash has not been approved**  
The owner provided on `r` has not pre-approved the safeTxHash.     
To pre-approve the safeTxHash call `approveHash` with the safeTxHash calculated by the owner.   
This error could happen also if the nonce has changed and therefore the safeTxHash is different than expected.  

- **GS026: Invalid owner provided**   
The owner provided doesn't exist for the `Safe`   
Review that the signing owners are owners of the Safe and signatures are correctly sorted ascending by the owner (without `EIP-55` encoding).

### General auth related
- **GS030`: Only owners can approve a hash**  
The sender is not an owner.   
Review that a correct owner is being used.   

- **GS031: Method can only be called from this contract**  

### Module management related
- **GS100: Modules have already been initialized**  
`setupModules` can only be called once.   

- **GS101: Invalid module address provided**  
A module address cannot be zero address `address(0)` or sentinel address `address(1)`.    

- **GS102: Module has already been added**   

- **GS103: Invalid prevModule, module pair provided**  
`prevModule` is not the previous element to `module` in the module list.   

- **GS104: Method can only be called from an enabled module** 


### Owner management related
- **GS200: Owners have already been setup**   
`setupOwners` can only be called once.  
If you want to add, swap or remove an owner use the corresponding method:  
    - `adOwnerWithThreshold` 
    - `swapOwner`  
    - `removeOwner`    
   
- **GS201: Threshold cannot exceed owner count**   
Sender is trying to configure a threshold greater than the total of owners or trying to remove an owner when the threshold is equals to the total of owners.   

- **GS202: Threshold needs to be greater than 0**  
Sender is calling `changeThreshold` with 0.   

- **GS203: Invalid owner address provided**  
The owner address provided cannot be `address(0)`, sentinel address `address(1)` or the current `safe` address.  

- **GS204: Address is already an owner**  

- **GS205: Invalid prevOwner, owner pair provided**  
`prevOwner` is not the previous element to `owner` in the owner list.   

### Guard management related
- `GS300`: `Guard does not implement IERC165`
