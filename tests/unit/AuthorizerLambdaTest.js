'use strict';

const sinon = require('sinon');
const expect = require('chai').expect;
const should = require('chai').should;
const AuthorizerLambda = require('../../src/AuthorizerLambda');

describe('AuthorizerLambda', () => {
  describe('#constructor()', () => {
    it('should attach parameters', () => {
      const serverless = { service: { prop1: 'val1' } };
      const authorizerObj = { prop2: 'val2' };
      const subject = new AuthorizerLambda(serverless, authorizerObj);

      expect(subject).to.have.deep.property('serverless.service.prop1', 'val1');
      expect(subject).to.have.deep.property('authorizer.prop2', 'val2');
    });
  });

  describe('#authorize()', () => {
    it('should throw errors on missing function', () => {
      const serverless = {
        service: {
          getFunction: sinon.stub().returns(null)
        }
      };
      const authorizer = {name: 'testAuthorizer'};
      const subject = new AuthorizerLambda(serverless, authorizer);

      expect(() => subject.authorize()).to.throw(Error, 'Authorizer λ testAuthorizer is undefined');
    });

    it('should throw errors if function has no handler', () => {
      const serverless = {
        service: {
          getFunction: sinon.stub().returns({})
        }
      };
      const authorizer = {name: 'testAuthorizer'};
      const subject = new AuthorizerLambda(serverless, authorizer);

      expect(() => subject.authorize()).to.throw(Error, 'Authorizer λ testAuthorizer has no handler');
    });
  });
});
