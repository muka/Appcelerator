(function(self) {

    var $$Compose = (function() { <%= content %> }).call(self);
    if (typeof define === 'function' && define.amd) {
        define(function(require, exports, module) {
            exports = $$Compose;
            return $$Compose;
        });
    }
    else {
        if(typeof window.require === 'undefined') {

            if(window.Compose) {
                window.Compose_conflicting = window.Compose;
            }

            window.Compose = $$Compose;
        };
    }

}).call(window);