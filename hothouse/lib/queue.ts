import Queue from "bull";

import { REDIS_SERVERS } from "./redis";

export const rateQueue = new Queue('rate', {
  connection: {
    host: REDIS_SERVERS[0].host,
    port: REDIS_SERVERS[0].port,
  },
});

rateQueue.process(async function (job: any) {
  console.log('Processing rate job', job.id);
});

export const downloadQueue = new Queue('download', {
    connection: {
      host: REDIS_SERVERS[0].host,
      port: REDIS_SERVERS[0].port,
    },
});

downloadQueue.process(async function (job: any) {
  console.log('Processing download job', job.id);
});
