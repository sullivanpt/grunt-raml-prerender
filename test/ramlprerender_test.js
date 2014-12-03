'use strict';

var grunt = require('grunt');

/*
  ======== A Handy Little Nodeunit Reference ========
  https://github.com/caolan/nodeunit

  Test methods:
    test.expect(numAssertions)
    test.done()
  Test assertions:
    test.ok(value, [message])
    test.equal(actual, expected, [message])
    test.notEqual(actual, expected, [message])
    test.deepEqual(actual, expected, [message])
    test.notDeepEqual(actual, expected, [message])
    test.strictEqual(actual, expected, [message])
    test.notStrictEqual(actual, expected, [message])
    test.throws(block, [error], [message])
    test.doesNotThrow(block, [error], [message])
    test.ifError(value)
*/

exports.ramlprerender = {
  setUp: function(done) {
    // setup here if necessary
    done();
  },
  default_options: function(test) {
    test.expect(1);

    // note: these tests are flawed because they test string equality not object equality
    var actual = grunt.file.read('tmp/sample1/ex-section.json');
    var expected = grunt.util.normalizelf(grunt.file.read('test/expected/ex-section.json'));
    test.equal(actual, expected, 'should describe what the default behavior is.');

    test.done();
  },
  format_options: function(test) {
    test.expect(1);

    var actual = grunt.file.read('tmp/format_options/simple.json');
    var expected = grunt.util.normalizelf(grunt.file.read('test/expected/format_options.json'));
    test.equal(actual, expected, 'should describe what the default behavior is.');

    test.done();
  },
  yamlschema_options: function(test) {
    test.expect(1);

    var actual = grunt.file.read('tmp/yamlschema.json');
    var expected = grunt.util.normalizelf(grunt.file.read('test/expected/yamlschema.json'));
    test.equal(actual, expected, 'should describe what the default behavior is.');

    test.done();
  }
};
