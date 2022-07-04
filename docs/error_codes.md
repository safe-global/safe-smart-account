## Error codes

### General init related
- **GS000: Could not finish initialization**

- **GS001: Threshold needs to be defined**   
Threshold is `equals to zero`, some error could happen during the Safe creation.

### General gas/ execution related
- **GS010: Not enough gas to execute Safe transaction**  
SafeTxHash is too high or gas limit is too low to execute the transaction, remeber that `3000 gwei` are needed to events.  
Review this values and increase or reduce it according the current gas price and your requirements.  

- **GS011: Could not pay gas costs with ether**   
The transaction that you are trying to execute cannot be paid with `ether`.   
Configure the correct token on gasToken parameter.  

- **GS012: Could not pay gas costs with token**  
The transaction that you are trying to execute cannot be paid with the `token` configured on gasToken.   
Configure the correct token on gasToken parameter or set it to 0 if you want use `ether`.  

- **GS013: Safe transaction failed when gasPrice and safeTxGas were 0**  
This happen because the safe try to use all provided gas (gasLimit) but was insufficient.   
Increase the gasLimit value and retry.   

### General signature validation related
- **GS020: Signatures data too short**  
There are less signatures that the owners threeshold.  
Provide as many as signatures as the owners threshold.  

- **GS021: Invalid contract signature location:** inside static part  
`s` value is pointing inside the static part, instead to dynamic part (should point to the corresponding data signature).   
Review the value of `s` to point to the beggining of the correct signature.  
More information about signatures:  https://docs.gnosis-safe.io/contracts/signatures  

- **GS022: Invalid contract signature location:** length not present  
`s` value is greater than the last position of signatures (is pointing to empty value).   
Review the `s` value to point to correct data signature or add missing data signature.   
 
- **GS023: Invalid contract signature location:** data not complete  

- **GS024: Invalid contract signature provided**  
The EIP1271 signature provided is wrong.  
If you don't want to use this type of signature review the `v` value (0 is equals to contract signature).   
The `hash` to generate the `signature` must be calculated by the account address provided in `r` value.   

- **GS025: Hash has not been approved**  
The address provided on 'r' has not the hash in the list of approved.     
If you want to pre-approve the `tx-hash` take a look that you are calculating correctly the `hash` with the correct owner and calling the method with the correct owner.   

- **GS026: Invalid owner provided**   
The owner provided doesn't exist for the `Safe`   
Review that the owners provided on `r` exist and the owners are correctly sorted.  

### General auth related
- **GS030`: Only owners can approve a hash**  
The sender is not an owner.   
Review that are using the correct sender.   
- **GS031: Method can only be called from this contract**  
Wrong contract is trying to execute a non authorized method.  

### Module management related
- **GS100: Modules have already been initialized**  
`setupModules` can be called once.   

- **GS101: Invalid module address provided**  
The module address provided cannot be `Zero` or `SENTINEL`.    

- **GS102: Module has already been added**   
The module that are trying to add was added before.   

- **GS103: Invalid prevModule, module pair provided**  
`prevModule` is not linked with `module` in the dynamic list.   
Review that you are providing the correct values.  

- **GS104: Method can only be called from an enabled module** 


### Owner management related
- **GS200: Owners have already been setup** 
`setupOwners` can be called once.  
If you want to add, swap or remove and owner use the correspond method:  
    - `adOwnerWithThreshold` 
    - `swapOwner`  
    - `removeOwner`    
   
- **GS201: Threshold cannot exceed owner count**   
Sender is trying to configure a threshold greater than the total of owners or trying to remove an owner when the threshold is equals to the total of owners.   

- **GS202: Threshold needs to be greater than 0**  
Sender is calling `changeThreshold` with 0.   

- **GS203: Invalid owner address provided**  
The owner address provided cannot be `Zero`, `SENTINEL` or the current `safe` address.  

- **GS204: Address is already an owner**  
Sender is trying to add an owner that was added before.   
Review that are setting the correct owner address.  

- **GS205: Invalid prevOwner, owner pair provided**  
`prevOwner` is not linked with `owner` in the dynamic list.   
Review that you are providing the correct values. 

### Guard management related
- `GS300`: `Guard does not implement IERC165`
