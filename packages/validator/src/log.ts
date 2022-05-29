import loglevel from 'loglevel';

export const log = loglevel.getLogger('validator');
log.setLevel(process.env.NODE_ENV === 'production' ? 'WARN' : 'TRACE');

export const logLevel = log.getLevel();
export const LOG_PREFIX = 'VALIDATOR:';

export const logEnabledFor = (level: keyof loglevel.LogLevel) => {
  const currentLevel = log.getLevel();
  if (currentLevel === log.levels.SILENT) return false; // NO LOGS

  const levelNumber = log.levels[level];
  return levelNumber >= currentLevel; //Only logs if higher than current level
};

//REFERENCE FRON logLevel
// interface LogLevel {
//   TRACE: 0;
//   DEBUG: 1;
//   INFO: 2;
//   WARN: 3;
//   ERROR: 4;
//   SILENT: 5;
// }
