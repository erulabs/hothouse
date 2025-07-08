import { Worker } from "bullmq";
import { redis } from "../lib/redis";
import { logger } from "../lib/logger";
import { downloadCandidates } from "../lib/download";
import { rate } from "../lib/rate";

const connection = redis("GENERAL", true);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  // @ts-expect-error waitForReady is not defined on Redis
  await connection.waitForReady();

  const queues = {
    rate,
    download: downloadCandidates,
  };
  const workers: Record<string, Worker> = {};

  for (const [queueName, handler] of Object.entries(queues)) {
    const worker = new Worker(
      queueName,
      async (t) => {
        await handler(t);
      },
      { connection, concurrency: 2 },
    );

    worker.on("completed", (job, result) => {
      logger.debug(`${queueName}: completed`, {
        jobId: job.data.jobId,
        candidateId: job.data.candidateId,
      });
    });

    worker.on("failed", (job, error) => {
      throw error;
    });

    worker.on("error", (e) => {
      logger.error(`${queueName}: error: ${e.message}`, {
        name: e.name,
        stack: e.stack,
      });
    });

    workers[queueName] = worker;
  }

  process.on("SIGTERM", async () => {
    logger.info("Shutting down workers");
    for (const worker of Object.values(workers) as Worker[]) {
      await worker.close();
    }
    await sleep(1000);
    process.exit(0);
  });

  logger.info("Worker started!", { env: process.env.NODE_ENV });
}

main();
