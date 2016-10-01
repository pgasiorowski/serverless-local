'use strict';

const functionLoader = require;

/**
 * Handles API Gateway HTTP Event
 */
class HttpEvent {

  /**
   * Constructor
   *
   * @param {Object} serverless
   * @param {String} functionName
   * @param {Object} httpEvent
   */
  constructor(serverless, functionName, httpEvent) {

    this.serverless = serverless;
    this.functionName = functionName;

    // Endpoint can be a string eg "GET sub/resource"
    if (typeof httpEvent === 'string') {
      let endpointString = httpEvent.split(' ');
      httpEvent = {};
      httpEvent.method = endpointString[0].toLowerCase();
      httpEvent.path = endpointString[1].toLowerCase();
    }

    // These will check against invalid configuration
    if (!httpEvent.method) {
      throw new Error(`Endpoint for λ ${this.functionName} has no method`);
    }
    if (!httpEvent.path) {
      throw new Error(`Endpoint for λ ${this.functionName} has no path`);
    }

    // Express.js has 'all()' method for handling any of http methods
    // in aws the method is called 'ANY'
    this.httpMethod = (httpEvent.method.toLowerCase() === 'any') ? 'all' : httpEvent.method.toLowerCase();

    // Rewrite APIG path parameters to express.js format
    // eg /resource/{id} => /resource/:id
    this.httpPath = '/' + httpEvent.path.replace(/{/g, ':').replace(/}/g, '');

    // Validate authorizer if provided
    if (httpEvent.authorizer) {

      // Validate authorizer's configuration
      if (typeof httpEvent.authorizer.name !== 'string' || httpEvent.authorizer.name.length < 1) {
        throw new Error(`Invalid authorizer name for λ ${this.functionName}`);
      }
      if (typeof httpEvent.authorizer.identitySource !== 'string' || httpEvent.authorizer.identitySource.length < 1) {
        throw new Error(`Invalid identitySource for λ ${this.functionName}`);
      }
      if (httpEvent.authorizer.identitySource.indexOf('method.request.header.') !== 0) {
        throw new Error(`Expected method.request.header.* in identitySource for λ ${this.functionName}`);
      }

      this.authorizer = httpEvent.authorizer;
    }
  }

  /**
   * Get HTTP method (eg. "get" "post" etc..)
   *
   * @returns {string|*}
   */
  getHttpMethod() {
    return this.httpMethod;
  }

  /**
   * Get HTTP path (eg. "resource/sub-resource" etc..)
   *
   * @returns {string|*}
   */
  getHttpPath() {
    return this.httpPath;
  }

  /**
   * Serverless function handler
   *
   * @param {String} handler
   */
  setFunctionHandler(handler) {
    this.handlerPath = handler.split('.')[0];
    this.handlerName = handler.split('/').pop().split('.')[1];
    this.functionPath = `${process.cwd()}/${this.handlerPath}`;
  }

  /**
   * Route express.js request via serverless handler
   *
   * @param {Object} request
   * @param {Object} response
   */
  route(request, response) {

    const event = this.buildFunctionEventFromRequest(request);
    const context = this.buildFunctionContext();
    const callback = (failure, result) => {

      if (failure) {
        console.error(`λ ${this.functionName} returned error: ${failure}`);
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
    delete functionLoader.cache[functionLoader.resolve(this.functionPath)];


    // Create authorize function if the endpoint requires it
    if (this.authorizer) {

      const authorizerEvent = this.buildAuthorizerEvent(request);

      if (authorizerEvent === null) {
        response.status(403).set({'Content-Type': 'application/json'}).send(JSON.stringify({message: 'Unauthorized'}));
        return;
      }

      try {

        this.authorize(this.authorizer.name, authorizerEvent, (err, authorizerResult) => {

          if (err) {

            // This is the default returned by APIG in case of authentication failure
            console.error(`Auth λ ${this.functionName} ERROR: ${err}`);
            return response.status(403).set({'Content-Type': 'application/json'}).send(JSON.stringify({message: 'Unauthorized'}));

          } else if (typeof authorizerResult.principalId !== 'string' && typeof authorizerResult.principalId !== 'number') {

            console.error(`Auth λ ${this.functionName} returned invalid principalId`);
            return response.status(403).set({'Content-Type': 'application/json'}).send(JSON.stringify({message: 'Unauthorized'}));

          } else {

            // APIG always parses principalId to string
            event.requestContext.authorizer = {principalId: `${authorizerResult.principalId}`};

            // Authentication succeed, now we can invoke the lambda handler
            try {
              functionLoader(this.functionPath)[this.handlerName](event, context, callback);
            } catch(e) {
              return response.status(500).send(`λ ${this.functionName} Caught ERROR: ${e.message}`);
            }
          }
        });
      } catch(e) {
        return response.status(500).send(`Auth λ ${this.functionName} Caught ERROR: ${e.message}`);
      }

    } else {

      // Call the function w/o authorizers
      try {
        functionLoader(this.functionPath)[this.handlerName](event, context, callback);
      } catch (e) {
        return response.status(500).send(`λ ${this.functionName} Caught ERROR: ${e.message}`);
      }
    }
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

    const authCallback = (err, authorizerResult) => {

      // Unauthorized - authorizer returned error or invalid data
      if (err) return callback(err);
      if ('principalId' in authorizerResult === false || 'policyDocument' in authorizerResult === false) {
        return callback(`Result from authorizer λ ${functionName} is invalid`);
      }

      // Authorized
      callback(null, authorizerResult)
    };


    // Invalidate common.js cache and invoke the function w/o authorizers
    delete functionLoader.cache[functionLoader.resolve(functionPath)];
    functionLoader(functionPath)[handlerName](handlerEvent, {}, authCallback);
  }


  buildAuthorizerEvent(request) {

    const authHeader = this.authorizer.identitySource.split('.').pop().toLowerCase();

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

  buildFunctionContext() {
    return {};
  }

  buildFunctionEventFromRequest(request) {

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

module.exports = HttpEvent;
