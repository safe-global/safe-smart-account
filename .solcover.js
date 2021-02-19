module.exports = {
    skipFiles: [
        'test/Token.sol',
        'test/ERC1155Token.sol',
    ],
    mocha: {
        grep: "@skip-on-coverage", // Find everything with this tag
        invert: true               // Run the grep's inverse set.
    }
};