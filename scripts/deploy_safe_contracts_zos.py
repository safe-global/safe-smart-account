import os
import sys
import json
from subprocess import run

network = os.environ.get('NETWORK')
if not network:
    sys.exit("NETWORK not set in env")

print("Deploy master copies to", network)

with open('package.json') as f:
    package = json.load(f)

if os.path.exists("zos.json"):
    os.remove("zos.json")

run(["npx", "zos", "init", package.get("name"), package.get("version")])

run(["npx", "truffle", "compile"])

# Add and deploy GnosisSafe
run(["npx", "zos", "add", "GnosisSafe", "--skip-compile"])
run(["npx", "zos", "push", "--network=" + network, "--skip-compile"])

# Add and deploy ProxyFactory
run(["npx", "zos", "add", "ProxyFactory", "--skip-compile"])
run(["npx", "zos", "push", "--network=" + network, "--skip-compile"])

# Add and deploy MultiSend
run(["npx", "zos", "add", "MultiSend", "--skip-compile"])
run(["npx", "zos", "push", "--network=" + network, "--skip-compile"])

# Add and deploy CreateAndAddModules
run(["npx", "zos", "add", "CreateAndAddModules", "--skip-compile"])
run(["npx", "zos", "push", "--network=" + network, "--skip-compile"])

# Init master copies
run(["npx", "truffle", "--network=" + network, "exec", "scripts/init_contracts.js"])

# Publish zos package
run(["npx", "zos", "publish", "--network=" + network])

'''
Modules are disabled for now
'''
# Add and deploy DailyLimitModule
# run(["npx", "zos", "add", "DailyLimitModule", "--skip-compile"])
# run(["npx", "zos", "push", "--network=" + network, "--skip-compile"])

# Add and deploy SocialRecoveryModule
# run(["npx", "zos", "add", "SocialRecoveryModule", "--skip-compile"])
# run(["npx", "zos", "push", "--network=" + network, "--skip-compile"])

# Add and deploy StateChannelModule
# run(["npx", "zos", "add", "StateChannelModule", "--skip-compile"])
# run(["npx", "zos", "push", "--network=" + network, "--skip-compile"])

# Add and deploy WhitelistModule
# run(["npx", "zos", "add", "WhitelistModule", "--skip-compile"])
# run(["npx", "zos", "push", "--network=" + network, "--skip-compile"])