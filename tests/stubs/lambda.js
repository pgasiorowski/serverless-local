module.exports.error = function(event, context, callback) {
  callback('callback error');
};

module.exports.handler = function(event, context, callback) {
  callback(null, {
    statusCode: 202,
    headers: {
      'Content-Type': 'text/plain'
    },
    body: 'OK'
  });
};
