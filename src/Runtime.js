'use strict';

const HttpEvent = require('./HttpEvent');
const morgan = require('morgan');
const express = require('express');
const cookieParser = require('cookie-parser');
const port = 3000;

/**
 * Runtime Class instantiates Express.js server
 */
class Runtime {

  /**
   * Runtime constructor
   *
   * @param serverless
   * @param options
   */
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
  }

  /**
   * Instantiate express.js server
   */
  run() {

    process.env.IS_OFFLINE = true;

    this.app = express();
    this.app.use(cookieParser());
    this.app.use(this.requestBodyMiddleware);
    this.app.use(morgan(':method :url :status :res[content-length] [:response-time ms]'));

    this.serverless.service.getAllFunctions().forEach((functionName) => {
      const functionObj = this.serverless.service.getFunction(functionName);
      if (functionObj.events) {
        functionObj.events.forEach(event => {
          if (event.http) {

            let httpEvent = new HttpEvent(this.serverless, functionName, event.http);
            httpEvent.setFunctionHandler(functionObj.handler);

            let endpointMethod = httpEvent.getHttpMethod();
            let endpointPath = httpEvent.getHttpPath();

            console.log(`Routing ${endpointMethod} /${endpointPath} via λ ${functionName}`);

            this.app[endpointMethod](endpointPath, httpEvent.route.bind(httpEvent));
          }
        });
      }
    });

    this.app.listen(port, (e) => {
      if (e) {
        console.error(e);
      } else {
        console.log(`serverless-local listening on port ${port}`);
      }
    });
  }

  /**
   * Middleware which puts together request body.
   *
   * @param {Object} request
   * @param {Object} response
   * @param {Function} next
   */
  requestBodyMiddleware(request, response, next) {
    request.body = null;
    request.setEncoding('utf8');

    request.on('data', function(chunk) {
      if (request.body === null) {
        request.body = '';
      }
      request.body += chunk;
    });

    request.on('end', next);
  }
}

module.exports = Runtime;
