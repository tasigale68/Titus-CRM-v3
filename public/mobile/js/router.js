var Router = (function() {
  var routes = {};
  var currentPage = null;

  function register(name, renderFn) { routes[name] = renderFn; }

  function go(name, params) {
    if (currentPage === name && !params) return;
    currentPage = name;
    window.location.hash = '#' + name;
    var content = document.getElementById('appContent');
    var nav = document.getElementById('bottomNav');
    if (name === 'login') { nav.style.display = 'none'; } else { nav.style.display = 'flex'; }
    if (routes[name]) { routes[name](content, params); }
    // Update active nav
    document.querySelectorAll('.nav-item').forEach(function(el) {
      el.classList.toggle('active', el.dataset.page === name);
    });
  }

  function init() {
    var hash = window.location.hash.replace('#', '') || 'login';
    if (API.getToken()) { go(hash === 'login' ? 'home' : hash); } else { go('login'); }
  }

  window.addEventListener('hashchange', function() {
    var hash = window.location.hash.replace('#', '');
    if (hash && routes[hash]) go(hash);
  });

  return { register: register, go: go, init: init, current: function() { return currentPage; } };
})();
