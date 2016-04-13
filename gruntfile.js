module.exports = function(grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        
        clean: {
            build: {
                src: ['build/**'],
                filter: function(filepath) {
                    return filepath.split('\\').length > 1;
                }
            }
        },

        jade: {
            compile: {
                options: {
                    pretty: true,
                    data: {
                        debug: false
                    }
                },
                files: {
                    'build/index.html': ['src/views/*.jade']
                }
            },
        },

        less: {
            main: {
                files: {
                    'build/app.css': ['src/styles/*.less']
                }
            }
        },

        concat: {
            js: {
                src: ['src/js/namespace.js', 'src/js/**'], 
                dest: 'build/app.js'
            }
        },

        copy: {
            gazeTargets: {
                expand: true,
                cwd: '../../GazeTargets/build',
                src: '**',
                dest: 'libs/',
                flatten: false
            },
            libs: {
                expand: true,
                cwd: 'libs/',
                src: '**',
                dest: 'build/libs/',
                flatten: false
            },
            img: {
                expand: true,
                cwd: 'img/',
                src: '**',
                dest: 'build/img/',
                flatten: false
            }
        },

        postcss: {
            options: {
                map: false,
                processors: [
                    require('autoprefixer')({
                        browsers: ['last 2 versions']
                    })
                ]
            },
            css: {
                src: 'build/*.css'
            }
        },
        
        jshint: {
            files: [
                'src/js/**/*.js'
            ],
            options: {
                globals: {
                    console: true,
                    module: true
                },
                multistr: true
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-jade');
    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-postcss');
    grunt.loadNpmTasks('grunt-contrib-jshint');

    grunt.registerTask('default', ['clean', 'jade', 'less', 'concat', 'copy:libs', 'copy:img', 'postcss']);
    grunt.registerTask('updatelibs', ['copy:gazeTargets']);
    grunt.registerTask('compile', ['jshint']);
};