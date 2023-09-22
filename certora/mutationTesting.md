To run gambit you run `certoraMutate` with the prover conf file and the gambit conf file. A prover conf file is generated every time you run the prover using your script. Prover conf files are an alternate way to run the prover by calling certoraRun and giving it the prover file `certoraRun path/to/prover/conf/file.conf`. Auto-generated prover conf files are in `.certora_internal/latest/run.conf`. Copy this to a conf file in `./certora/conf`. The gambit conf file points to the contract you want to mutate, and num_mutants specifies the number of mutations to generate. Gambit runs the spec with the original code and the mutations generated. Analyzing which mutations your spec caught can give you a pretty good understanding of your spec coverage.

Run the following command from the root:

```bash
certoraMutate --prover_conf path/to/conf/file.conf --mutation_conf path/to/gambit/file.conf
```

example

```bash
certoraMutate --prover_conf certora/conf/safe.conf --mutation_conf certora/conf/mutationSafe.conf
```

After submitting all the mutation testing jobs to the server, the gambit generates a `collect.json` file with all the information needed to collect the mutation testing results. After a few hours, you can collect these results with the following command:

```bash
certoraMutate --collect_file collect.json
```

You will get a link to the mutation test report after all the results have been collected successfully.

Optionally, you can also have the results of mutation testing dumped into a csv file as follows:

```bash
certoraMutate --collect_file collect.json --dump_csv path/to/csv/file.csv
```
