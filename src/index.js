'use strict';

const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const express = require('express');
const cookieParser = require('cookie-parser');
const port = 3000;


class Local {

  constructor(serverless, options) {
    this.serverless = serverless;
    this.service = serverless.service;
    this.serverlessLog = serverless.cli.log.bind(serverless.cli);
    this.options = options;

    this.commands = {
      local: {
        usage: 'Mocks AWS API Gateway locally.',
        commands: {
          run: {
            usage: 'Mocks AWS API Gateway locally in Lambda-proxy mode',
            lifecycleEvents: [
              'init'
            ]
          }
        },
        options: {
        }
      }
    };

    this.hooks = {
      'local:run:init': this.run.bind(this),
      'local:run': this.run.bind(this)
    };
  }

  run() {

    process.env.IS_OFFLINE = true;

    this.app = express();
    this.app.use(cookieParser());
    this.app.use(this.requestParser);
    this.app.use(morgan(':method :url :status :res[content-length] [:response-time ms]'));

    this.serverless.service.getAllFunctions().forEach((functionName) => {
      const functionObj = this.serverless.service.getFunction(functionName);
      if (functionObj.events) {
        functionObj.events.forEach(event => {
          if (event.http) {
            this.buildRoute(functionName, functionObj.handler, event.http);
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

  buildRoute(functionName, handler, endpoint) {

    // Endpoint can be a string eg "GET sub/resource"
    if (typeof endpoint === 'string') {
      let endpointString = endpoint.split(' ');
      endpoint = {};
      endpoint.method = endpointString[0].toLowerCase();
      endpoint.path = endpointString[1].toLowerCase();
    }

    // These will check against invalid configuration
    if (!endpoint.method) throw new Error(`Endpoint for λ ${functionName} has no method`);
    if (!endpoint.path) throw new Error(`Endpoint for λ ${functionName} has no path`);

    // These are not used with the lambda-proxy, can ignore
    delete endpoint.request;
    delete endpoint.response;

    console.log(`Routing ${endpoint.method} /${endpoint.path} via λ ${functionName}`);


    // Express.js has 'all()' method for handling any of http methods
    // in aws the method is called 'ANY'
    const httpMethod = (endpoint.method.toLowerCase() === 'any') ? 'all' : endpoint.method.toLowerCase();

    // Rewrite APIG path parameters to express.js format
    // eg /resource/{id} => /resource/:id
    const endpointPath = '/' + endpoint.path.replace(/{/g, ':').replace(/}/g, '');


    // Create express.js route
    this.app[httpMethod](endpointPath, (request, response) => {

      const handlerPath = handler.split('.')[0];
      const handlerName = handler.split('/').pop().split('.')[1];
      const functionPath = `${process.cwd()}/${handlerPath}`;

      const event = this.buildRequestHeaderFromRequest(request);
      const context = {}; // TODO: We are not using this
      const callback = function(failure, result) {

        if (failure) {
          console.error(`λ ${functionName} returned error: ${failure}`);
        }

        // Lambda did not fail but also did not succeed
        if (!result || typeof result !== 'object') {
          return response.status(500).send('Internal server error');
        }

        const statusCode = result.statusCode || 200;
        const headers = result.headers || {};
        const body = result.body || null;

        response.status(statusCode).set(headers).send(body);
      };

      // Invalidate common.js cache
      delete require.cache[require.resolve(functionPath)];


      // Create authorize function if the endpoint requires it
      if (typeof endpoint.authorizer && endpoint.authorizer) {

        const authorizerEvent = this.buildAuthorizerEvent(endpoint, request);

        if (authorizerEvent === null) {
          response.status(403).set({'Content-Type': 'application/json'}).send(JSON.stringify({message: 'Unauthorized'}));
          return;
        }

        try {

          this.authorize(endpoint.authorizer.name, authorizerEvent, function(err, authorizerResult) {

            if (err) {

              // This is the default returned by APIG in case of authentication failure
              console.error(`Auth λ ${functionName} ERROR: ${err}`);
              return response.status(403).set({'Content-Type': 'application/json'}).send(JSON.stringify({message: 'Unauthorized'}));

            } else if (typeof authorizerResult.principalId !== 'string' && typeof authorizerResult.principalId !== 'number') {

              console.error(`Auth λ ${functionName} returned invalid principalId`);
              return response.status(403).set({'Content-Type': 'application/json'}).send(JSON.stringify({message: 'Unauthorized'}));

            } else {

              // APIG always parses principalId to string
              event.requestContext.authorizer = {principalId: `${authorizerResult.principalId}`};

              // Authentication succeed, now we can invoke the lambda handler
              try {
                require(functionPath)[handlerName](event, context, callback);
              } catch(e) {
                return response.status(500).send(`λ ${functionName} Caught ERROR: ${e.message}`);
              }
            }
          });
        } catch(e) {
          return response.status(500).send(`Auth λ ${functionName} Caught ERROR: ${e.message}`);
        }

      } else {

        // Call the function w/o authorizers
        try {
          require(functionPath)[handlerName](event, context, callback);
        } catch (e) {
          return response.status(500).send(`λ ${functionName} Caught ERROR: ${e.message}`);
        }
      }
    });
  }

  authorize(functionName, handlerEvent, callback) {

    const authFunctionObj = this.serverless.service.getFunction(functionName);

    // Validate the authorizer parameters
    if ('handler' in authFunctionObj === false) {
      throw new Error(`Authorizer λ ${functionName} has no handler`);
    }

    const handlerPath = authFunctionObj.handler.split('.')[0];
    const handlerName = authFunctionObj.handler.split('/').pop().split('.')[1];
    const functionPath = `${process.cwd()}/${handlerPath}`;

    const authCallback = function(err, authorizerResult) {

      // Unauthorized - authorizer returned error or invalid data
      if (err) return callback(err);
      if ('principalId' in authorizerResult === false || 'policyDocument' in authorizerResult === false) {
        return callback(`Result from authorizer λ ${functionName} is invalid`);
      }

      // Authorized
      callback(null, authorizerResult)
    };


    // Invalidate common.js cache and invoke the function w/o authorizers
    delete require.cache[require.resolve(functionPath)];
    require(functionPath)[handlerName](handlerEvent, {}, authCallback);
  }

  // We want to parse JSON and JSON-API but keep application/x-www-form-urlencoded as string
  requestParser(request, response, next) {
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

  buildAuthorizerEvent(endpoint, request) {

    // Validate authorizer's configuration
    if (typeof endpoint.authorizer.name !== 'string' || endpoint.authorizer.name.length < 1) {
      throw new Error(`Invalid authorizer name for λ ${functionName}`);
    }

    if (typeof endpoint.authorizer.identitySource !== 'string' || endpoint.authorizer.identitySource.length < 1) {
      throw new Error(`Invalid identitySource for λ ${functionName}`);
    }

    if (endpoint.authorizer.identitySource.indexOf('method.request.header.') !== 0) {
      throw new Error(`Expected method.request.header.* in identitySource for λ ${functionName}`);
    }

    const authHeader = endpoint.authorizer.identitySource.split('.').pop().toLowerCase();

    // There is no request header at all
    if (authHeader in request.headers === false) {
      return null;
    }

    // TODO: Should this be built by serverless in options?
    const providerStage = this.serverless.service.provider.stage || 'dev';
    const providerRegion = this.serverless.service.provider.region || 'us-east-1';

    return {
      type: 'TOKEN',
      authorizationToken: request.headers[authHeader],
      methodArn: `arn:aws:execute-api:${providerRegion}:<Account id>:<API id>/${providerStage}/${request.method}${request.path}`,
    };
  }

  log() {
    this.serverlessLog.apply(this, arguments);
  }

  buildRequestHeaderFromRequest(request) {

    let result = {
      resource: request.path,
      path: request.path,
      httpMethod: request.method.toUpperCase(),
      headers: [],
      queryStringParameters: Object.keys(request.query).length ? request.query : null,
      pathParameters: Object.keys(request.params).length ? request.params : null,
      stageVariables: null,
      requestContext: {
        accountId: '<Account id>',
        resourceId: '<Resource id>',
        stage: this.serverless.service.provider.stage || 'dev',
        requestId: '<Request id>',
        identity: null,
        resourcePath: request.path,
        httpMethod: request.method.toUpperCase(),
        apiId: '<API id>'
      },
      body: request.body
    };

    // Camel-Case header names, as this is what APIG does
    Object.keys(request.headers).forEach((header) => {
      result.headers[this.camelizeHeader(header)] = request.headers[header];
    });

    return result;
  }

  camelizeHeader(str) {
    var arr = str.split('-');
    for (var i = 0; i < arr.length; i++) {
      arr[i]= arr[i][0].toUpperCase() + arr[i].slice(1);
    }
    str = arr.join('-');
    return str;
  }
}

module.exports = Local;
