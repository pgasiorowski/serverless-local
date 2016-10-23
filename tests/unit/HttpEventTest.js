'use strict';

const sinon = require('sinon');
const expect = require('chai').expect;
const HttpEvent = require('../../src/HttpEvent');

describe('HttpEvent', () => {
  describe('#constructor()', () => {
    it('should attach parameters when event is string', () => {
      const serverless = {};
      const functionName = 'TestLambda';
      const httpEventObj = 'get test/resources';
      const subject = new HttpEvent(serverless, functionName, httpEventObj);

      expect(subject).to.have.property('serverless', serverless);
      expect(subject).to.have.property('functionName', functionName);
      expect(subject).to.have.property('httpMethod', 'get');
      expect(subject).to.have.property('httpPath', '/test/resources');
    });
    it('should attach parameters when event is an object', () => {
      const serverless = {};
      const functionName = 'TestLambda';
      const httpEventObj = {
        method: 'GET',
        path: 'test/resource'
      };
      const subject = new HttpEvent(serverless, functionName, httpEventObj);

      expect(subject).to.have.property('serverless', serverless);
      expect(subject).to.have.property('functionName', functionName);
      expect(subject).to.have.property('httpMethod', 'get');
      expect(subject).to.have.property('httpPath', '/test/resource');
    });
    it('should throw error when http method is undefined', () => {
      const serverless = {};
      const functionName = 'TestLambda';
      const httpEventObj = { path: 'test/resource' };

      expect(() => new HttpEvent(serverless, functionName, httpEventObj))
        .to.throw(Error, 'Endpoint for λ TestLambda has no method');
    });
    it('should throw error when http path is undefined', () => {
      const serverless = {};
      const functionName = 'TestLambda';
      const httpEventObj = { method: 'GET' };

      expect(() => new HttpEvent(serverless, functionName, httpEventObj))
        .to.throw(Error, 'Endpoint for λ TestLambda has no path');
    });
    it('should correctly create ANY handler', () => {
      const serverless = {};
      const functionName = 'TestLambda';
      const httpEventObj = { method: 'ANY', path: 'proxy/resource' };
      const subject = new HttpEvent(serverless, functionName, httpEventObj);

      expect(subject).to.have.property('httpMethod', 'all');
      expect(subject).to.have.property('httpPath', '/proxy/resource');
    });
    it('should correctly create resource-level path', () => {
      const serverless = {};
      const functionName = 'TestLambda';
      const httpEventObj = { method: 'GET', path: 'proxy/{id}' };
      const subject = new HttpEvent(serverless, functionName, httpEventObj);

      expect(subject).to.have.property('httpMethod', 'get');
      expect(subject).to.have.property('httpPath', '/proxy/:id');
    });
    it('should throw error if authorizer is invalid', () => {
      const serverless = {};
      const functionName = 'TestLambda';
      let httpEventObj;

      httpEventObj = {
        method: 'GET',
        path: 'test',
        authorizer: {}
      };
      expect(() => new HttpEvent(serverless, functionName, httpEventObj))
        .to.throw(Error, 'Invalid authorizer name for λ TestLambda');

      httpEventObj = {
        method: 'GET',
        path: 'test',
        authorizer: { name: '' }
      };
      expect(() => new HttpEvent(serverless, functionName, httpEventObj))
        .to.throw(Error, 'Invalid authorizer name for λ TestLambda');

      httpEventObj = {
        method: 'GET',
        path: 'test',
        authorizer: { name: 'authFunc' }
      };
      expect(() => new HttpEvent(serverless, functionName, httpEventObj))
        .to.throw(Error, 'Invalid identitySource for λ TestLambda');

      httpEventObj = {
        method: 'GET',
        path: 'test',
        authorizer: { name: 'authFunc', identitySource: '' }
      };
      expect(() => new HttpEvent(serverless, functionName, httpEventObj))
        .to.throw(Error, 'Invalid identitySource for λ TestLambda');

      httpEventObj = {
        method: 'GET',
        path: 'test',
        authorizer: { name: 'authFunc', identitySource: 'invalid' }
      };
      expect(() => new HttpEvent(serverless, functionName, httpEventObj))
        .to.throw(Error, 'Expected method.request.header.* in identitySource for λ TestLambda');
    });
    it('should accept correct authorizer object', () => {
      const serverless = {};
      const functionName = 'TestLambda';
      const httpEventObj = {
        method: 'GET',
        path: 'test',
        authorizer: { name: 'authFunc', identitySource: 'method.request.header.Cookie' }
      };
      const subject = new HttpEvent(serverless, functionName, httpEventObj);

      expect(subject).to.have.property('authorizer', httpEventObj.authorizer);
    });
  });

  describe('#getHttpMethod()', () => {
    it('should return http method', () => {
      const serverless = {};
      const functionName = 'TestLambda';
      const httpEventObj = 'get test/resources';
      const subject = new HttpEvent(serverless, functionName, httpEventObj);

      expect(subject.getHttpMethod()).to.equal('get');
    });
  });

  describe('#getHttpPath()', () => {
    it('should return http path', () => {
      const serverless = {};
      const functionName = 'TestLambda';
      const httpEventObj = 'get test/resources';
      const subject = new HttpEvent(serverless, functionName, httpEventObj);

      expect(subject.getHttpPath()).to.equal('/test/resources');
    });
  });

  describe('#setFunctionHandler()', () => {
    it('should update function handler', () => {
      const serverless = {};
      const functionName = 'TestLambda';
      const httpEventObj = 'get test/resources';
      const subject = new HttpEvent(serverless, functionName, httpEventObj);

      expect(subject).to.not.have.property('handlerPath');
      expect(subject).to.not.have.property('handlerName');
      expect(subject).to.not.have.property('functionPath');

      subject.setFunctionHandler('tests/stubs/authorizer.handler');

      expect(subject).to.have.property('handlerPath', 'tests/stubs/authorizer');
      expect(subject).to.have.property('handlerName', 'handler');
      expect(subject).to.have.property('functionPath', `${process.cwd()}/tests/stubs/authorizer`);
    });
  });

  describe('#route()', () => {
    it('should route', (done) => {
      const serverless = {
        service: { provider: { /* stage: 'test' */ }},
        cli: {
          log: sinon.stub().returns()
        }
      };
      const functionName = 'TestLambda';
      const httpEventObj = 'get resource/endpoint';
      const subject = new HttpEvent(serverless, functionName, httpEventObj);
      subject.setFunctionHandler('tests/stubs/lambda.handler');

      const request = {
        method: 'get',
        path: '/resource/endpoint',
        headers: {},
        query: {},
        params: {},
        body: null
      };
      const response = {};
      response.set = sinon.stub().returns(response);
      response.status = sinon.stub().returns(response);
      response.send = (data) => {
        expect(data).to.equal('OK');
        done();
      };

      subject.route(request, response);
    });
  });
});
