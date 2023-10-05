# 👷 GroupOS Safe 🦺

A distinguishing feature of the GroupOS + 0xRails protocols that puts Station Labs at the cutting edge of the Web3 space is commitment to consistent addresses across networks. This repository makes that fact possible.

All GroupOS toolkits reside at identical addresses across chains to eliminate the need for users and clients to manage multiple account addresses across blockchains. These include:

- ERC4337 Account Abstraction
- ERC6551 Tokenbound Accounts
- Modular contract signature validation
- All core contracts

## About Safe

Safe is a renowned multisig contract repository famous for its widespread use and robust security.

To preserve the top-tier security posture of Safe, no changes are made to any core contracts. In fact, the only difference made in this codebase is the implementation of a single Guard contract designed to cater to our specific access control requirements, the `AdminGuard`.

This custom Safe guard facilitates smooth and secure onchain operations tailored to GroupOS's organizational needs. It is currently undergoing security audit.

## Contact

For inquiries, feedback, or collaboration proposals, feel free to reach out to us at [groupos.xyz](https://groupos.xyz).