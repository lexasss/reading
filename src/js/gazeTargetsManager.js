// Requires:
//      GazeTargets

(function (app) { 'use strict';

    // Initializes and sets callbacks for the GazeTargets global object
    // Constructor arguments:
    //      callbacks: {
    //          trackingStarted ()      - triggers when the tracking starts
    //          trackingStopped ()      - triggers when the tracking ends
    //          wordFocused (word)      - triggers when a word becomes focused
    //                  word: the word DOM object 
    //          wordLeft (word)         - triggers when gaze leaves a word
    //                  word: the word DOM object 
    //      }
    function GazeTargetsManager(callbacks) {

        GazeTargets.init({
            etudPanel: {
               show: false
            },
            pointer: {
                show: false
            },
            targets: [
                {
                    selector: '.word',
                    selection: {
                        type: GazeTargets.selection.types.none
                    },
                    mapping: {
                        className: ''
                    }
                }
            ],
            mapping: {
                type: GazeTargets.mapping.types.reading,  
                source: GazeTargets.mapping.sources.fixations,
                readingModel: GazeTargets.mapping.readingModel.campbell,
                expansion: 30,
                reading: {
                    maxSaccadeLength: 250,
                    maxSaccadeAngleRatio: 0.7,
                    fixedText: true
                }
            }
        }, {
            state: function (state) {
                if (state.isTracking) {
                    if (callbacks.trackingStarted)
                        callbacks.trackingStarted();
                }
                else if (state.isStopped) {
                    if (callbacks.trackingStopped)
                        callbacks.trackingStopped();
                }

                if (callbacks.updateControls) {
                    callbacks.updateControls( state );
                }
            },

            target: function (event, target) {
                if (event === 'focused') {
                    if (callbacks.wordFocused)
                        callbacks.wordFocused( target );
                }
                else if (event === 'left') {
                    if (callbacks.wordLeft)
                        callbacks.wordLeft( target );
                }
            },

            fixation: callbacks.fixation
        });
    }

    app.GazeTargetsManager = GazeTargetsManager;
    
})( this.Reading || module.exports );
