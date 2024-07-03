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
 * Checks if two hexadecimal strings are the same, ignoring case by default.
 * @param a - The first hexadecimal string.
 * @param b - The second hexadecimal string.
 * @param ignoreCase - Optional. If true, the comparison is case-insensitive. Default is true.
 * @returns True if the hexadecimal strings are the same, false otherwise.
 */
const sameHexString = (a: string, b: string, ignoreCase = true): boolean => {
    const normalized = (s: string) => s.toLowerCase().replace(/^0x/, "");
    return sameString(normalized(a), normalized(b), ignoreCase);
};

export { sameString, sameHexString };
