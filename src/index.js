'use strict';

const Runtime = require('./Runtime');

class Local {

  constructor(serverless, options) {

    options.port = options.port || 3000;

    this.runtime = new Runtime(serverless, options);

    this.commands = {
      local: {
        usage: 'Mocks AWS API Gateway locally in Lambda-proxy mode',
        lifecycleEvents: ['init'],
        options: {
          port: {
            usage: 'Port to listen on. Default: 3000',
            shortcut: 'P'
          },
        }
      }
    };

    this.hooks = {
      'local:init': this.runtime.run.bind(this.runtime),
    };
  }
}

module.exports = Local;
