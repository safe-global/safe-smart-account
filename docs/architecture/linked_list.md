
It uses a linked list to store the modules because the EVM bytecode `solc` generates for a dynamic array is not the most efficient.

The linked list head and tail are the 0x1 address. The head and tail are never removed from the list. The head and tail are never modules.

TODO:
- [ ] Outline inefficiency of other approaches
  - Array only (hard to do duplication check)
  - Mapping only (hard to get list of modules)
  - Array + Mapping (keep both in sync)
- [ ] Explain challenges
  - hidden entries due to delegatecall (link libraries doc)
