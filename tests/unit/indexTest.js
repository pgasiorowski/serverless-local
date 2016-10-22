'use strict';

const expect = require('chai').expect;
const Local = require('../../src/index');

describe('Local', () => {
  describe('#constructor()', () => {
    it('should attach parameters', () => {
      const serverless = {
        service: {
          getAllFunctions() {
            return [];
          }
        }
      };
      const options = {};
      const subject = new Local(serverless, options);

      expect(subject).to.have.deep.property('commands.local.usage', 'Mocks AWS API Gateway locally in Lambda-proxy mode');
      expect(subject).to.have.deep.property('commands.local.lifecycleEvents[0]', 'init');
      expect(subject).to.have.deep.property('commands.local.options.port.usage', 'Port to listen on. Default: 3000');
      expect(subject).to.have.deep.property('commands.local.options.port.shortcut', 'P');
      expect(subject).to.have.property('runtime');
      expect(subject).to.have.property('hooks');
    });
  });
});
