'use strict';

const expect = require('chai').expect;
const AuthorizerLambda = require('../../src/AuthorizerLambda');

describe('AuthorizerLambda', () => {

  describe('#constructor()', () => {
    it('should attach parameters', () => {
      const serverless = {sls: 1};
      const authorizerObj = {auth: 1};
      const cuthorizerLambda = new AuthorizerLambda(serverless, authorizerObj);
      expect(typeof cuthorizerLambda.serverless).to.be.equal(serverless);
      expect(typeof cuthorizerLambda.authorizer).to.be.equal(authorizerObj);
    });
  });
});
