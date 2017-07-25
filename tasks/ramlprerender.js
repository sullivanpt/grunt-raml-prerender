/*
 * grunt-raml-prerender
 * https://github.com/sullivanpt/grunt-raml-prerender
 *
 * Copyright (c) 2014 Patrick Sullivan
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {
  var raml = require('raml-parser');
  var _ = grunt.util._;
  var showdown = require('showdown');
  var pd = require('pretty-data').pd; // npm equivalent of vkiryukhin/vkBeautify
  var yaml = require('js-yaml');

  // raml schema validation from https://github.com/sullivanpt/grunt-raml-init
  function validateRaml(file, next) {
    next(); // raml4j is broken
  }


  // appropriate pretty printing
  function beautify(format, data) {
    try {
      if (/xml/.test(format)) {
        return pd.xml(data);
      }
      if (/json/.test(format)) {
        return pd.json(data);
      }
      return data; // unrecognized
    }
    catch (err) {
      return data; // syntax error
    }
  }

  // parse schema string from JSON or YAML
  function parseJsonSchema(schema) {
    // we use the presence of the double quoted string to differentiate JSON from YAML
    if (schema.indexOf('"$schema"') !== -1) {
      return JSON.parse(schema);
    } else {
      return yaml.safeLoad(schema);
    }
  }

  // converts markdown, xml, and json to formatted html
  function formatForDisplay(data) {
    var converter = new showdown.Converter();
    (data.documentation || []).forEach(function (doc) {
      doc.content = converter.makeHtml(doc.content);
    });
    (data.resources || []).forEach(function (resource) {
      resource.description = resource.description && converter.makeHtml(resource.description);
      _.forOwn(resource.uriParameters || {}, function(paramValue) {
        if (paramValue) {
          paramValue.description = paramValue.description && converter.makeHtml(paramValue.description);
          paramValue.uri = true; // so we can use same template
        }
      });
      (resource.methods || []).forEach(function (method) {
        method.description = method.description && converter.makeHtml(method.description);

        _.forOwn(method.queryParameters || {}, function(paramValue) {
          if (paramValue) {
            paramValue.description = paramValue.description && converter.makeHtml(paramValue.description);
          }
        });

        _.forOwn(method.body || {}, function(formatValue, format) {
          // note: we assume body -> type -> example|schema, but body -> example|schema is also technically valid RAML
          _.forOwn(formatValue || {}, function(bodyTypeValue, bodyTypeKey) {
            var schema;
            if (format === 'application/json' && bodyTypeKey === 'schema') { // support YAML schema and unpack an HTML description from the JSON schema
              schema = parseJsonSchema(bodyTypeValue);
              method.bodyDescription = schema.description && converter.makeHtml(schema.description); // markdown for description
              delete schema.description; // too much to see this twice
              bodyTypeValue = JSON.stringify(schema);
            }
            formatValue[bodyTypeKey] = beautify(format, bodyTypeValue);
          });
        });

        _.forOwn(method.responses || {}, function(response) {
          if (response) {
            response.description = response.description && converter.makeHtml(response.description);
            _.forOwn(response.body || {}, function(formatValue, format) {
              _.forOwn(formatValue || {}, function(bodyTypeValue, bodyTypeKey) {
                var schema;
                if (format === 'application/json' && bodyTypeKey === 'schema') { // support YAML schema
                  schema = parseJsonSchema(bodyTypeValue);
                  bodyTypeValue = JSON.stringify(schema);
                }
                formatValue[bodyTypeKey] = beautify(format, bodyTypeValue);
              });
            });
          }
        });
      });
    });
    return data;
  }

  // convert nested resources to rooted resources
  function unnest(src, dst, path, uriParameters, description) {
    (src || []).forEach(function (resource) {
      delete resource.relativeUriPathSegments; // not using it and it's no longer correct
      if (description) {
        resource.description = (resource.description ? (resource.description + '<hr>') : '') + description;
      }
      if (uriParameters) {
        resource.uriParameters = _.extend(resource.uriParameters || {}, uriParameters);
      }
      resource.relativeUri = path + resource.relativeUri;
      unnest(resource.resources, dst, resource.relativeUri, resource.uriParameters, resource.description);
      delete resource.resources;
      dst.unshift(resource);
    });
    return dst;
  }

  // read, validate, pre-format, and save a single RAML file
  function processOneRamlFile(src, dst, options, callback) {

    grunt.log.debug('Processing "' + src);
    // TODO: respect options.validate === false
    validateRaml(src, function (err) {
      if (err) {
        return callback(err);
      }

      raml.loadFile(src).then( function(data) {

        grunt.log.debug('Loaded "' + src, data);

        // pre-process the data before we save it so there is less to do when we want to render it
        try {
          data.resources = unnest(data.resources, [], '');
          data = formatForDisplay(data);
        }
        catch (err) {
          return callback('Error formatting ' + src + ' ' + err);
        }

        grunt.log.debug('Formatted "' + src, data);

        // Write the destination file.
        grunt.file.write(dst, grunt.util.normalizelf(JSON.stringify(data, null, options.prettyPrint)));

        // Print a success message.
        grunt.log.debug('File "' + dst + '" created.');

        // do the next file
        callback();

      }, function(error) {
        callback(error);
      });

    });
  }


  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('ramlprerender', 'Convert RAML to JSON, validating, normalizing, and converting markdown to HTML.', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
      /**
       * If non null then pretty print output json
       */
      prettyPrint: null,
      /**
       * When false skip tv4 schema validation
       */
      validate: true
    });
    // raml parser uses callbacks so we are an async task
    var done = this.async();
    var that = this;

    grunt.util.async.forEachSeries(this.files, function (f, callback) {

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
      processOneRamlFile(src[0], f.dest, options, callback);

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
