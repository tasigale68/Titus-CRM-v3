var API = (function() {
  var baseUrl = '';
  var token = localStorage.getItem('sw_token') || '';

  function headers() {
    var h = { 'Content-Type': 'application/json' };
    if (token) h['x-sw-token'] = token;
    return h;
  }

  function request(method, path, body) {
    var opts = { method: method, headers: headers() };
    if (body) opts.body = JSON.stringify(body);
    return fetch(baseUrl + path, opts).then(function(r) {
      if (r.status === 401) { Router.go('login'); return Promise.reject(new Error('Unauthorized')); }
      if (!r.ok) return r.json().then(function(e) { throw new Error(e.error || 'Request failed'); });
      return r.json();
    });
  }

  return {
    setToken: function(t) { token = t; localStorage.setItem('sw_token', t); },
    clearToken: function() { token = ''; localStorage.removeItem('sw_token'); },
    getToken: function() { return token; },
    get: function(path) { return request('GET', path); },
    post: function(path, body) { return request('POST', path, body); },
    put: function(path, body) { return request('PUT', path, body); },
    del: function(path) { return request('DELETE', path); },
    upload: function(path, formData) {
      var h = {}; if (token) h['x-sw-token'] = token;
      return fetch(baseUrl + path, { method: 'POST', headers: h, body: formData }).then(function(r) { return r.json(); });
    }
  };
})();
