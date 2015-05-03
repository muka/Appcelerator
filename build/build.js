
var _ = require('underscore'),
    fs = require('fs'),
    path = require('path')
;

var platform = process.argv[2];

if (!platform) {
    throw new Error('Specify a platform')
}

var DEBUG = false;
var log = function() {
    DEBUG && console.log.apply(console.log, arguments);
}

log("building for %s", platform);

var deps = [
    './utils/DefinitionReader',
    './utils/List',
    './client',
    './WebObject',
    './ServiceObject',
    './platforms/mqtt/' + platform,
    './platforms/stomp/'+ platform,
    './platforms/http/'+ platform,
];


var readSource = function(src) {
    var srcpath = path.resolve('../'+ src + ".js");
    log(srcpath);
    return fs.readFileSync(srcpath, 'utf8');
};


var wrapper;

if(platform === 'browser') {
    
    deps.push( { name: 'bluebird', source: "./vendors/bluebird/browser/bluebird" } );
    deps.push( { name: 'stompjs', source: "./vendors/stompjs/stomp.min" } );
    
    wrapper = _.template(readSource("./build/tpl/browser/wrapper"));
}

var moduleWrapper = _.template(readSource("./build/tpl/module-wrapper"));
var indexWrapper = _.template(readSource("./build/tpl/index-wrapper"));

var buffer = [];
_.forEach(deps, function(file) {
    
    var name = file;
    var source = file;
    
    if(typeof file === 'object') {
        name = file.name;
        source = file.source;
    }
    
    buffer.push(
        moduleWrapper({
            name: name,
            content: readSource(source)
        })
    );
    
});

var indexSource = readSource('./index');

var content = indexWrapper({    
    index: indexSource,
    modules: buffer.join(",\n")    
});

var source = wrapper({
    content: content
});

console.log(source);