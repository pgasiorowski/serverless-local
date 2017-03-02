'use strict';

const Lambda = require('./Lambda');
const AuthorizerLambda = require('./AuthorizerLambda');

/**
 * Handles API Gateway HTTP Event
 */
class HttpEvent {

  /**
   * Constructor
   *
   * @param {Object} serverless
   * @param {String} functionName
   * @param {Object} httpEventObj
   */
  constructor(serverless, functionName, httpEventObj) {
    this.serverless = serverless;
    this.functionName = functionName;
    let httpEvent = httpEventObj;

    // Endpoint can be a string eg "GET sub/resource"
    if (typeof httpEvent === 'string') {
      const endpointString = httpEvent.split(' ');
      httpEvent = {};
      httpEvent.method = endpointString[0].toLowerCase();
      httpEvent.path = endpointString[1].toLowerCase();
    }

    // These will check against invalid configuration
    if (!httpEvent.method) {
      throw new Error(`Endpoint for λ ${functionName} has no method`);
    }
    if (!httpEvent.path) {
      throw new Error(`Endpoint for λ ${functionName} has no path`);
    }

    // Express.js has 'all()' method for handling any of http methods
    // in aws the method is called 'ANY'
    if (httpEvent.method.toLowerCase() === 'any') {
      this.httpMethod = 'all';
    } else {
      this.httpMethod = httpEvent.method.toLowerCase();
    }

    // Rewrite APIG path parameters to express.js format
    // eg /resource/{id} => /resource/:id
    this.httpPath = `/${httpEvent.path.replace(/{/g, ':').replace(/}/g, '')}`;

    // Validate authorizer if provided
    if (httpEvent.authorizer) {
      // Validate authorizer's configuration
      if (typeof httpEvent.authorizer.name !== 'string' || httpEvent.authorizer.name.length < 1) {
        throw new Error(`Invalid authorizer name for λ ${functionName}`);
      }
      if (typeof httpEvent.authorizer.identitySource !== 'string') {
        throw new Error(`Invalid identitySource for λ ${functionName}`);
      }
      if (httpEvent.authorizer.identitySource.length < 1) {
        throw new Error(`Invalid identitySource for λ ${functionName}`);
      }
      if (httpEvent.authorizer.identitySource.indexOf('method.request.header.') !== 0) {
        throw new Error(`Expected method.request.header.* in identitySource for λ ${functionName}`);
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
    const stage = this.serverless.service.provider.stage || 'dev';
    const env = this.serverless.service.provider.environment || {}; // TODO: Merge with function obj
    if (this.serverless.service.provider.profile) {
      env.AWS_PROFILE = this.serverless.service.provider.profile;
    }

    const lambda = new Lambda(this.functionPath, this.handlerName, env);
    const event = lambda.buildEventFromRequest(request, stage);
    const context = lambda.buildContext();
    const callback = (failure, result) => {
      if (failure) {
        const errorMessage = JSON.stringify(failure);
        this.serverless.cli.log(`λ ${this.functionName} returned error: ${errorMessage}`);
      }

      // Lambda did not fail but also did not succeed
      if (!result || typeof result !== 'object') {
        response
          .status(500)
          .send('Internal server error');
        return;
      }

      const headers = result.headers || {};

      // APIG defaults 'Content-Type' if not provided
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
      }

      response.status(result.statusCode || 200);
      response.set(headers);

      if (result.body) {
        response.send(result.body);
      } else {
        response.end();
      }
    };

    // Create authorize function if the endpoint requires it
    if (this.authorizer) {
      const authorizer = new AuthorizerLambda(this.serverless, this.authorizer);
      const authorizerEvent = authorizer.buildEventFromRequest(request);
      const authorizerContext = authorizer.buildContext();

      if (authorizerEvent === null) {
        response
          .status(403)
          .set({ 'Content-Type': 'application/json' })
          .send(JSON.stringify({ message: 'Unauthorized' }));
        return;
      }

      authorizer.authorize(authorizerEvent, authorizerContext, (err, res) => {
        if (err) {
          // This is the default returned by APIG in case of authentication failure
          this.serverless.cli.log(`Auth λ ${this.functionName} ERROR: ${err}`);
          response
            .status(403)
            .set({ 'Content-Type': 'application/json' })
            .send(JSON.stringify({ message: 'Unauthorized' }));
        } else if (typeof res.principalId !== 'string' && typeof res.principalId !== 'number') {
          this.serverless.cli.log(`Auth λ ${this.functionName} returned invalid principalId`);
          response
            .status(403)
            .set({ 'Content-Type': 'application/json' })
            .send(JSON.stringify({ message: 'Unauthorized' }));
        } else {
          event.requestContext.authorizer = {};

          // APIG allows to pass through additional string variables in 'context'
          if (typeof res.context === 'object') {
            Object.keys(res.context).forEach((key) => {
              event.requestContext.authorizer[`${key}`] = `${res.context[key]}`;
            });
          }

          // APIG always parses principalId to string
          event.requestContext.authorizer.principalId = `${res.principalId}`;

          // Call the function authorizers
          try {
            lambda.invoke(event, context, callback);
          } catch (e) {
            this.serverless.cli.log(e);
            response
              .status(500)
              .send(`λ ${this.functionName} Caught ERROR: ${e.message}`);
          }
        }
      });
    } else {
      // Call the function w/o authorizers
      try {
        lambda.invoke(event, context, callback);
      } catch (e) {
        this.serverless.cli.log(e);
        response
          .status(500)
          .send(`λ ${this.functionName} Caught ERROR: ${e.message}`);
      }
    }
  }
}

module.exports = HttpEvent;
