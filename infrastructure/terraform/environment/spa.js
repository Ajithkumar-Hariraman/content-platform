function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.indexOf('/api/') === 0 || uri === '/api') return request;
  if (uri.endsWith('/') || uri.split('/').pop().indexOf('.') === -1)
    request.uri = '/index.html';
  return request;
}
