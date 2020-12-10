// SPDX-License-Identifier: LGPL-3.0-or-later
pragma solidity >=0.6.0 <0.8.0;

contract Migrations {
    address public owner;
    uint public last_completed_migration;

    modifier restricted() {
        if (msg.sender == owner) _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setCompleted(uint completed)
        public
        restricted
    {
        last_completed_migration = completed;
    }

    function upgrade(address new_address)
        public
        restricted
    {
        Migrations upgraded = Migrations(new_address);
        upgraded.setCompleted(last_completed_migration);
    }
}
