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
			options: grunt.file.readJSON('.jshintrc')
		},
		watch: {
			files: ['<%= jshint.files %>'],
			tasks: ['jshint', 'jscs', 'qunit']
		},
		jscs: {
			src: [
				'js/**/*.js',
				'tests/**/*.js',
				'!tests/vendor/**/*js'
			],
			options: {
				verbose: true,
				preset: 'wordpress'
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-qunit');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-jscs');

	grunt.registerTask('default', ['jshint', 'jscs', 'qunit']);

};
