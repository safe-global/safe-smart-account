/*
Set INFURA_TOKEN in .env
Run with `yarn do rinkeby scripts/simulate_verify.js`
*/

const solc = require('solc');

function reformatMetadata(
    metadata,
    sources
  ) {
  
    const input = {};
    let fileName = '';
    let contractName = '';
  
    input.settings = metadata.settings;
  
    for (fileName in metadata.settings.compilationTarget) {
      contractName = metadata.settings.compilationTarget[fileName];
    }
    console.log(fileName)
    console.log(contractName)
  
    delete input['settings']['compilationTarget']
  
    if (contractName == '') {
      const err = new Error("Could not determine compilation target from metadata.");
      console.log({loc: '[REFORMAT]', err: err});
      throw err;
    }
  
    input['sources'] = {}
    for (const source in sources) {
      input.sources[source] = {'content': sources[source].content}
    }
    console.log({input})
  
    input.language = metadata.language
    input.settings.metadata = input.settings.metadata || {}
    input.settings.outputSelection = input.settings.outputSelection || {}
    input.settings.outputSelection[fileName] = input.settings.outputSelection[fileName] || {}
  
    input.settings.outputSelection[fileName][contractName] = [
      'evm.bytecode',
      'evm.deployedBytecode',
      'metadata'
    ];
  
    return {
      input: input,
      fileName: fileName,
      contractName: contractName
    }
  }

process = async () => {
    const meta = require('./GnosisSafeMeta.json');
    const {
        input,
        fileName,
        contractName
      } = reformatMetadata(meta, meta.sources);
    console.log(solc.version())
    const solcjs = await new Promise((resolve, reject) => {
        solc.loadRemoteVersion(`v${meta.compiler.version}`, (error, soljson) => {
            (error) ? reject(error) : resolve(soljson);
        });
    });
    console.log(solcjs.version())
    const compiled = solcjs.compile(JSON.stringify(input));
    const output = JSON.parse(compiled);
    const contract = output.contracts[fileName][contractName];
    const onchainByteCode = await web3.eth.getCode("0x4BDdf88f5633205E650fF74c4a9ebcFeD2537D27");
    /*
    console.log({onchainByteCode})
    console.log({
        bytecode: contract.evm.bytecode.object,
        deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
        metadata: contract.metadata.trim()
      })
    */
    console.log(web3.utils.sha3(onchainByteCode))
    console.log(web3.utils.sha3(`0x${contract.evm.deployedBytecode.object}`))
}

module.exports = function(callback) {
    process()
        .then(() => { callback() })
        .catch((err) => { callback(err) })
  }