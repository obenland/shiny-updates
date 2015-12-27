module.exports = function(grunt) {

	grunt.initConfig({
		qunit: {
			files: ['tests/**/*.html']
		},
		jshint: {
			files: [
				'Gruntfile.js',
				'js/**/*.js',
				'tests/**/*.js',
				'!tests/vendor/**/*js'
			],
			options: {
				// options here to override JSHint defaults
				globals: {
					jQuery: true,
					console: true,
					module: true,
					document: true
				}
			}
		},
		watch: {
			files: ['<%= jshint.files %>'],
			tasks: ['jshint', 'qunit']
		},
		jscs: {
			src: 'js/**/*.js',
				options: {
					config: '.jscsrc',
					verbose: true,
					preset: 'wordpress'
				}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-qunit');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks( 'grunt-jscs' );

	grunt.registerTask('default', ['jshint', 'jscs', 'qunit']);

};
