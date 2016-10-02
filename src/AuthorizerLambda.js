'use strict';

const Lambda = require('./Lambda');

class AuthorizerLambda {

  constructor(serverless, authorizerObj) {
    this.serverless = serverless;
    this.authorizer = authorizerObj;
  }

  authorize(event, context, callback) {

    const authFunctionObj = this.serverless.service.getFunction(this.authorizer.name);

    // Validate the authorizer
    if (authFunctionObj === null) {
      throw new Error(`Authorizer λ ${this.authorizer.name} is undefined`);
    }
    if ('handler' in authFunctionObj === false) {
      throw new Error(`Authorizer λ ${this.authorizer.name} has no handler`);
    }

    const path = authFunctionObj.handler.split('.')[0];
    const name = authFunctionObj.handler.split('/').pop().split('.')[1];
    const lambda = new Lambda(`${process.cwd()}/${path}`, name);

    lambda.invoke(event, context, (err, authorizerResult) => {

      // Unauthorized - authorizer returned error or invalid data
      if (err) {
        return callback(err);
      }
      if ('principalId' in authorizerResult === false || 'policyDocument' in authorizerResult === false) {
        return callback(`Result from authorizer λ ${this.authorizer.name} is invalid`);
      }

      // Authorized
      callback(null, authorizerResult)

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
      methodArn: `arn:aws:execute-api:${providerRegion}:<Account id>:<API id>/${providerStage}/${request.method}${request.path}`,
    };
  }

  buildContext() {
    return {};
  }
}

module.exports = AuthorizerLambda;
