'use strict';

const Lambda = require('./Lambda');

class AuthorizerLambda {

  constructor(serverless, authorizerObj) {
    this.serverless = serverless;
    this.authorizer = authorizerObj;

    const authFunctionObj = this.serverless.service.getFunction(this.authorizer.name);

    // Validate the authorizer
    if (authFunctionObj === null) {
      throw new Error(`Authorizer λ ${this.authorizer.name} is undefined`);
    }
    if ('handler' in authFunctionObj === false) {
      throw new Error(`Authorizer λ ${this.authorizer.name} has no handler`);
    }

    this.authFunctionObj = authFunctionObj;
  }

  /**
   * Invokes a lambda function an authorizer for another function.
   *
   * @param {Object}   event
   * @param {Object}   context
   * @param {Function} callback
   */
  authorize(event, context, callback) {
    const path = this.authFunctionObj.handler.split('.')[0];
    const name = this.authFunctionObj.handler.split('/').pop().split('.')[1];
    const env = this.serverless.service.provider.environment || {}; // TODO: Merge with function obj
    const lambda = new Lambda(`${process.cwd()}/${path}`, name, env);

    lambda.invoke(event, context, (err, authorizerResult) => {
      if (err) {
        // Unauthorized - authorizer returned error or invalid data
        callback(err);
      } else if ('principalId' in authorizerResult === false) {
        callback(`Result from authorizer λ ${this.authorizer.name} is invalid`);
      } else if ('policyDocument' in authorizerResult === false) {
        callback(`Result from authorizer λ ${this.authorizer.name} is missing a policy`);
      } else {
        // Authorized
        callback(null, authorizerResult);
      }
    });
  }

  /**
   * Generates event object for authorize call
   *
   * @param {Object} request
   * @returns {Object|null}
   */
  buildEventFromRequest(request) {
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
      methodArn: [
        'arn',
        'aws',
        'execute-api',
        providerRegion,
        '<Account id>',
        `<API id>/${providerStage}/${request.method}${request.path}`,
      ].join(':'),
    };
  }

  buildContext() {
    return {};
  }
}

module.exports = AuthorizerLambda;
