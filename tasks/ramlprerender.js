/*
 * grunt-raml-prerender
 * https://github.com/sullivanpt/grunt-raml-prerender
 *
 * Copyright (c) 2014 Patrick Sullivan
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {
  var raml = require("raml-1-parser"); // old 0.8 version was var raml = require('raml-parser');
  var _ = require('lodash');
  var showdown = require('showdown');
  var pd = require('pretty-data').pd; // npm equivalent of vkiryukhin/vkBeautify
  var yaml = require('js-yaml');
  var omitDeep = require('omit-deep');

  // raml schema validation from https://github.com/sullivanpt/grunt-raml-init
  function validateRaml(file, next) {
    next(); // raml4j is broken
  }

  // helper to get rid of undesired properties like structuredExample, structuredValue, etc.
  function omitUndesired (obj) {
    return omitDeep(obj, ['structuredExample', 'structuredValue']);
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

  // helper to inherit properties from base classes. type is mutated. assumes base is deeply cloned
  function inheritProperties (type, base, data) {
    if (!base) {
      return;
    }
    if (base.properties) {
      if (!type.properties) {
        type.properties = base.properties;
      } else {
        _.defaults(type.properties, base.properties); // inherit top level properties from base class, allow override
      }
    }
    inheritProperties(type, _.cloneDeep(data.types[base.type[0]]), data); // only support single inheritence
  }

  // helper to convert types
  // if format is not null it is used to beautify examples
  function convertType (type, format, data, converter) {
    var base, schema;
    if (['JSON', 'XML'].indexOf(type.typePropertyKind) !== -1 && !type.schema) {
      type.schema = type.type; // convert inline JSON and XML to RAML08 format
      delete type.type;
    }
    if (type.typePropertyKind === 'TYPE_EXPRESSION') {
      // expand global types into each point of usage
      base = _.cloneDeep(data.types[type.type[0]]); // only support single inheritence
      inheritProperties(type, base, data);
      _.defaults(type, base);
      base = null;
    }
    // TODO: consider supporting typePropertyKind 'INPLACE' (JSON in global type, object properties in type)
    if (type.properties) {
      convertProperties(type.properties, false, data, converter);
    }
    if (_.isArray(type.type)) {
      type.type = type.type.join(', '); // only support single inheritence, but show more types if present
    }
    if (type.items) {
      // type array will have an items field
      if (_.isArray(type.items)) {
        // if items is a type name or array of type names, normalize as a string
        type.items = type.items.join(', '); // only support single inheritence, but show more types if present
      }
      if (_.isString(type.items)) {
        // expand global types into each point of usage, converting items to in place type
        type.items = _.cloneDeep(data.types[type.items]); // only support single inheritence
        inheritProperties(type.items, type.items, data);
      }
      if (_.isObject(type.items)) {
        convertType(type.items, format, data, converter);
      }
    }
    if (type.description) {
      type.description = converter.makeHtml(type.description);
    }
    if (type.examples) {
      type.examples.forEach(function (example) {
        example.description = example.description && converter.makeHtml(example.description); // markdown for description
        example.value = format && beautify(format, example.value) || example.value;
      });
    }
    if (type.example && format) {
      type.example = beautify(format, type.example);
    }
    if (type.schema && format) {
      if (format === 'application/json') {
        schema = parseJsonSchema(type.schema);
        if (schema.description && !type.description) {
          type.description = schema.description && converter.makeHtml(schema.description); // markdown for description
          delete schema.description; // too much to see this twice
        }
        type.schema = JSON.stringify(schema);
      }
      type.schema = beautify(format, type.schema);
    }
  }

  // helper to convert type properties
  function convertProperties (properties, isUri, data, converter) {
    _.forOwn(properties || {}, function (propertyValue, propertyKey) {
      if (isUri) {
        propertyValue.uri = true; // so we can use same template
      }
      convertType(propertyValue, null, data, converter);
    });
  }

  // helper to convert a request or response body
  function convertBodyFn (data, converter) {
    return function (formatValue, format) {
      // note: we assume body -> type -> example|schema, but body -> example|schema is also technically valid RAML
      convertType(formatValue, format, data, converter);
    };
  }

  // converts markdown, xml, and json to formatted html
  function formatForDisplay(data) {
    var converter = new showdown.Converter();

    // convert global types to a map
    // but don't convertProperties them yet as that will happen when they get pulled in
    data.types = _.reduce(data.types, function (accumulator, value) {
      var key = _.keys(value)[0]; // just keep the first one
      accumulator[key] = value[key];
      return accumulator;
    }, {});

    convertProperties(data.baseUriParameters, true, data, converter);
    (data.documentation || []).forEach(function (doc) {
      doc.content = converter.makeHtml(doc.content);
    });
    (data.resources || []).forEach(function (resource) {
      resource.description = resource.description && converter.makeHtml(resource.description);
      convertProperties(resource.uriParameters, true, data, converter);
      (resource.methods || []).forEach(function (method) {
        method.description = method.description && converter.makeHtml(method.description);
        convertProperties(method.queryParameters, false, data, converter);

        _.forOwn(method.body || {}, convertBodyFn(data, converter));

        _.forOwn(method.responses || {}, function(response) {
          if (response) {
            response.description = response.description && converter.makeHtml(response.description);
            _.forOwn(response.body || {}, convertBodyFn(data, converter));
          }
        });
      });
    });

    // all types have been pulled inline
    delete data.types;

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

      raml.loadApi(src).then( function(data) {

        grunt.log.debug('Loaded "' + src, data);

        // stop on first validation error
        var firstError = data.errors().find(function (error) { return !error.isWarning; });
        if (firstError && options.validate) {
          return callback('Error ' + data.RAMLVersion() + ' (' + firstError.path + ':' + firstError.range.start.line + ') ' + firstError.message);
        }

        // show errors and warnings
        data.errors().forEach(function (error) {
          grunt.log.warn((error.isWarning ? 'Warning ' : 'Error ') + data.RAMLVersion() + ' (' + error.path + ':' + error.range.start.line + ') ' + error.message);
        });

        // convert to legacy 'raml-parser' format
        data = data.toJSON({
          rootNodeDetails: false,
          serializeMetadata: false
        });

        // pre-process the data before we save it so there is less to do when we want to render it
        try {
          // TODO: error on unsupported features like: default mediaType
          data = omitUndesired(data);
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
        return done(false);
      }
      grunt.log.writeln('All done.');
      return done();
    });
  });

};
