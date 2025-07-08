import { Queue, Worker } from "bullmq";

import { redis } from "./redis";

const connection = redis('GENERAL')

export const rateQueue = new Queue('rate', { connection });

export const downloadQueue = new Queue('download', { connection });
