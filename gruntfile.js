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
                dest: 'libs/gazeTargets/',
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
                    module: true,
                },
                esversion: 6,
                multistr: true
            }
        },
        
        eslint: {
            files: [
                'src/js/**/*.js'
            ],
            options: {
                configFile: './node_modules/eslint/conf/eslint.json',
                parserOptions: {
                    ecmaVersion: 6,
                    sourceType: 'script'
                },
                env: {
                    browser: true,
                    es6: true
                },
                rules: {
                    'comma-dangle': 'off'
                },
                globals: [
                    // browser
                    'document',
                    'console',
                    'window',
                    'setTimeout',
                    'clearTimeout',
                    'localStorage',
                    'arguments',
                    'Blob',
                    'Map',
                    'NodeFilter',

                    // Node
                    'module',
                    'require',

                    // libs
                    'Firebase',
                    'GazeTargets',
                    'shortcut',
                    'regression'
                ]
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
    grunt.loadNpmTasks('grunt-eslint');

    grunt.registerTask('rebuild', ['clean', 'jade', 'less', 'concat', 'copy', 'postcss']);
    grunt.registerTask('default', ['jade', 'less', 'concat', 'copy:img', 'postcss']);
    grunt.registerTask('updatelibs', ['copy:gazeTargets' ]);
    grunt.registerTask('copylibs', ['copy:libs' ]);
    grunt.registerTask('compile', ['jshint']);
    grunt.registerTask('compile2', ['eslint']);
};