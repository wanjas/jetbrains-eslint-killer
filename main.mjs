import chalk from "chalk";
import _ from "lodash";
import pidusage from "pidusage";
import pslist from "ps-list";
import numeral from "numeral";
import fkill from "fkill";
import { hideBin } from "yargs/helpers";
import yargs from "yargs";
import { z } from "zod";

const argv = yargs(hideBin(process.argv))
  .option("m", {
    alias: "max-memory",
    default: 6,
    describe:
      "Maximum allowed memory consumption in GB. Exceeding this limit will lead to killings down to 'optimal-process-count'. Default: 6 GB",
    type: "number",
  })
  .option("c", {
    alias: "optimal-process-count",
    default: 2,
    describe:
      "Number of eslint processes that should be left running if memory threshold is reached. Default: 2",
    type: "count",
  })
  .option("i", {
    alias: "interval",
    default: 30,
    describe: "Check interval in seconds. Default: 30 seconds.",
    type: "number",
  })
  .option("s", {
    alias: "silent",
    default: false,
    describe: "Don't output log messages. Default: false",
    type: "boolean",
  }).argv;

const options = z
  .object({
    optimalProcessCount: z.number().int().min(1).default(2),
    maxMemory: z
      .number()
      .min(
        0.5,
        "One eslint process uses 0.5-2GB. Setting a lower value will lead co constant killing attempts."
      )
      .default(6),
    interval: z.number().min(1).default(30),
    silent: z.boolean().default(false),
  })
  .parse(argv);

console.log(options);

// number of eslint processes that should left running if memory threshold is reached.
// Recommended value is from 1 to 3.
// Depends on available memory and memory consumption per process.
const OPTIMAL_PROCESS_COUNT = options["optimalProcessCount"];

const MAX_MEMORY_CONSUMPTION_GB = options["maxMemory"];
const CHECK_INTERVAL_IN_SECONDS = options["interval"];

const SILENT = options["silent"];

const currentProcessPID = process.pid;

function log(message) {
  if (!SILENT) {
    console.log(message);
  }
}

async function getEslintProcesses() {
  const processes = await pslist();
  const eslintProcesses = processes.filter(
    (pr) =>
      pr.name === "node" &&
      pr.cmd.includes("js-language-service.js") &&
      pr.cmd.includes("-debug-name=eslint") &&
      pr.pid !== currentProcessPID // just in case
  );
  const pids = eslintProcesses.map((pr) => pr.pid);
  if (_.isEmpty(pids)) {
    return [];
  }
  const detailedEslintProcesses = await pidusage(pids);

  return eslintProcesses.map((pr) => ({
    name: pr.name,
    command: pr.cmd,
    ...detailedEslintProcesses[pr.pid],
  }));
}

function reportEslintProcesses(processes) {
  processes.forEach((pr) => {
    log(
      `${pr.pid} - ${numeral(pr.memory).format("0.00b")} - ${pr.cpu} - ${
        pr.command
      } %`
    );
  });
}

async function thresholdReached(processes) {
  const totalMemory = processes.reduce((acc, pr) => acc + pr.memory, 0); // in bytes
  const totalCpu = processes.reduce((acc, pr) => acc + pr.cpu, 0);

  const memoryThresholdReached =
    totalMemory / 1024 / 1024 / 1024 > MAX_MEMORY_CONSUMPTION_GB;

  log(
    `Total memory: ${chalk[memoryThresholdReached ? "red" : "green"](
      numeral(totalMemory).format("0.00b")
    )}`
  );
  log(`Total CPU: ${numeral(totalCpu).format("0.00")} %`);

  return memoryThresholdReached;
}

async function killEslintProcesses(processes) {
  const orderedProcesses = _.orderBy(
    processes,
    ["cpu", "elapsed"],
    ["desc", "asc"]
  );

  // kill older and inactive first
  const pidsToKill = orderedProcesses
    .map((pr) => pr.pid)
    .slice(OPTIMAL_PROCESS_COUNT);
  if (!_.isEmpty(pidsToKill)) {
    await fkill(pidsToKill);
  }
}

async function monitor() {
  const processes = await getEslintProcesses();
  reportEslintProcesses(processes);
  const isThresholdReached = await thresholdReached(processes);
  if (isThresholdReached) {
    await killEslintProcesses(processes);
  }
  log("--------------------");
  setTimeout(monitor, CHECK_INTERVAL_IN_SECONDS * 1000);
}

void monitor();
