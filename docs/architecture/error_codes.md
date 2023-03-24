## Error codes

### General init related
- `GS000`: `Could not finish initialization`
- `GS001`: `Threshold needs to be defined`
- `GS002`: `A call to set up modules couldn't be executed because the destination account was not a contract`

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
- `GS027`: `Data Hash and hash of the pre-image data do not match`

### General auth related
- `GS030`: `Only owners can approve a hash`
- `GS031`: `Method can only be called from this contract`

### Module management related
- `GS100`: `Modules have already been initialized`
- `GS101`: `Invalid module address provided`
- `GS102`: `Module has already been added`
- `GS103`: `Invalid prevModule, module pair provided`
- `GS104`: `Method can only be called from an enabled module`
- `GS105`: `Invalid starting point for fetching paginated modules`
- `GS106`: `Invalid page size for fetching paginated modules`

### Owner management related
- `GS200`: `Owners have already been set up`
- `GS201`: `Threshold cannot exceed owner count`
- `GS202`: `Threshold needs to be greater than 0`
- `GS203`: `Invalid owner address provided`
- `GS204`: `Address is already an owner`
- `GS205`: `Invalid prevOwner, owner pair provided`

### Guard management related
- `GS300`: `Guard does not implement IERC165`

### Fallback handler related
- `GS400`: `Fallback handler cannot be set to self`