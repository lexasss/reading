// Reading model

(function (app) {

    'use strict';

    var Model = {

        // Initializes the model
        // Arguments:
        //  _settings
        //      forgettingFactor        (0.2) relative number 0.1..0.5
        //      readingThreshold        (3) number of fixations
        //      nonreadingThreshold     (2) number of fixations
        //      slope                   (0.15) 0.1..0.2
        //      progressiveLeft         (-1) em
        //      progressiveRight        (9) em
        //      readingZoneMarginY      (1) em
        //      neutralZoneMarginY      (2) em
        //      linePredictor:
        //          factors:
        //              currentLineDistReduce   - (0.8)     // fraction of the real distance
        //              guessMaxDist            - (3)
        //              currentLineDefDist      - (0.5)     // fraction of the lineSpace
        //              currentLineMaxDist      - (0.7)     // fraction of the lineSpace
        //              newLineSaccadeLength    - (-0.7)    // fraction of the max line width
        //  commons:
        //      fixedText               bool
        init: function (_settings, _commons) {
            _settings = _settings || {};
            _commons = _commons || {};

            settings = {
                forgettingFactor: _settings.forgettingFactor || 0.2,
                readingThreshold: _settings.readingThreshold || 3,
                nonreadingThreshold: _settings.nonreadingThreshold || 2,
                slope: _settings.slope || 0.15,
                progressiveLeft: _settings.progressiveLeft || -1,
                progressiveRight: _settings.progressiveRight || 9,
                readingZoneMarginY: _settings.readingZoneMarginY || 1,
                neutralZoneMarginY: _settings.neutralZoneMarginY || 2,
                linePredictor: _settings.linePredictor
            };

            if (_commons.fixedText === undefined) {
                _commons.fixedText = true;
            }

            geometry = app.Geometry;
            geometry.init( _commons.fixedText );

            fixationDetector = app.Fixations;
            fixationDetector.init();

            zone = app.Zone;
            newLineDetector = app.NewLineDetector;
            linePredictor = app.LinePredictor;

            log = (logger || app.Logger).moduleLogPrinter( 'Model' );
        },

        feedFixation: function (fixation) {
            if (!fixation) {
                lastFixation = null;
                return;
            }

            log( '-------' );
            log( fixation.toString() );

            // new line searcfh disabled -->
            //var newLine = classifySaccadeZone( fixation );
            var guessedZone = scoreReading === 0 && fixation.saccade.x < 0 ?
                zone.nonreading :
                zone.match( fixation.saccade );

            logger.push( 'zone', guessedZone );
            fixation.saccade.zone = guessedZone;
            updateScores( guessedZone );
            // --> replacement

            var switched = updateMode();

            if (isReadingMode) {

                var switchedToReading = switched.toReading;
                var fix = switched.toReading ? getFirstReadingFixation( fixation ) : fixation;

                while (fix) {
                    if (switched.toReading) {
                        logger.log( fix.toString() );
                    }
                    lastMapped = map( fix, switchedToReading);
                    switchedToReading = false;
                    fix = fix.next;
                }
            }
            else {
                lastMapped = null;
            }

            lastFixation = fixation;

            logger.closeBuffer();
        },

        feed: function (targets, data1, data2) {
            createGeometry(targets);

            var newFixation = fixationDetector.feed( data1, data2 );
            if (newFixation) {
                this.feedFixation( newFixation );
            }
            else {
                lastFixation = null;
            }

            return lastMapped ? lastMapped.dom : null;
        },

        reset: function (targets) {
            geometry.reset();
            fixationDetector.reset();
            zone.reset();
            newLineDetector.reset();
            linePredictor.reset();

            isReadingMode = false;
            scoreReading = 0;
            scoreNonReading = 0;
            
            offset = 0;
            currentLine = null;
            lastMapped = null;
            lastFixation = null;

            if (targets) {
                createGeometry( targets );
            }
        },

        callbacks: function (_callbacks) {
            if (!_callbacks) {
                return callbacks;
            }
            else {
                callbacks.onMapped = _callbacks.onMapped;
            }
        },

        currentWord: function () {
            return lastMapped;
        },

        mappedFix: function () {
            return lastFixation;
        }
    };

    // internal
    var settings;

    var geometry;
    var fixationDetector;
    var zone;
    var newLineDetector;
    var linePredictor;

    var isReadingMode;
    var scoreReading;
    var scoreNonReading;

    var offset;
    var currentLine;
    var lastMapped;
    var lastFixation;

    var log;
    var callbacks = {
        onMapped: null
    };

    function createGeometry(targets) {
        var geomModel = geometry.create(targets);
        if (geomModel) {
            zone.init({
                progressiveLeft: settings.progressiveLeft,
                progressiveRight: settings.progressiveRight,
                readingMarginY: settings.readingZoneMarginY,
                neutralMarginY: settings.neutralZoneMarginY,
                slope: settings.slope
            }, geomModel);
            newLineDetector.init({
                minMarginY: 0.3,
                maxMarginY: 1.3,
                slope: settings.slope
            }, geomModel);
            linePredictor.init( geomModel, settings.linePredictor );
        }
    }

    function updateScores(guessedZone) {
        switch (guessedZone) {
            case zone.reading:
                logger.push('in reading zone');
                scoreReading++;
                scoreNonReading -= settings.forgettingFactor;
                break;
            case zone.neutral:
                logger.push('in neutral zone');
                //scoreNonReading++;
                break;
            default:
                logger.push('in nonreading zone');
                scoreNonReading = settings.nonreadingThreshold;
                scoreReading = 0;
        }

        scoreReading = scoreReading < settings.readingThreshold ? scoreReading : settings.readingThreshold;
        scoreReading = scoreReading > 0 ? scoreReading : 0;
        scoreNonReading = scoreNonReading < settings.nonreadingThreshold ? scoreNonReading : settings.nonreadingThreshold;
        scoreNonReading = scoreNonReading > 0 ? scoreNonReading : 0;
    }

    function updateMode() {
        var result = {
            toReading: false,
            toNonReading: false
        };

        if (!isReadingMode && scoreReading === settings.readingThreshold) {
            changeMode(true);
            result.toReading = true;
        }
        else if (isReadingMode && scoreNonReading === settings.nonreadingThreshold) {
            changeMode(false);
            result.toNonReading = true;
        }

        return result;
    }

    function changeMode(toReading) {
        logger.push('change Mode', toReading);
        isReadingMode = toReading;
    }

    function updateOffset( fixation, line ) {
        if (isReadingMode && line) {
            offset = line.center.y - fixation.y;
            logger.push('offset', offset);
        }
    }

    function map(fixation, isSwitchedToReading) {

        currentLine = linePredictor.get( isSwitchedToReading, fixation, currentLine, offset );

        if (isReadingMode && (isSwitchedToReading || fixation.saccade.zone === zone.reading)) {
            updateOffset( fixation, currentLine );
        }

        var mapped = mapToWord( fixation, currentLine ); // , isSwitchedToReading ?

        if (mapped) {
            var outlierFix = searchOutlier( fixation, mapped.line.index );
            if (outlierFix) {
                logger.log('outlier fixation is backtracked: line #', mapped.line.index);
                mapToWord( outlierFix, mapped.line, true );
            }
        }
        
        return mapped;
    }

    function mapToWord(fixation, line, skipFix) {

        logger.closeBuffer();
        logger.push('[MAP]');
        // if (!isReadingMode) {
        //     logger.log('    none');
        //     return null;
        // }

        if (!line) {
            //logger.log(logger.Type.error, '    ???');
            return null;
        }

        if (isReadingMode && !skipFix) { // && fixation.saccade.zone === zone.reading ?
            line.addFixation( fixation );
        }
        
        var x = fixation.x;
        var result = null;
        var minDist = Number.MAX_VALUE;

        var words = line.words;
        for (var i = 0; i < words.length; ++i) {
            var word = words[i];
            var rect = word.rect;
                
            var dist = x < rect.left ? (rect.left - x) : (x > rect.right ? x - rect.right : 0);
            if (dist < minDist) {
                result = word;
                minDist = dist;
                if (dist === 0) {
                    break;
                }
            }
        }

        fixation.word = result;

        if (result && callbacks.onMapped) {
            callbacks.onMapped( fixation );
        }
        
        logger.push('[d=', Math.floor( minDist ), ']', result ? result.line.index + ',' + result.index : '' );
        return result;
    }

    function backtrackFixations( currentFixation, line ) {
        logger.log( '------ backtrack ------' );    
        var isReadingZone = true;
        var fixation = currentFixation.previous;
        while (fixation && !fixation.saccade.newLine) {
            if (fixation.saccade.zone === zone.nonreading) {
                fixation.word = mapToWord( fixation, line, true );
                break;
            }
            if (!isReadingZone && fixation.saccade.zone !== zone.reading) {
                break;
            }
            fixation.word = mapToWord( fixation, line );
            isReadingZone = fixation.saccade.zone === zone.reading;
            fixation = fixation.previous;
        }
        logger.log( '------ ///////// ------' );
    }

    function getFirstReadingFixation( currentFixation ) {
        logger.log( '------ backtrack ------' );
        var result = null;
        var isReadingZone = true;
        var fixation = currentFixation.previous;
        while (fixation && !fixation.saccade.newLine) {
            if (fixation.saccade.zone === zone.nonreading) {
                result = isReadingZone ? fixation : fixation.next;
                break;
            }
            if (!isReadingZone && fixation.saccade.zone !== zone.reading) {
                result = fixation.next;
                break;
            }
            result = fixation;
            isReadingZone = fixation.saccade.zone === zone.reading;
            fixation = fixation.previous;
        }
        logger.log( '------ ///////// ------' );

        return result;
    }

    function searchOutlier( fixation, lineIndex ) {
        var candidate = null;
        var pattern = [true, false, true];
        var matched = 0;
        var index = 0;

        while (index < 3 && fixation) {
            if (!fixation.word) {
                break;
            }

            var isOnCurrentLine = lineIndex === fixation.word.line.index;
            if (isOnCurrentLine === pattern[ index ]) {
                ++matched;
            }
            if (index === 1) {
                candidate = fixation;
            }

            fixation = fixation.previous;
            ++index;
        }
                
        return matched === pattern.length ? candidate : null;
    }
    
    // Publication
    app.Model = Model;

})( this.Reading || module.exports );