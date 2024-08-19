import solc from "solc";

export interface Solc {
    compile(input: string): string;
}

const solcCache: Record<string, Solc> = {};

export const loadSolc = async (version: string): Promise<Solc> => {
    return await new Promise((resolve, reject) => {
        if (solcCache[version] !== undefined) resolve(solcCache[version]);
        else
            solc.loadRemoteVersion(`v${version}`, (error: Error, soljson: Solc) => {
                solcCache[version] = soljson;
                return error ? reject(error) : resolve(soljson);
            });
    });
};
