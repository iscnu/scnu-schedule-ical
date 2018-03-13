var log4js = require('log4js');

log4js.configure({
  appenders: {
    out: {
      type: 'stdout'
    },
    app: {
      type: 'dateFile',
      filename: 'data/logs/schedule',
      "alwaysIncludePattern": true,
      "pattern": "-yyyy-MM-dd.log"
    },
    http: {
      type: 'dateFile',
      filename: 'data/logs/http',
      "alwaysIncludePattern": true,
      "pattern": "-yyyy-MM-dd.log"
    }
  },
  categories: {
    default: { appenders: ['out', 'app'], level: 'info' },
    http: { appenders: ['out', 'http'], level: 'info' },
  }
});

var logger = log4js.getLogger();

module.exports = logger;