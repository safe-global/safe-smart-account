import solc from "solc";

const solcCache: Record<string, any> = {};

export const loadSolc = async (version: string): Promise<any> => {
    return await new Promise((resolve, reject) => {
        if (solcCache[version] !== undefined) resolve(solcCache[version]);
        else
            solc.loadRemoteVersion(`v${version}`, (error: any, soljson: any) => {
                solcCache[version] = soljson;
                return error ? reject(error) : resolve(soljson);
            });
    });
};
