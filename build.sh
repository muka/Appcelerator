#!/bin/sh

cd node_modules/mqtt

browserify mqtt.js -s mqtt > ../../vendors/browser-mqtt.js

cd ../../

cd tools/build

./build.sh

