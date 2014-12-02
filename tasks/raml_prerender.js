/*
 * grunt-raml-prerender
 * https://github.com/sullivanpt/grunt-raml-prerender
 *
 * Copyright (c) 2014 Patrick Sullivan
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {
  var async = require('async');
  var raml = require('raml-parser');

  function processOneRamlFile(src, dst, callback) {

    grunt.log.debug('Processing "' + src);
    raml.loadFile(src).then( function(data) {

      // Write the destination file.
      grunt.file.write(dst, JSON.stringify(data));

      // Print a success message.
      grunt.log.debug('File "' + dst + '" created.');

      // do the next file
      callback();

    }, function(error) {
      callback(error);
    });

  }


  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('raml_prerender', 'Convert RAML to JSON, validating, normalizing, and converting markdown to HTML.', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
    });
    // raml parser uses callbacks so we are an async task
    var done = this.async();
    var that = this;

    async.eachSeries(this.files, function (f, callback) {

      // Concat specified files.
      var src = f.src.filter(function(filepath) {
        // Warn on and remove invalid source files (if nonull was set).
        if (!grunt.file.exists(filepath)) {
          grunt.log.warn('Source file "' + filepath + '" not found.');
          return false;
        } else {
          return true;
        }
      });

      if (src.length !== 1) {
        return callback('Too many sources for ' + f.dest);
      }

      // we have a valid filename ready to go
      processOneRamlFile(src[0], f.dest, callback);

    }, function (err) {
      if (err) {
        grunt.log.error(err);
        return done(err);
      }
      grunt.log.writeln('All done.');
      return done();
    });
  });

};
