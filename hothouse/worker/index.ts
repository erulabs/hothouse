import { Worker } from "bullmq";
import { redis } from "../lib/redis";
import { logger } from "../lib/logger";

const connection = redis("GENERAL");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const rateWorker = new Worker(
  "rate",
  async (job) => {
    console.log("Processing rate job", job.id);
  },
  { connection }
);

const downloadWorker = new Worker(
  "download",
  async (job) => {
    console.log("Processing download job", job.id);
  },
  { connection }
);

rateWorker.run();
downloadWorker.run();

logger.info("Worker started");

process.on("SIGINT", async () => {
  logger.info("Shutting down workers");
  await rateWorker.close();
  await downloadWorker.close();
  await sleep(1000);
  process.exit(0);
});
