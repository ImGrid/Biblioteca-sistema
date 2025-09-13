const fs = require("fs");
const path = require("path");

const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.info;

const getTimestamp = () => {
  return new Date().toISOString();
};

const writeToFile = (level, message, meta = {}) => {
  try {
    const logData = {
      timestamp: getTimestamp(),
      level: level.toUpperCase(),
      message,
      ...meta,
    };

    const logLine = JSON.stringify(logData) + "\n";
    const today = new Date().toISOString().split("T")[0];
    const filepath = path.join(logsDir, `app-${today}.log`);

    fs.appendFileSync(filepath, logLine);

    if (level === "error") {
      const errorPath = path.join(logsDir, `errors-${today}.log`);
      fs.appendFileSync(errorPath, logLine);
    }
  } catch (error) {
    console.error("Error writing log:", error.message);
  }
};

const writeToConsole = (level, message) => {
  const timestamp = getTimestamp().substring(11, 19); // Solo hora HH:MM:SS

  switch (level) {
    case "error":
      console.log(`[ERROR] ${timestamp} - ${message}`);
      break;
    case "warn":
      console.log(`[WARN] ${timestamp} - ${message}`);
      break;
    case "info":
      console.log(`[INFO] ${timestamp} - ${message}`);
      break;
    case "debug":
      console.log(`[DEBUG] ${timestamp} - ${message}`);
      break;
  }
};

const log = (level, message, meta = {}) => {
  const levelValue = LOG_LEVELS[level];

  if (levelValue > currentLogLevel) {
    return;
  }

  writeToConsole(level, message);
  writeToFile(level, message, meta);
};

// Logging específico para eventos de seguridad
const security = (event, details = {}, request = null) => {
  const securityMeta = {
    event_type: "SECURITY",
    security_event: event,
    ip_address: request?.ip || "unknown",
    user_id: request?.user?.id || null,
    ...details,
  };

  log("warn", `Security Event: ${event}`, securityMeta);

  const today = new Date().toISOString().split("T")[0];
  const securityLogData = {
    timestamp: getTimestamp(),
    level: "SECURITY",
    message: `Security Event: ${event}`,
    ...securityMeta,
  };

  try {
    const logLine = JSON.stringify(securityLogData) + "\n";
    const filepath = path.join(logsDir, `security-${today}.log`);
    fs.appendFileSync(filepath, logLine);
  } catch (error) {
    console.error("Error writing security log:", error.message);
  }
};

// Logging para auditoría
const audit = (action, details = {}, request = null) => {
  const auditMeta = {
    event_type: "AUDIT",
    action,
    user_id: request?.user?.id || null,
    user_role: request?.user?.role || null,
    ip_address: request?.ip || "unknown",
    ...details,
  };

  log("info", `Audit: ${action}`, auditMeta);
};

const error = (message, meta = {}) => log("error", message, meta);
const warn = (message, meta = {}) => log("warn", message, meta);
const info = (message, meta = {}) => log("info", message, meta);
const debug = (message, meta = {}) => log("debug", message, meta);

module.exports = {
  error,
  warn,
  info,
  debug,
  security,
  audit,
  log,
};
