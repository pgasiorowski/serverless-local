'use strict';

const functionLoader = require;

class Lambda {

  constructor(path, handler) {
    this.path = path;
    this.handler = handler;
  }

  invoke(event, context, callback) {
    // Invalidate common.js cache
    delete functionLoader.cache[functionLoader.resolve(this.path)];

    functionLoader(this.path)[this.handler](event, context, callback);
  }

  buildEventFromRequest(request, apiStage) {
    const result = {
      resource: request.path,
      path: request.path,
      httpMethod: request.method.toUpperCase(),
      headers: {},
      queryStringParameters: Object.keys(request.query).length ? request.query : null,
      pathParameters: Object.keys(request.params).length ? request.params : null,
      stageVariables: null,
      requestContext: {
        accountId: '<Account id>',
        resourceId: '<Resource id>',
        stage: apiStage,
        requestId: '<Request id>',
        identity: null,
        resourcePath: request.path,
        httpMethod: request.method.toUpperCase(),
        apiId: '<API id>',
      },
      body: request.body,
    };

    // Camel-Case header names, as this is what APIG does
    Object.keys(request.headers).forEach((header) => {
      result.headers[this.camelizeHeader(header)] = request.headers[header];
    });

    return result;
  }

  buildContext() {
    return {};
  }

  camelizeHeader(str) {
    const arr = str.split('-');
    for (let i = 0; i < arr.length; i++) {
      arr[i] = arr[i][0].toUpperCase() + arr[i].slice(1);
    }
    return arr.join('-');
  }
}

module.exports = Lambda;
