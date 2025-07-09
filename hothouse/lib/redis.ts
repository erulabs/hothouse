import Redis, { type RedisOptions } from "ioredis";
import { logger } from "./logger";

function parseUris(urisStr: string): Array<{ host: string; port: number }> {
  if (typeof urisStr !== "string") return [];
  const uris = urisStr.split(",");
  const out = [];
  for (let i = 0; i < uris.length; i++) {
    const [host, port] = uris[i].split(":");
    out.push({ host, port: parseInt(port, 10) });
  }
  return out;
}

export const REDIS_SERVERS = parseUris(process.env.REDIS_SERVERS || "");
const REDIS_ENABLE_TLS = process.env.REDIS_ENABLE_TLS === "true";

if (!process.env.REDIS_SERVERS || !REDIS_SERVERS.length) {
  throw new Error(
    "REDIS_SERVERS is not set. You can create a .env file with the servers.",
  );
}

const redises: Record<
  string,
  { handle: Redis | undefined; servers: { host: string; port: number }[] }
> = {
  GENERAL: { handle: undefined, servers: REDIS_SERVERS },
};

const redisOptions: RedisOptions = {
  lazyConnect: false,
  enableOfflineQueue: true,
  connectTimeout: 10000,
  maxRetriesPerRequest: null,
  tls: REDIS_ENABLE_TLS ? {} : undefined,
  retryStrategy: (times: number) => {
    return Math.min(times * 1000, 10000);
  },
  reconnectOnError: (err: Error) => {
    // @ts-expect-error code is not defined on Error
    const code = err.code;
    if (
      code === "ETIMEDOUT" ||
      code === "ECONNREFUSED" ||
      code === "ENOTFOUND"
    ) {
      logger.error(`Redis ${code}! Reconnecting...`);
      return 2;
    } else if (err.message.slice(0, "READONLY".length) === "READONLY") {
      logger.error("Connected to READONLY Redis instance! Reconnecting...");
      return 2;
    } else {
      logger.error("Unknown Redis error!", {
        code,
        errMsg: err.message,
        tls: REDIS_ENABLE_TLS,
        err,
      });
      return true;
    }
  },
};

function redis(target: keyof typeof redises, forceNew = false): Redis {
  if (!redises[target]) throw new Error(`No such redis "${target}" defined!`);
  if (redises[target].handle && !forceNew) return redises[target].handle;
  else {
    let handle: Redis;
    if (redises[target].servers.length === 1) {
      handle = new Redis({
        port: redises[target].servers[0].port,
        host: redises[target].servers[0].host,
        ...redisOptions,
      });
    } else {
      // Dummy, for testing - errors on use
      handle = new Redis({
        lazyConnect: true,
        enableOfflineQueue: false,
        reconnectOnError: () => false,
      });
    }
    handle.on("error", (err) => {
      if (
        (err.message === "Connection is closed." ||
          err.code === "ECONNREFUSED") &&
        process.env.NODE_ENV === "development"
      ) {
        logger.warn("Redis not ready...");
        return;
      }
      logger.error("Redis error: ", {
        code: err.code,
        syscall: err.syscall,
        servers: redises[target].servers,
      });
    });
    // @ts-expect-error waitForReady is not defined on Redis
    handle.waitForReady = () => {
      return new Promise((resolve, reject) => {
        let resolved = false;
        const connected = () => {
          if (resolved) return;
          resolved = true;
          resolve(handle);
        };
        handle.once("ready", () => connected());
        if (handle.status === "ready") return connected();
        else if (
          handle.status !== "connecting" &&
          handle.status !== "connect"
        ) {
          handle.connect().catch((err) => {
            if (handle.status === "reconnecting") {
              return;
            }
            logger.error("Failed to connect to redis:", {
              err,
              status: handle.status,
            });
            reject(err);
          });
        }
      });
    };
    if (forceNew) return handle;
    else if (handle) {
      redises[target].handle = handle as Redis;
      return redises[target].handle;
    }
  }
  throw new Error("Failed to create redis handle");
}

function disconnectRedis() {
  for (const target in redises) {
    if (redises[target].handle) {
      redises[target].handle.quit();
      redises[target].handle = undefined;
    }
  }
}

const redisPublisher = redis("GENERAL", true);
async function publishEvent(eventName: string, event: any) {
  event.publishDate = new Date().getTime();
  redisPublisher?.publish(eventName, JSON.stringify(event));
}

export { redis, disconnectRedis, publishEvent };
