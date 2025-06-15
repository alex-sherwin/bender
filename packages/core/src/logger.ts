export interface Logger {
  debug(message: string, object?: any): void;
  info(message: string, object?: any): void;
  warn(message: string, object?: any): void;
  error(message: string, object?: any): void;
}

export function createLogger(): Logger {

  const messageWithTimestamp = (level: string, message: string) => {
    const timestamp = new Date().toISOString();
    return `${timestamp} - ${level.padEnd(5, " ")} - ${message}`;
  };

  return {

    debug: (message: string, ...other: any[]) => {
      console.debug(messageWithTimestamp("DEBUG", message), ...other);
    },
    info: (message: string, ...other: any[]) => {
      console.info(messageWithTimestamp("INFO", message), ...other);
    },
    warn: (message: string, ...other: any[]) => {
      console.warn(messageWithTimestamp("WARN", message), ...other);
    },
    error: (message: string, ...other: any[]) => {
      console.error(messageWithTimestamp("ERROR", message), ...other);
    },
  }

}

export const log = createLogger();
