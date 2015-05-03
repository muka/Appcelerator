#!/bin/sh

node build.js titanium > ../../build/titanium/compose.js
node build.js browser > ../../build/browser/compose.js
