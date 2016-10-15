module.exports.error = function(event, context, callback) {
  callback('callback error');
};

module.exports.missingAuthorizerId = function(event, context, callback) {
  callback(null, {policyDocument: {}});
};

module.exports.missingPolicy = function(event, context, callback) {
  callback(null, {principalId: 1});
};

module.exports.handler = function(event, context, callback) {
  callback(null, {
    principalId: 1,
    policyDocument: {}
  });
};
