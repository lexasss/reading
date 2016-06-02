// Reading model 2

if (!this.Reading) {
    module.exports.Logger = require('../utils/logger.js').Logger;
    module.exports.Line = require('./line.js').Line;
    module.exports.Geometry = require('./geometry.js').Geometry;
    module.exports.Fixations = require('./fixations.js').Fixations;
    module.exports.Zone = require('./zone.js').Zone;
}

(function (app) { 'use strict';

    var Model2 = {

        // Initializes the model
        // Arguments:
        //      settings
        init: function (settings) {
            settings = settings || {};

            _settings = {
            };

            app.Line.init();

            _geometry = app.Geometry;
            _geometry.init( true );

            _fixationDetector = app.Fixations;
            _fixationDetector.init();

            _zone = app.Zone;

            _logger = app.Logger.forModule( 'Model2' );
        },

        feedFixation: function (fixation) {
            if (!fixation) {
                lastFixation = null;
                return;
            }

            _log = _logger.start( '--- fix ---' );
            _log.push( fixation.toString() );

            // new line searcfh disabled -->
            //var newLine = classifySaccadeZone( fixation );
            var guessedZone = scoreReading === 0 && fixation.saccade.x < 0 ?
                _zone.nonreading :
                _zone.match( fixation.saccade );

            fixation.saccade.zone = guessedZone;
            updateScores( guessedZone );
            // --> replacement

            var switched = updateMode();

            if (isReadingMode) {
                var switchedToReading = switched.toReading;
                var fix = switched.toReading ? getFirstReadingFixation( fixation ) : fixation;

                _log.push( 'Mapping' );
                while (fix) {
                    if (switched.toReading) {
                        _log.push( '' );
                        _log.push( fix.toString() );
                    }
                    lastMapped = map( fix, switchedToReading );
                    switchedToReading = false;

                    if (fix === fixation) {
                        break;
                    }

                    fix = fix.next;
                }
                _log.levelDown();
            }
            else {
                lastMapped = null;
            }

            lastFixation = fixation;

            _logger.end( _log );

            return lastMapped ? lastMapped.dom : null;
        },

        feed: function (targets, x, y) {
            var result = null;
            createGeometry( targets );

            var newFixation = _fixationDetector.feed( x, y );
            if (newFixation) {
                result = this.feedFixation( newFixation );
            }
            else {
                lastFixation = null;
            }

            return result;
        },

        reset: function (targets) {
            _geometry.reset();
            _fixationDetector.reset();
            _zone.reset();
            //newLineDetector.reset();
            _linePredictor.reset();

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

        callbacks: function (callbacks) {
            if (!callbacks) {
                return _callbacks;
            }
            else {
                _callbacks.onMapped = callbacks.onMapped;
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
    var _settings;

    var _geometry;
    var _fixationDetector;
    var _zone;
    //var newLineDetector;
    var _linePredictor;

    var isReadingMode;
    var scoreReading;
    var scoreNonReading;

    var offset;
    var currentLine;
    var lastMapped;
    var lastFixation;

    var _logger;
    var _log;

    var _callbacks = {
        onMapped: null
    };

    function createGeometry (targets) {
        var geomModel = _geometry.create( targets );
        if (geomModel) {
            _zone.init({
                progressiveLeft: _settings.progressiveLeft,
                progressiveRight: _settings.progressiveRight,
                readingMarginY: _settings.readingZoneMarginY,
                neutralMarginY: _settings.neutralZoneMarginY,
                slope: _settings.slope
            }, geomModel);
            // newLineDetector.init({
            //     minMarginY: 0.3,
            //     maxMarginY: 1.3,
            //     slope: _settings.slope
            // }, geomModel);
            _linePredictor.init( geomModel, _settings.linePredictor );
        }
    }

    function updateScores (guessedZone) {
        switch (guessedZone) {
            case _zone.reading:
                _log.push( `zone ${guessedZone}: reading` );
                scoreReading++;
                scoreNonReading -= _settings.forgettingFactor;
                break;
            case _zone.neutral:
                _log.push( `zone ${guessedZone}: neutral` );
                //scoreNonReading++;
                break;
            default:
                _log.push( `zone ${guessedZone}: nonreading` );
                scoreNonReading = _settings.nonreadingThreshold;
                scoreReading = 0;
        }

        scoreReading = scoreReading < _settings.readingThreshold ? scoreReading : _settings.readingThreshold;
        scoreReading = scoreReading > 0 ? scoreReading : 0;
        scoreNonReading = scoreNonReading < _settings.nonreadingThreshold ? scoreNonReading : _settings.nonreadingThreshold;
        scoreNonReading = scoreNonReading > 0 ? scoreNonReading : 0;
    }

    function updateMode() {
        var result = {
            toReading: false,
            toNonReading: false
        };

        if (!isReadingMode && scoreReading === _settings.readingThreshold) {
            changeMode(true);
            result.toReading = true;
        }
        else if (isReadingMode && scoreNonReading === _settings.nonreadingThreshold) {
            changeMode(false);
            result.toNonReading = true;
        }

        return result;
    }

    function changeMode(toReading) {
        _log.push( 'change Mode', toReading );
        isReadingMode = toReading;
    }

    function updateOffset( fixation, line ) {
        if (isReadingMode && line) {
            offset = line.center.y - fixation.y;
            _log.push( 'offset', offset );
        }
    }

    function map(fixation, isSwitchedToReading) {

        currentLine = _linePredictor.get( isSwitchedToReading, fixation, currentLine, offset );

        if (isReadingMode && (isSwitchedToReading || fixation.saccade.zone === _zone.reading)) {
            updateOffset( fixation, currentLine );
        }

        var mapped = mapToWord( fixation, currentLine ); // , isSwitchedToReading ?

        if (mapped) {
            var outlierFix = searchOutlier( fixation, mapped.line.index );
            if (outlierFix) {
                _logger.log( 'outlier fixation is backtracked: line #', mapped.line.index );
                mapToWord( outlierFix, mapped.line, true );
            }
        }
        
        return mapped;
    }

    function mapToWord(fixation, line, skipFix) {

        var log = _logger.start( 'MAP' );

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

        if (result && _callbacks.onMapped) {
            _callbacks.onMapped( fixation );
        }
        
        log.push('[d=', Math.floor( minDist ), ']', result ? result.line.index + ',' + result.index : '' );
        _logger.end( log );

        return result;
    }

    /*function backtrackFixations( currentFixation, line ) {
        _logger.log( '------ backtrack ------' );    
        var isReadingZone = true;
        var fixation = currentFixation.previous;
        while (fixation && !fixation.saccade.newLine) {
            if (fixation.saccade.zone === _zone.nonreading) {
                fixation.word = mapToWord( fixation, line, true );
                break;
            }
            if (!isReadingZone && fixation.saccade.zone !== _zone.reading) {
                break;
            }
            fixation.word = mapToWord( fixation, line );
            isReadingZone = fixation.saccade.zone === _zone.reading;
            fixation = fixation.previous;
        }
        _logger.log( '------ ///////// ------' );
    }*/

    function getFirstReadingFixation( currentFixation ) {
        var log = _logger.start( '------ backtrack ------' );
        var result = null;
        var isReadingZone = true;
        var fixation = currentFixation.previous;
        while (fixation && !fixation.saccade.newLine) {
            if (fixation.saccade.zone === _zone.nonreading) {
                result = isReadingZone ? fixation : fixation.next;
                log.push( '--, finish' );
                break;
            }
            if (!isReadingZone && fixation.saccade.zone !== _zone.reading) {
                result = fixation.next;
                log.push( '++, finish' );
                break;
            }
            result = fixation;
            isReadingZone = fixation.saccade.zone === _zone.reading;
            fixation = fixation.previous;
            log.push( '--' );
        }

        _logger.end( log );

        return result;
    }

    // outlier is the fixation that is the only fixation on another line
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
    app.Model2 = Model2;

})( this.Reading || module.exports );