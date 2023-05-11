import { exec } from 'child_process';
import { getZksolcPath } from "@matterlabs/hardhat-zksync-solc"
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from 'hardhat/builtin-tasks/task-names';

export async function zkCompile(hre: HardhatRuntimeEnvironment, source: any): Promise<any> {
    const compilerPath = hre.config.zksolc.settings.compilerPath || (await getZksolcPath(hre.config.zksolc.version));

    const solcBuild = await hre.run(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, {
        quiet: false,
        solcVersion: hre.config.solidity.compilers[0].version,
    })

    const input = JSON.stringify({
        'language': 'Solidity',
        'settings': {
            'optimizer': {
                'runs': 200,
                'enabled': false,
            },
            'outputSelection': {
            '*': {
                '*': [ 'abi' ]
            }
            }
        },
        'sources': {
            'tmp.sol': {
                'content': source
            }
        }
    });

    console.log(`${compilerPath} --standard-json --solc ${solcBuild.compilerPath} `, input);
    
    const output: string = await new Promise((resolve, reject) => {
        const process = exec(
            `${compilerPath} --standard-json --solc ${solcBuild.compilerPath}`,
            {
                maxBuffer: 1024 * 1024 * 500,
            },
            (err, stdout, _stderr) => {
                if (err !== null) {
                    return reject(err);
                }
                resolve(stdout);
            }
        );

        process.stdin!.write(input);
        process.stdin!.end();
    });

    return JSON.parse(output);
}
