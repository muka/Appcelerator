<%= index %>

Compose.prototype.require = function(m) {
    var modules = {
        <%= modules %>
    };
    
    if(typeof modules[m] !== 'function') {
        throw new Error("module not found " + m);
    }
    
    return modules[m]();
};