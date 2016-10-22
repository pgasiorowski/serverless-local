'use strict';

const sinon = require('sinon');
const expect = require('chai').expect;
const Runtime = require('../../src/Runtime');
const serverlessStub = {
  service: {
    getAllFunctions: sinon.stub().returns(['test']),
    getFunction: sinon.stub().returns({
      handler: 'tests/stubs/lambda.handler',
      events: [{
        http: 'GET test'
      }]
    })
  },
  cli: {
    log: sinon.stub().returns()
  }
};

describe('Runtime', () => {
  describe('#constructor()', () => {
    it('should attach parameters', () => {
      const options = {};
      const subject = new Runtime(serverlessStub, options);

      expect(process.env).to.have.property('IS_OFFLINE');
      expect(subject).to.have.property('serverless', serverlessStub);
      expect(subject).to.have.property('options', options);
    });
  });

  describe('#run()', () => {
    it('should run', (done) => {
      const subject = new Runtime(serverlessStub, {});
      const server = subject.run(() => {
        expect(server).to.have.property('close');
        server.close();
        done();
      });
    });
  });

  describe('#requestBodyMiddleware()', () => {
    it('should merge chunks', (done) => {
      const events = {};
      const request = {
        setEncoding: sinon.stub().returns(null),
        on(event, data) {
          events[event] = data;
        }
      };

      const subject = new Runtime(serverlessStub, {});
      subject.requestBodyMiddleware(request, {}, done);

      expect(events).to.have.property('data');
      expect(events).to.have.property('end');
      expect(request.body).to.equal(null);

      events['data']('abc');
      events['data']('~');
      events['data']('123');
      expect(request.body).to.equal('abc~123');
      events['end']();
    });
  });

  describe('#padMethod()', () => {
    it('should mad method', () => {
      const subject = new Runtime(serverlessStub, {});

      expect(subject.padMethod('GET')).to.equal('GET    ');
      expect(subject.padMethod('OPTIONS')).to.equal('OPTIONS');
      expect(subject.padMethod('LONG-METHOD')).to.equal('LONG-METHOD');
    });
  });
});
