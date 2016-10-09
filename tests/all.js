'use strict';

// For 'Uncaught Error: UNABLE_TO_VERIFY_LEAF_SIGNATURE'
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

const glob  = require('glob');
const Mocha = require('mocha');
const mocha = new Mocha({
  timeout: 10000,
  reporter: 'spec'
});

glob.sync(process.cwd() + '/tests/**/*Test.js').forEach((file) => {
  mocha.addFile(file)
});

mocha.run((failures) =>
  process.on('exit', () =>
    process.exit(failures)
  )
);

