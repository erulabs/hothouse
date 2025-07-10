import { createLogger, format, transports } from "winston";

const PLAINTEXT_LOGGING = process.env.PLAINTEXT_LOGGING === "true";
const LOG_FILE = process.env.LOG_FILE;
const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const LOGGING_LABEL = process.env.LOGGING_LABEL || "hothouse";
const APP_ENV = process.env.APP_ENV || "development";

let loggingFormat = format.combine(
  format.timestamp(),
  format.label({ label: LOGGING_LABEL }),
  format.label({ label: APP_ENV }),
  format.json({
    replacer: (_key: string, value: unknown) => {
      if (value instanceof Buffer) {
        return value.toString("base64");
      } else if (value?.constructor.name === "Error") {
        const errorValue = value as Error;
        return {
          name: errorValue.name,
          message: errorValue.message,
          stack: errorValue.stack,
          cause: (errorValue as Error).cause,
        };
      }
      return value;
    },
  }),
);

const loggingTransports = [new transports.Console()];

if (LOG_FILE) {
  loggingTransports.push(
    // @ts-expect-error - FileTransportInstance is not assignable to ConsoleTransportInstance
    new transports.File({ filename: LOG_FILE, level: LOG_LEVEL }),
  );
}

if (PLAINTEXT_LOGGING || process.env.NODE_ENV === "development") {
  const logFormat = format.printf((info) => {
    const c = Object.assign({}, info);
    // @ts-expect-error - cant figure this one out!
    delete c.level;
    delete c.message;
    delete c.timestamp;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function convertToJson(set: Record<string, any>) {
      for (const key in set) {
        if (set[key]?.constructor?.name === "Error") {
          set[key] = {
            name: set[key].name,
            message: set[key].message,
            stack: set[key].stack,
            cause: set[key].cause,
            toJSON: set[key].toJSON,
          };
        } else if (
          set[key] &&
          typeof set[key] === "object" &&
          typeof set[key].toJSON === "function"
        ) {
          set[key] = set[key].toJSON();
        } else if (set[key] && Array.isArray(set[key])) {
          convertToJson(set[key]);
        }
      }
    }
    convertToJson(c);
    // Pretty print objects
    const obj = JSON.stringify(c, null, 2);
    let o = Object.keys(c).length > 0 ? obj : "";
    // If they're very small objects, let's ditch indentation/line-breaks
    if (o.length < 80) o = o.replace(/\n/g, " ").replace(/\s\s+/g, " ");
    return `${info.level}: ${info.message} ${o}`;
  });
  loggingFormat = format.combine(
    format.colorize(),
    format.timestamp(),
    logFormat,
  );
}

export const logger = createLogger({
  level: LOG_LEVEL,
  format: loggingFormat,
  transports: loggingTransports,
});

export const logOnlyInProduction = (
  loggerFunc: string = "info",
  ...args: unknown[]
) => {
  Array.prototype.shift.apply(args);
  if (process.env.NODE_ENV !== "development") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (logger as any)[loggerFunc](...args);
  }
};

export const logOnlyInDevelopment = (
  loggerFunc: string = "info",
  ...args: unknown[]
) => {
  Array.prototype.shift.apply(args);
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (logger as any)[loggerFunc](...args);
  }
};
