#!/usr/bin/env node

const fs = require('fs')
const util = require('util')
const path = require('path')

const log = console.log

const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)

const contractDir = path.join("build", "contracts")
const metaDir = path.join("build", "meta")

async function main(){
  const contractArtifact = require(path.join(process.cwd(), contractDir, "GnosisSafe.json"));

  log("Uploading sources & metadata to IPFS (Infura Gateway)...")
  log("========================================================")

  log();
  log(contractArtifact.contractName);
  log("-".repeat(contractArtifact.contractName.length));

  const contractMetaFile = path.join(process.cwd(), metaDir, "GnosisSafeMeta.json");
  await writeFile(contractMetaFile, contractArtifact.metadata)
  const contractSourceFile = path.join(process.cwd(), metaDir, "GnosisSafeSource.sol");
  await writeFile(contractSourceFile, contractArtifact.source)
  log();
  log('Finished.');
  log();
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.log(err);
    process.exit(1)
  })