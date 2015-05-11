'<%= name %>': (function() {
var exports = {}; var module = { exports: exports };

<%= content %>

return module && module.exports && Object.keys(module.exports).length
        ? module.exports : exports;
})()
