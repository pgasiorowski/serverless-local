'use strict';

const sinon = require('sinon');
const expect = require('chai').expect;
const AuthorizerLambda = require('../../src/AuthorizerLambda');

describe('AuthorizerLambda', () => {
  describe('#constructor()', () => {
    it('should throw errors on missing function', () => {
      const serverless = {
        service: {
          getFunction: sinon.stub().returns(null)
        }
      };
      const authorizer = {name: 'testAuthorizer'};

      expect(() => new AuthorizerLambda(serverless, authorizer))
        .to.throw(Error, 'Authorizer λ testAuthorizer is undefined');
    });

    it('should throw errors if function has no handler', () => {
      const serverless = {
        service: {
          getFunction: sinon.stub().returns({})
        }
      };
      const authorizer = {name: 'testAuthorizer'};

      expect(() => new AuthorizerLambda(serverless, authorizer))
        .to.throw(Error, 'Authorizer λ testAuthorizer has no handler');
    });

    it('should attach parameters', () => {
      const serverless = {
        service: {
          prop1: 'val1',
          getFunction: sinon.stub().returns({
            handler: 'path/to/file.handler'
          })
        }
      };
      const authorizer = {name: 'testAuthorizer'};
      const subject = new AuthorizerLambda(serverless, authorizer);

      expect(subject).to.have.deep.property('serverless.service.prop1', 'val1');
      expect(subject).to.have.deep.property('authorizer.name', 'testAuthorizer');
      expect(subject).to.have.deep.property('authFunctionObj.handler', 'path/to/file.handler');
    });
  });

  describe('#authorize()', () => {
    it('returns error', (done) => {
      const serverless = {
        service: {
          provider: {},
          getFunction: sinon.stub().returns({
            handler: 'tests/stubs/authorizer.error'
          })
        }
      };
      const authorizer = {name: 'testAuthorizer'};
      const subject = new AuthorizerLambda(serverless, authorizer);

      subject.authorize({}, {}, (err, result) => {
        expect(err).to.equal('callback error');
        expect(result).to.be.undefined;
        done();
      });
    });

    it('returns missingAuthorizerId', (done) => {
      const serverless = {
        service: {
          provider: {},
          getFunction: sinon.stub().returns({
            handler: 'tests/stubs/authorizer.missingAuthorizerId'
          })
        }
      };
      const authorizer = {name: 'testAuthorizer'};
      const subject = new AuthorizerLambda(serverless, authorizer);

      subject.authorize({}, {}, (err, result) => {
        expect(err).to.equal(`Result from authorizer λ testAuthorizer is invalid`);
        expect(result).to.be.undefined;
        done();
      });
    });

    it('returns missingPolicy', (done) => {
      const serverless = {
        service: {
          provider: {},
          getFunction: sinon.stub().returns({
            handler: 'tests/stubs/authorizer.missingPolicy'
          })
        }
      };
      const authorizer = {name: 'testAuthorizer'};
      const subject = new AuthorizerLambda(serverless, authorizer);

      subject.authorize({}, {}, (err, result) => {
        expect(err).to.equal(`Result from authorizer λ testAuthorizer is missing a policy`);
        expect(result).to.be.undefined;
        done();
      });
    });

    it('returns valid', (done) => {
      const serverless = {
        service: {
          provider: {},
          getFunction: sinon.stub().returns({
            handler: 'tests/stubs/authorizer.handler'
          })
        }
      };
      const authorizer = {name: 'testAuthorizer'};
      const subject = new AuthorizerLambda(serverless, authorizer);

      subject.authorize({}, {}, (err, result) => {
        expect(err).to.be.null;
        expect(result).to.deep.equal({
          principalId: 1,
          policyDocument: {}
        });
        done();
      });
    });
  });

  describe('#buildEventFromRequest()', () => {
    it('returns null if there is no request header', () => {
      const serverless = {
        service: {
          getFunction: sinon.stub().returns({
            handler: 'tests/stubs/authorizer.handler'
          })
        }
      };
      const authorizer = {
        name: 'testAuthorizer',
        identitySource: 'identitySource: method.request.header.Cookie'
      };
      const request = { headers: {}};

      const subject = new AuthorizerLambda(serverless, authorizer);
      expect(subject.buildEventFromRequest(request)).to.be.null;
    });

    it('returns event object with provider defaults', () => {
      const serverless = {
        service: {
          provider: {},
          getFunction: sinon.stub().returns({
            handler: 'tests/stubs/authorizer.handler'
          })
        }
      };
      const authorizer = {
        name: 'testAuthorizer',
        identitySource: 'method.request.header.Cookie'
      };
      const request = {
        method: 'get',
        path: '/resource/endpoint',
        headers: { cookie: 'name=value' }
      };

      const subject = new AuthorizerLambda(serverless, authorizer);
      expect(subject.buildEventFromRequest(request)).to.be.deep.equal({
        type: 'TOKEN',
        authorizationToken: 'name=value',
        methodArn: 'arn:aws:execute-api:us-east-1:<Account id>:<API id>/dev/get/resource/endpoint',
      });
    });

    it('returns event object with customer stage and region', () => {
      const serverless = {
        service: {
          provider: {
            stage: 'abc',
            region: 'us-west-2'
          },
          getFunction: sinon.stub().returns({
            handler: 'tests/stubs/authorizer.handler'
          })
        }
      };
      const authorizer = {
        name: 'testAuthorizer',
        identitySource: 'method.request.header.Cookie'
      };
      const request = {
        method: 'get',
        path: '/resource/endpoint',
        headers: { cookie: 'name=value' }
      };

      const subject = new AuthorizerLambda(serverless, authorizer);
      expect(subject.buildEventFromRequest(request)).to.be.deep.equal({
        type: 'TOKEN',
        authorizationToken: 'name=value',
        methodArn: 'arn:aws:execute-api:us-west-2:<Account id>:<API id>/abc/get/resource/endpoint',
      });
    });
  });

  describe('#buildContext()', () => {
    it('returns object', () => {
      const serverless = {
        service: {
          getFunction: sinon.stub().returns({
            handler: 'tests/stubs/authorizer.handler'
          })
        }
      };
      const authorizer = {name: 'testAuthorizer'};
      const subject = new AuthorizerLambda(serverless, authorizer);
      expect(subject.buildContext()).to.be.deep.equal({});
    });
  });
});
