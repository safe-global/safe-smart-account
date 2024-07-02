/**
 * Compares two strings and returns whether they are the same.
 * @param a - The first string to compare.
 * @param b - The second string to compare.
 * @param ignoreCase - Optional. Specifies whether the comparison should be case-insensitive. Default is true.
 * @returns True if the strings are the same, false otherwise.
 */
const sameString = (a: string, b: string, ignoreCase = true): boolean => {
    return ignoreCase ? a.toLowerCase() === b.toLowerCase() : a === b;
};

/**
 * Aligns a hexadecimal string to a specified number of bytes by adding leading zeros if necessary.
 *
 * @param hex - The hexadecimal string to align.
 * @param bytes - The desired number of bytes.
 * @returns The aligned hexadecimal string.
 * @throws Error if the aligned string exceeds the specified number of bytes.
 */
const alignHexString = (hex: string, bytes: number): string => {
    // Adjust the length to account for "0x" prefix before dividing by 2
    const adjustedLength = hex.startsWith("0x") ? hex.length - 2 : hex.length;
    const hexBytes = adjustedLength / 2;
    if (hexBytes === bytes) {
        return hex;
    }
    if (hexBytes > bytes) {
        throw new Error("Hex is too long");
    }
    // Use the adjusted length for padding calculation
    return `${"00".repeat(bytes - hexBytes)}${hex.startsWith("0x") ? hex.slice(2) : hex}`;
};

export { sameString, alignHexString };
