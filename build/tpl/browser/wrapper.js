
var $$Compose = (function() {
    
<%= content %>

}).call(window);

if (typeof define === 'function' && define.amd) {
    define(function() { return $$Compose; });
}
else {
    if(typeof window.require === 'undefined') {
        
        if(window.Compose) {
            window.Compose_conflicting = window.Compose;
        }
        
        window.Compose = $$Compose;
    };
}