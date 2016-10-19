'use strict';

const sinon = require('sinon');
const expect = require('chai').expect;
const should = require('chai').should;
const Lambda = require('../../src/Lambda');

describe('Lambda', () => {
  describe('#constructor()', () => {
    it('should attach parameters', () => {
      const subject = new Lambda('path', 'handler');

      expect(subject).to.have.property('path', 'path');
      expect(subject).to.have.property('handler', 'handler');
    });
  });

  describe('#invoke()', () => {
    it('should invoke handler', (done) => {
      const subject = new Lambda(`${process.cwd()}/tests/stubs/lambda`, 'handler');

      subject.invoke({}, {}, (error, result) => {
        expect(error).to.be.null;
        expect(result).to.deep.equal({
          statusCode: 202,
          headers: {
            'Content-Type': 'text/plain'
          },
          body: 'OK'
        });
        done();
      });
    });
  });

  describe('#buildEventFromRequest()', () => {
    it('should invoke handler', () => {
      const request = {
        method: 'get',
        path: '/resource/endpoint',
        headers: {},
        query: {},
        params: {},
        body: 'OK'
      };
      const subject = new Lambda(`${process.cwd()}/tests/stubs/lambda`, 'handler');

      expect(subject.buildEventFromRequest(request, 'test')).to.deep.equal({
        resource: '/resource/endpoint',
        path: '/resource/endpoint',
        httpMethod: 'GET',
        headers: {},
        queryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {
          accountId: '<Account id>',
          resourceId: '<Resource id>',
          stage: 'test',
          requestId: '<Request id>',
          identity: null,
          resourcePath: '/resource/endpoint',
          httpMethod: 'GET',
          apiId: '<API id>',
        },
        body: 'OK',
      });
    });

    it('should invoke handler with query and path parameters', () => {
      const request = {
        method: 'get',
        path: '/resource/endpoint',
        headers: { 'content-type': 'text/plain' },
        query: { queryParam: 'queryValue' },
        params: { pathParam: 'pathValue' },
        body: '{"data": "value"}'
      };
      const subject = new Lambda(`${process.cwd()}/tests/stubs/lambda`, 'handler');

      expect(subject.buildEventFromRequest(request, 'test')).to.deep.equal({
        resource: '/resource/endpoint',
        path: '/resource/endpoint',
        httpMethod: 'GET',
        headers: { 'Content-Type': 'text/plain' },
        queryStringParameters: { queryParam: 'queryValue' },
        pathParameters: { pathParam: 'pathValue' },
        stageVariables: null,
        requestContext: {
          accountId: '<Account id>',
          resourceId: '<Resource id>',
          stage: 'test',
          requestId: '<Request id>',
          identity: null,
          resourcePath: '/resource/endpoint',
          httpMethod: 'GET',
          apiId: '<API id>',
        },
        body: '{"data": "value"}',
      });
    });
  });

  describe('#buildContext()', () => {
    it('returns object', () => {
      const subject = new Lambda(`${process.cwd()}/tests/stubs/lambda`, 'handler');

      expect(subject.buildContext()).to.be.deep.equal({});
    });
  });

  describe('#camelizeHeader()', () => {
    it('camelizes headers', () => {
      const subject = new Lambda(`${process.cwd()}/tests/stubs/lambda`, 'handler');

      expect(subject.camelizeHeader('content-type')).to.be.equal('Content-Type');
      expect(subject.camelizeHeader('cookie')).to.be.equal('Cookie');
      expect(subject.camelizeHeader('x-api-123')).to.be.equal('X-Api-123');
    });
  });
});
