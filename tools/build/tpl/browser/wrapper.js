(function(self) {

    var $$Compose = function() {    <%= content %>    };

    if (typeof define === 'function' && define.amd) {
        define(function() { return $$Compose.call(self); });
    }
    else {
        if(typeof window.require === 'undefined') {

            if(window.Compose) {
                window.Compose_conflicting = window.Compose;
            }

            window.Compose = $$Compose.call(self);
        };
    }

}).call(window);