import chalk from "chalk";
import _ from "lodash";
import pidusage from "pidusage";
import pslist from "ps-list";
import numeral from "numeral";
import fkill from "fkill";

// number of eslint processes that should left running if memory threshold is reached.
// Recommended value is from 1 to 3.
// Depends on available memory and memory consumption per process.
const OPTIMAL_PROCESS_COUNT = 2;

const MAX_MEMORY_CONSUMPTION_GB = 6;
const CHECK_INTERVAL_IN_SECONDS = 30;

const currentProcessPID = process.pid;

async function getEslintProcesses() {
  const processes = await pslist();
  const eslintProcesses = processes.filter(
    (pr) =>
      pr.name === "node" &&
      pr.cmd.includes("js-language-service.js") &&
      pr.cmd.includes("-debug-name=eslint") &&
      pr.pid !== currentProcessPID // just in case
  );
  const detailedEslintProcesses = await pidusage(
    eslintProcesses.map((pr) => pr.pid)
  );

  return eslintProcesses.map((pr) => ({
    name: pr.name,
    command: pr.cmd,
    ...detailedEslintProcesses[pr.pid],
  }));
}

function reportEslintProcesses(processes) {
  processes.forEach((pr) => {
    console.log(
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

  console.log(
    `Total memory: ${chalk[memoryThresholdReached ? "red" : "green"](
      numeral(totalMemory).format("0.00b")
    )}`
  );
  console.log(`Total CPU: ${numeral(totalCpu).format("0.00")} %`);

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
  console.log("--------------------");
  setTimeout(monitor, CHECK_INTERVAL_IN_SECONDS * 1000);
}

void monitor();
