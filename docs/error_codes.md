## Error codes

### General init related
- `GS000`: `Could not finish initialization`
- `GS001`: `Threshold needs to be defined`

### General gas/ execution related
- `GS010`: `Not enough gas to execute Safe transaction`
- `GS011`: `Could not pay gas costs with ether`
- `GS012`: `Could not pay gas costs with token`
- `GS013`: `Safe transaction failed when gasPrice and safeTxGas were 0`

### General signature validation related
- `GS020`: `Signatures data too short`
- `GS021`: `Invalid contract signature location: inside static part`
- `GS022`: `Invalid contract signature location: length not present`
- `GS023`: `Invalid contract signature location: data not complete`
- `GS024`: `Invalid contract signature provided`
- `GS025`: `Hash has not been approved`
- `GS026`: `Invalid owner provided`

### General auth related
- `GS030`: `Only owners can approve a hash`
- `GS031`: `Method can only be called from this contract`

### Module management related
- `GS100`: `Modules have already been initialized`
- `GS101`: `Invalid module address provided`
- `GS102`: `Module has already been added`
- `GS103`: `Invalid prevModule, module pair provided`
- `GS104`: `Method can only be called from an enabled module`

### Owner management related
- `GS200`: `Owners have already been setup`
- `GS201`: `Threshold cannot exceed owner count`
- `GS202`: `Threshold needs to be greater than 0`
- `GS203`: `Invalid owner address provided`
- `GS204`: `Address is already an owner`
- `GS205`: `Invalid prevOwner, owner pair provided`
