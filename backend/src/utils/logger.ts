enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

enum LogColor {
  DEBUG = '\x1b[34m',
  INFO = '\x1b[32m',
  WARN = '\x1b[33m',
  ERROR = '\x1b[31m',
  CRITICAL = '\x1b[41m\x1b[37m',
  RESET = '\x1b[0m',
  CATEGORY = '\x1b[36m'
}

const MIN_LOG_LEVEL = LogLevel.DEBUG; 

function log(level: LogLevel, category: string, message: string, ...args: any[]) {
  if (LogLevel[level] < LogLevel[MIN_LOG_LEVEL]) {
      return;
  }

  const timestamp = new Date().toISOString();
  const color = LogColor[level];
  const categoryColor = LogColor.CATEGORY;
  const reset = LogColor.RESET;
  
  const formattedMessage = `${timestamp} ${color}[${level}]${reset} ${categoryColor}<${category}>${reset} ${message}`;

  const logFn = level === LogLevel.ERROR || level === LogLevel.CRITICAL ? console.error : console.log;

  logFn(formattedMessage, ...args);
}

export const logger = {
  debug: (category: string, message: string, ...args: any[]) => 
    log(LogLevel.DEBUG, category, message, ...args),
  info: (category: string, message: string, ...args: any[]) => 
    log(LogLevel.INFO, category, message, ...args),
  warn: (category: string, message: string, ...args: any[]) => 
    log(LogLevel.WARN, category, message, ...args),
  error: (category: string, message: string, ...args: any[]) => 
    log(LogLevel.ERROR, category, message, ...args),
  critical: (category: string, message: string, ...args: any[]) => 
    log(LogLevel.CRITICAL, category, message, ...args),
};