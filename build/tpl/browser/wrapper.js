
var $$Compose = (function() {
    
<%= content %>

}).call(window);

if (typeof define === 'function' && define.amd) {

    // Taint DOM in case define/require are not compatible
    // (as for external browserify-ed modules)
    compose.ready = compose.util.loadDeps;
    window.compose = window.compose || compose;

    if(window.compose !== compose)
        window.Compose = compose;

    define('compose.io', function() { return $$Compose; });
}
else {
    if(typeof window.require === 'undefined') {
        window.Compose = $$Compose;
    };
}