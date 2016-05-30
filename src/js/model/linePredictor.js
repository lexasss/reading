// Reading model: line predictor

(function (root) {

    'use strict';

    var LinePredictor = {

        init: function(_geomModel, _settings) {
            geomModel = _geomModel;

            _settings = _settings || {};
            _settings.factors = _settings.factors || {};

            currentLineDistReduce = _settings.factors.currentLineDistReduce || 0.8;

            guessMaxDist = (_settings.factors.guessMaxDist || 3) * geomModel.lineSpacing;
            currentLineDefDist = (_settings.factors.currentLineDefDist || 0.48) * geomModel.lineSpacing;
            currentLineMaxDist = (_settings.factors.currentLineMaxDist || 0.85) * geomModel.lineSpacing;
            newLineSaccadeLengthFraction = _settings.factors.newLineSaccadeLength || -0.7;

            logger = root.GazeTargets.Logger;
            
            logger.closeBuffer();
            logger.push('[LP - params]');
            logger.push('\nguessMaxDist: ', guessMaxDist);
            logger.push('\ncurrentLineDefDist: ', currentLineDefDist);
            logger.push('\ncurrentLineMaxDist: ', currentLineMaxDist);
            logger.push('\nnewLineSaccadeLengthFraction: ', newLineSaccadeLengthFraction);
            logger.push('\ngeomModel.lineSpacing: ', geomModel.lineSpacing);
            logger.closeBuffer();
        },

        get: function(isEnteredReadingMode, currentFixation, currentLine, offset) {
            var result = null;
            
            logger.closeBuffer();
            logger.push('[LP]');

            if (currentFixation.previous && currentFixation.previous.saccade.newLine && !currentLine.fitEq) {
                result = checkAgainstCurrentLine( currentFixation, offset );
            }
            else if (isEnteredReadingMode || currentFixation) {
                result = guessCurrentLine( currentFixation, currentLine, offset );
            }

            if (!result) {
                result = getClosestLine( currentFixation, offset );
            }

            if (result && (!currentLine || result.index !== currentLine.index)) {
                currentFixation.saccade.newLine = true;
            }

            logger.closeBuffer();
            return result;
        },

        /*
        getAlways: function(state, newLine, currentFixation, currentLine, offset) {
            var result = null;

            logger.closeBuffer();
            logger.push('[LP]');

            if (newLine) {
                result = newLine;
                logger.push('current line is #', newLine.index);
            }
            else if (!state.isReading) {
                result = getClosestLine( currentFixation, offset );
            }
            else if (state.isReading && state.isSwitched) {
                result = guessCurrentLine( currentFixation, currentLine, offset );
            }
            // else if (switched.toNonReading) {
            //     logger.log('    current line reset');
            //     return null;
            // }
            else if (currentFixation.previous && currentFixation.previous.saccade.newLine) {
                    //currentFixation.previous.word && 
                    // currentFixation.previous.word.line.fixations.length < 3) {
                result = checkAgainstCurrentLine( currentFixation, offset );
            }
            else if (currentFixation) {
                result = guessCurrentLine( currentFixation, currentLine, offset );
            }

            if (!result) {
                result = getClosestLine( currentFixation, offset );
            }

            if (result && (!currentLine || result.index !== currentLine.index)) {
                currentFixation.saccade.newLine = true;
            }

            return result;
        },*/

        reset: function() {
            geomModel = null;
        }
    };

    // internal
    var geomModel;
    var logger;

    var currentLineDistReduce;
    var guessMaxDist;
    var currentLineMaxDist;
    var currentLineDefDist;
    var newLineSaccadeLengthFraction;

    // TODO: penalize all lines but the current one - the current lline should get priority
    function guessCurrentLine(fixation, currentLine, offset) {

        var result = null;
        var perfectLineMatch = false;
        var minDiff = Number.MAX_VALUE;
        var minDiffAbs = Number.MAX_VALUE;
        var currentLineIndex = currentLine ? currentLine.index : -1;
        var x = fixation.x;
        var y = fixation.y;

        var lines = geomModel.lines;
        for (var i = 0; i < lines.length; ++i) {
            var line = lines[i];
            var diff = line.fit( x, y );
            var diffAbs = Math.abs( diff );
            if (currentLineIndex === line.index) {      // current line has priority:
                if (diffAbs < currentLineDefDist) {     // it must be followed in case the fixation is close
                    result = line;
                    minDiff = diff;
                    minDiffAbs = diffAbs;
                    perfectLineMatch = true;
                    logger.push( 'following the current line #', currentLineIndex );
                    break;
                }
                else if (diff != Number.MAX_VALUE) {                                  // if the distance exceeds the threshold, then 
                    diff *= currentLineDistReduce;      // lets artificially reduce the distance
                    diffAbs = Math.abs( diff );
                    logger.push( '>>', Math.floor( diff ) );
                }
            }
            if (diffAbs < minDiffAbs) {
                result = line;
                minDiffAbs = diffAbs;
                minDiff = diff;
            }
        }

        if (!perfectLineMatch) {    // only for printing the minDiff out
            logger.push( 'dist =', minDiff != Number.MAX_VALUE ? Math.floor( minDiff ) : 'N/A' );
        }

        // threshold must depend on the saccade type: long regressive is most likely belong to a new line, 
        // thus compare the diff against reduced threshold from the lower bound

        var newLineSaccadeLength = currentLine ? currentLine.width() * newLineSaccadeLengthFraction : 100000;
        var threshold = fixation.saccade.x < newLineSaccadeLength ? currentLineDefDist : currentLineMaxDist;
        logger.push( 'threshold:', threshold );
        
        if (minDiffAbs < threshold ) {
            if (!perfectLineMatch) {
                logger.push( 'most likely:', result ? result.index : '---' );
            }
        }
        else if (currentLine) {     // maybe, this is a quick jump to some other line?
            logger.push( '\nchecking possible jump...' );
            var lineIndex = -1;
            if (minDiff != Number.MAX_VALUE) { 
                lineIndex = currentLineIndex + Math.round( minDiff / geomModel.lineSpacing );
                logger.push( 'supposed line:', lineIndex );
            }

            if (0 <= lineIndex && lineIndex < lines.length) {

                var acceptSupposedLine = true;

                // check which one fits better
                var supposedLine = lines[ lineIndex ];
                if (supposedLine.fitEq) {   // this line was visited already, lets check which line, the supposed or the current is closer
                    var supposedLineDiff = Math.abs( supposedLine.fit( x, y ) );
                    logger.push( ' >> dist =', Math.floor( supposedLineDiff ) );
                    if (supposedLineDiff >= minDiffAbs) {
                        acceptSupposedLine = false;
                        logger.push( ' >> keep the line #', result.index );
                    }
                }
                else if (supposedLine.index === currentLineIndex + 1) { // maybe, we should stay on the current line?
                    // the supposed line is next line
                    logger.push( 'looks like a new line... check it!' );

                    // first, lets check the average fitting of the fixation to the current line, 
                    // but taking into account only lines visited already
                    var avgOffset = 0;
                    var count = 0;
                    for (var li = 0; li < lines.length; ++li) {
                        var line = lines[ li ];
                        if (li === currentLineIndex || !line.fitEq) {
                            continue;
                        }

                        avgOffset += line.fit( x, y ) - (currentLineIndex - li) * geomModel.lineSpacing;
                        count++;
                    }

                    if (count) {
                        avgOffset /= count;
                        logger.push( 'the average fitting offset is ', avgOffset );
                        if (avgOffset < threshold) {
                            acceptSupposedLine = false;
                            result = currentLine;
                            logger.push( ' >> stay on line #', result.index );
                        }
                        else {
                            // accept the supposed line
                        }
                    }
                    else {
                        // only one line was discovered so far - the current line
                        // so, just accept the supposed line
                        logger.push( 'nothing to compare with...' );
                    }
                }
                else {
                    logger.push( 'just accept it' );
                    // what can we do here?
                    // just accepting the supposed line
                }

                if (acceptSupposedLine) {
                    result = supposedLine;
                    logger.push( 'jump to supposed line #', result.index );
                }
            }
            else {
                result = null;
                logger.push( 'nothing to suggest' );
            }
        }
        else {
            result = null;
        }

        return result;
    }

    function checkAgainstCurrentLine( currentFixation, offset ) {
        var minDist = Number.MAX_VALUE;
        var dist;
        var currentLine = null;
        var previousLine = null;
        var closestFixation = null;

        var fixation = currentFixation.previous;
        while (fixation) {

            if (fixation.word) {
                var line = fixation.word.line;
                if (!currentLine) {
                    currentLine = line;
                }
                if (line.index != currentLine.index) {
                    if (currentLine.index - line.index === 1) {
                        previousLine = line;
                    }
                    break;
                }
                dist = Math.abs( currentFixation.y + offset - currentLine.center.y );
                if (dist < minDist) {
                    minDist = dist;
                    closestFixation = fixation;
                }
            }

            fixation = fixation.previous;
        }

        logger.push('dist :', minDist);

        var result = closestFixation && (minDist < currentLineMaxDist) ? currentLine : null;
        logger.push('follows the current line:', result ? 'yes' : 'no');

        // If recognized as not following but still not too far and recently jumped from the previous line,
        // then check whether it fits this previous line
        if (!result && previousLine && minDist < geomModel.lineSpacing) {
            var diff = Math.abs( previousLine.fit( currentFixation.x, currentFixation.y ) );
            if (diff < currentLineMaxDist) {
                result = previousLine;
                logger.push('back to the prev line');
            }
            else {
                result = currentLine;
                logger.push('still better fit than to the previous line');
            }
        }

        return result;
    }

    /*function guessNearestLineFromPreviousFixations( currentFixation, offset ) {
        var minDist = Number.MAX_VALUE;
        var dist, closestFixation = null;

        var fixation = currentFixation.previous;
        while (fixation) {

            if (fixation.word) {
                dist = Math.abs( currentFixation.y + offset - fixation.word.line.top );
                if (dist < minDist) {
                    minDist = dist;
                    closestFixation = fixation;
                }
            }

            fixation = fixation.previous;
        }

        return closestFixation && (minDist < geomModel.lineSpacing / 2) ? closestFixation.word.line : null;
    }*/

    function getClosestLine( fixation, offset ) {

        var result = null;
        var minDist = Number.MAX_VALUE;
        var line, dist;

        logger.push('\nsearching the closest line given the offset',  offset);
        var lines = geomModel.lines;
        for (var i = 0; i < lines.length; ++i) {
            line = lines[i];
            dist = Math.abs( fixation.y + offset - line.center.y );
            logger.push('#' + i + '=' + dist);
            if (dist < minDist) {
                minDist = dist;
                result = line;
            }
        }

        logger.push('closest:',  result.index);
        return result;        
    }

    // Publication
    if (!root.GazeTargets) {
        root.GazeTargets = {};
    }

    if (!root.GazeTargets.Models) {
        root.GazeTargets.Models = {};
    }

    if (!root.GazeTargets.Models.Reading) {
        root.GazeTargets.Models.Reading = {};
    }

    root.GazeTargets.Models.Reading.LinePredictor = LinePredictor;

})(window);
