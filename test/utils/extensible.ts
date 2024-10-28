import { ethers } from "ethers";

// Given whether the handler is static or not, and the handler address, return the encoded bytes
// The encoded handler is a bytes32, so we need to encode the handler address and the isStatic flag
// into a single bytes32.
// The first 1 byte is the isStatic flag, and the remaining 31 bytes are the handler address,
// zero left padded.
export const encodeHandler = (isStatic: boolean, handler: string): string => {
    const isStaticBytes = ethers.hexlify(isStatic ? "0x00" : "0x01");
    const handlerBytes = ethers.zeroPadValue(handler, 31);
    return ethers.hexlify(ethers.concat([isStaticBytes, handlerBytes]));
};

// Given the encoded handler, return the isStatic flag and the handler address.
// The handler address has been zero left padded, so we need to remove the padding.
export const decodeHandler = (encodedHandler: string): [boolean, string] => {
    const isStatic = ethers.dataSlice(encodedHandler, 0, 1) === "0x00";
    const handler = ethers.dataSlice(encodedHandler, 12);
    return [isStatic, handler];
};

// Given:
// - whether the handler is static or not
// - the 4byte selector of the function to call
// - the handler address
// Encode all into a single bytes32.
// The first 1 byte is the isStatic flag, the next 4 bytes are the selector, and the remaining 27 bytes are the handler address,
// zero left padded.
export const encodeHandlerFunction = (isStatic: boolean, selector: string, handler: string): string => {
    const isStaticBytes = ethers.hexlify(isStatic ? "0x00" : "0x01");
    const selectorBytes = ethers.hexlify(selector);
    const handlerBytes = ethers.zeroPadValue(handler, 27);
    return ethers.hexlify(ethers.concat([isStaticBytes, selectorBytes, handlerBytes]));
};

// Given the encoded handler function, return the isStatic flag, the selector, and the handler address.
// The handler address has been zero left padded, so we need to remove the padding.
export const decodeHandlerFunction = (encodedHandlerFunction: string): [boolean, string, string] => {
    const isStatic = ethers.dataSlice(encodedHandlerFunction, 0, 1) === "0x00";
    const selector = ethers.dataSlice(encodedHandlerFunction, 1, 5);
    const handler = ethers.dataSlice(encodedHandlerFunction, 12);
    return [isStatic, selector, handler];
};

export const encodeCustomVerifier = (
    encodeData: string,
    domainSeparator: string,
    typeHash: string,
    signature: string,
): [string, string] => {
    // calculate the hash of the message
    const dataHash = ethers.keccak256(
        ethers.solidityPacked(
            ["bytes1", "bytes1", "bytes32", "bytes32"],
            ["0x19", "0x01", domainSeparator, ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes"], [typeHash, encodeData]))],
        ),
    );

    // create the function fragment for the `safeSignature(bytes)` function
    const safeSignatureFragment = new ethers.Interface([`function safeSignature(bytes32,bytes32,bytes,bytes)`]);
    const encodedMessage = safeSignatureFragment.encodeFunctionData("safeSignature(bytes32,bytes32,bytes,bytes)", [
        domainSeparator,
        typeHash,
        encodeData,
        signature,
    ]);

    return [dataHash, encodedMessage];
};
