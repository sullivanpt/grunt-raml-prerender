# grunt-raml-prerender

> Convert RAML to JSON, validating, normalizing, and converting markdown to HTML.

**Note** Uses [raml-1-parser](https://github.com/raml-org/raml-js-parser-2). To use the legacy [raml-parser](https://github.com/raml-org/raml-js-parser) require
v0.1.x.

## Getting Started
This plugin requires Grunt `~0.4.5`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-raml-prerender --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-raml-prerender');
```

## The "ramlprerender" task

### Overview
In your project's Gruntfile, add a section named `ramlprerender` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
  ramlprerender: {
    options: {
      // Task-specific options go here.
    },
    your_target: {
      // Target-specific file lists and/or options go here.
    },
  },
});
```

### Options

#### options.prettyPrint
Type: `Number`
Default value: null

A numeric value that is used as the indent value when pretty printing the JSON output. If not provided then the output is not pretty printed.

#### options.validate
Type: `Boolean`
Default value: `true`

If false the extra schema validation is skipped.

### Usage Examples

#### Default Options
In this example, the default options are used to do something with whatever. So if the `testing` file has the content `Testing` and the `123` file had the content `1 2 3`, the generated result would be `Testing, 1 2 3.`

```js
grunt.initConfig({
  ramlprerender: {
    options: {},
    files: [
      {
        expand: true,     // Enable dynamic expansion.
        src: ['*.raml'], // Actual pattern(s) to match.
        dest: 'tmp/',   // Destination path prefix.
        ext: '.json'   // Dest filepaths will have this extension.
      }
    ]
  },
});
```

#### Custom Options
In this example, custom options are used to do something else with whatever else. So if the `testing` file has the content `Testing` and the `123` file had the content `1 2 3`, the generated result in this case would be `Testing: 1 2 3 !!!`

```js
grunt.initConfig({
  ramlprerender: {
    options: {
      prettyPrint: 2,
      validate: false,
    },
    files: [
      {
        expand: true,     // Enable dynamic expansion.
        src: ['src/**/*.raml'], // Actual pattern(s) to match.
        dest: 'tmp/',   // Destination path prefix.
        ext: '.json'   // Dest filepaths will have this extension.
      }
    ]
  },
});
```

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History
_(Nothing yet)_
