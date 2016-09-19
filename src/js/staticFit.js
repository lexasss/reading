// Requires:
//      regression.js
//      utils/logger

if (!this.Reading) {
    var regression = require('../../libs/regression.js');
    var logger = require('./utils/logger.js').Logger;
}

(function(app) {

    const MARGIN_X = 100;
    const MARGIN_Y = 180;
    const FIT_THESHOLD = 25;
    const SKIMMING_THRESHOLD_X = 500;
    const SKIMMING_THRESHOLD_Y = 40;
    const SCALE_DIFF_THRESHOLD = 0.9;
    const MAX_LINEAR_GRADIENT = 0.15;
    const LONG_SET_LENGTH_THRESHOLD = 3;

    const MIN_DURATION = 150; // ms
    const MAX_DIST = 40; // px

    const SET_TYPE = {
        LONG: 'long',
        SHORT: 'short',
        ANY: 'any'
    };

    let log;

    function settings (value) {
        if (!value) {
            return {
                marginX: MARGIN_X,
                marginY: MARGIN_Y,
                fitThreshold: FIT_THESHOLD,
                skimmigThresholdX: SKIMMING_THRESHOLD_X,
                skimmigThresholdY: SKIMMING_THRESHOLD_Y,
                scaleDiffThreshold: SCALE_DIFF_THRESHOLD,
                maxLinearGradient: MAX_LINEAR_GRADIENT,
                longSetLengthThreshold: LONG_SET_LENGTH_THRESHOLD,
                logging: (logger || app.Logger).enabled
            };
        }
        else {
            MARGIN_X = value.marginX !== undefined ? value.marginX : MARGIN_X;
            MARGIN_Y = value.marginY !== undefined ? value.marginY : MARGIN_Y;
            FIT_THESHOLD = value.fitThreshold !== undefined ? value.fitThreshold : FIT_THESHOLD;
            SKIMMING_THRESHOLD_X = value.skimmigThresholdX !== undefined ? value.skimmigThresholdX : SKIMMING_THRESHOLD_X;
            SKIMMING_THRESHOLD_Y = value.skimmigThresholdY !== undefined ? value.skimmigThresholdY : SKIMMING_THRESHOLD_Y;
            SCALE_DIFF_THRESHOLD = value.scaleDiffThreshold !== undefined ? value.scaleDiffThreshold : SCALE_DIFF_THRESHOLD;
            MAX_LINEAR_GRADIENT = value.maxLinearGradient !== undefined ? value.maxLinearGradient : MAX_LINEAR_GRADIENT;
            LONG_SET_LENGTH_THRESHOLD = value.longSetLengthThreshold !== undefined ? value.longSetLengthThreshold : LONG_SET_LENGTH_THRESHOLD;
            (logger || app.Logger).enabled = value.logging !== undefined ? value.logging : (logger || app.Logger).enabled;
        }
    }

    function map (data) {
        if (!data.fixations || !data.words) {
            return;
        }

        //log = (logger || app.Logger).forModule( 'StaticFit' ).log;
        log = (logger || app.Logger).moduleLogPrinter( 'StaticFit' );

        var text = getText( data.words );
        //var fixations = filterFixations( data.fixations, text.box );
        //var progressions = splitToProgressions( fixations );
        data.fixations = filterFixations( data.fixations, text.box );
        var progressions = splitToProgressions( data.fixations );
        var sets = mergeSets( progressions, text.lines.length );
        sets = dropShortFixations( sets, 1 );
        sortAndAlignLines( sets, text.lines );
        //assignFixationsToLines( sets );
        //log( 'Fixations distributed across lines', data.fixations );

        mapToWords( sets, text.lines );
        computeRegressions( data.fixations );
        removeTransitionsToNextLine( data.fixations, data.words );
    }

    function getText (words) {
        var lines = [];
        var box = {left: Number.MAX_VALUE, top: Number.MAX_VALUE, right: 0, bottom: 0};
        var currentY = Number.MIN_VALUE;
        var currentLine;

        var createNewLine = function (word) {
            currentLine = [ word ];
            lines.push( currentLine );
        };

        for (var i = 0; i < words.length; i += 1) {
            var word = words[i];
            word.id = i;
            if (word.x < box.left) { box.left = word.x;    }
            if (word.y < box.top) { box.top = word.y;    }
            if (word.x + word.width > box.right) { box.right = word.x + word.width;    }
            if (word.y + word.height > box.bottom) { box.bottom = word.y + word.height;    }

            if (word.y != currentY) {
                currentY = word.y;
                createNewLine( word );
            }
            else {
                currentLine.push( word );
            }
        }

        log( 'lines: ' + lines.length );

        return {
            box: box,
            lines: lines
        };
    }

    function filterFixations (fixations, textbox) {
        return joinShortFixatoins( removeFarFixations( fixations, textbox ) );
    }

    function removeFarFixations (fixations, textbox) {
        var result = [];

        for (var i = 0; i < fixations.length; i += 1) {
            var fix = fixations[i];
            fix.id = i;
            if (fix.x > textbox.left - MARGIN_X &&
                fix.x < textbox.right + MARGIN_X &&
                fix.y > textbox.top - MARGIN_Y &&
                fix.y < textbox.bottom + MARGIN_Y) {
                result.push( fix );
            }
        }

        return result;
    }

    function joinShortFixatoins (fixations) {
        const dist = (a, b) => Math.sqrt( Math.pow( a.x - b.x, 2 ) + Math.pow( a.y - b.y, 2 ) );
        const join = (a, b) => {
            let totalDuration = a.duration + b.duration;
            a.x = (a.x * a.duration + b.x * b.duration) / totalDuration;
            a.y = (a.y * a.duration + b.y * b.duration) / totalDuration;
            a.duration = totalDuration;
            a.merged = true;
        };
        const joinInteration = (fixes) => {
            const result = [];
            let prevFix, prevPrevFix;
            for (let i = 0; i < fixes.length; i += 1) {
                let fix = fixes[i];
                if (prevPrevFix && prevFix.duration < MIN_DURATION ) {
                    let distToPrev = dist( prevFix, prevPrevFix );
                    let distToNext = dist( prevFix, fix );
                    if (distToPrev < MAX_DIST || distToNext < MAX_DIST) {
                        if (distToNext < distToPrev) {
                            join( fix, prevFix );
                        }
                        else {
                            join( prevPrevFix, prevFix );
                        }
                    }

                    result.pop();
                    prevFix = prevPrevFix;
                }

                result.push( fix );

                prevPrevFix = prevFix;
                prevFix = fix;
            }
            return result;
        };

        let fixationCount;
        let result = fixations;

        do {
            fixationCount = result.length;
            result = joinInteration( result );
        } while (result.length !== fixationCount);

        return result;
    }

    function splitToProgressions (fixations) {
        var result = [];
        var currentLine;

        var createNewSet = function (fixation) {
            currentLine = [ fixation ];
            result.push( currentLine );
            return fixation;
        };

        var inReadingBox = function (dx, dy) {
             return  dx > 0 && dx < SKIMMING_THRESHOLD_X &&
                     Math.abs( dy ) < SKIMMING_THRESHOLD_Y;
         };

        var lastFix = createNewSet( fixations[0] );

        for (var i = 1; i < fixations.length; i += 1) {
            var fix = fixations[i];
            if (!inReadingBox( fix.x - lastFix.x, fix.y - lastFix.y )) {
                lastFix = createNewSet( fix );
            }
            else {
                currentLine.push( fix );
                lastFix = fix;
            }
        }

        log( 'sets of progressive fixations:', result );
        return result;
    }

    function dropShortFixations (fixationSets, maxRejectionLength ) {
        var result = [];

        for (var i = 0; i < fixationSets.length; i += 1) {
            var fixationSet = fixationSets[i];
            if (fixationSet.length > maxRejectionLength) {
                result.push( fixationSet );
            }
        }

        return result;
    }

    function sortAndAlignLines (fixationLines, textLines) {
        fixationLines.sort( (a, b) => {
            return avgY( a ) - avgY( b );
        });

        let interlineDist = 9;
        if (textLines.length > 1) {
            for (let i = 1; i < textLines.length; i += 1) {
                interlineDist += textLines[i][0].y - textLines[i - 1][0].y;
            }

            interlineDist = interlineDist / (textLines.length - 1);
        }

        let currentLineID = 0;
        let lastLineY = 0;
        for (let i = 0; i < fixationLines.length; i += 1) {
            let fixations = fixationLines[i];
            let currentLineY = 0;
            for (let j = 0; j < fixations.length; j += 1) {
                currentLineY += fixations[j].y;
            }
            currentLineY /= fixations.length;

            if (i > 0 && (currentLineY - lastLineY) > 1.7 * interlineDist) {
                console.log('====\nLine must be ', currentLineID);
                currentLineID += Math.round( (currentLineY - lastLineY) / interlineDist ) - 1;
                console.log('    but corrected to ', currentLineID);
            }

            for (let j = 0; j < fixations.length; j += 1) {
                fixations[j].line = currentLineID;
            }

            lastLineY = currentLineY;
            currentLineID += 1;
        }
    }

    function assignFixationsToLines (fixationLines) {

        for (var i = 0; i < fixationLines.length; i += 1) {
            var fixations = fixationLines[i];
            for (var j = 0; j < fixations.length; j += 1) {
                fixations[j].line = i;
            }
        }
    }

    function mapToWords (fixationLines, textLines) {
        for (var i = 0; i < fixationLines.length; i += 1) {
            let fixations = fixationLines[i];
            let textLine = textLines[ fixations[0].line ] || textLines[i];
            adjustFixations( fixations, textLine );
            mapFixationsWithinLine( fixations, textLine );
        }
    }

    function mergeSets (fixationsSets, lineCount) {

        var result;

        log( '============================' );
        log( 'Joining only long sets' );
        result = mergeSetsOfType( fixationsSets, lineCount, SET_TYPE.LONG );

        log( '============================' );
        log( 'Merging short to long sets' );
        result = mergeSetsOfType( result, lineCount, SET_TYPE.SHORT );

        log( '============================' );
        log( 'Merging the remained single-fixation sets with short sets' );
        result = mergeSetsOfType( result, lineCount, SET_TYPE.SHORT, 2 );

        if (result.length > lineCount) {
            log( '============================' );
            log( 'Still too long. Merging the shorts sets with any other sets' );
            result = mergeSetsOfType( result, lineCount, SET_TYPE.LONG, 2, SET_TYPE.LONG );
        }

        if (result.length > lineCount) {
            log( '============================' );
            log( 'And still too long... Just merge closest sets until we get the right number' );
            result = dropShortFixations( result, 2);
            result = mergeSetsOfType( result, lineCount, SET_TYPE.LONG, 1, SET_TYPE.LONG, Number.MAX_VALUE );
        }

        log( '============================' );
        log( 'Final sets', result );

        return result;
    }

    function mergeSetsOfType (fixationsSets, lineCount, setLengthType, longSetThreshold, joiningLengthType, fitThreshold) {
        while (fixationsSets.length > lineCount) {
            var newSets = mergeTwoNearestSets( fixationsSets, setLengthType, longSetThreshold, joiningLengthType, fitThreshold );

            if (!newSets) {
                break;
            }

            fixationsSets = newSets;
        }

        return fixationsSets;
    }

    function mergeTwoNearestSets (fixationsSets, setLengthType, longSetThreshold, joiningLengthType, fitThreshold) {

        var isForcedMerging = fitThreshold !== FIT_THESHOLD;

        joiningLengthType = joiningLengthType || SET_TYPE.LONG;
        longSetThreshold = longSetThreshold || LONG_SET_LENGTH_THRESHOLD;
        fitThreshold = fitThreshold || FIT_THESHOLD;

        var unions = [];
        for (var i = 0; i < fixationsSets.length; i += 1) {
            var set1 = fixationsSets[i];
            if (setLengthType === SET_TYPE.LONG && set1.length < longSetThreshold) {
                continue;
            }
            else if (setLengthType === SET_TYPE.SHORT && set1.length >= longSetThreshold) {
                continue;
            }

            for (var j = 0; j < fixationsSets.length; j += 1) {
                if (i === j) {
                    continue;
                }

                var set2 = fixationsSets[j];
                if (joiningLengthType === SET_TYPE.LONG && set2.length < longSetThreshold) {
                    continue;
                }
                else if (joiningLengthType === SET_TYPE.SHORT && set2.length >= longSetThreshold) {
                    continue;
                }

                unions.push({
                    set1: i,
                    set2: j,
                    error: getUnionError( set1, set2 )
                });
            }
        }

        var result;
        var invalidUnions = {};

        do {
            var minError = Number.MAX_VALUE;
            var minIndex = -1;
            for (var n = 0; n < unions.length; n += 1) {
                if (invalidUnions[n]) {
                    continue;
                }
                var union = unions[n];
                if (union.error < minError) {
                    minIndex = n;
                    minError = union.error;
                }
            }

            if (minIndex >= 0 && minError < fitThreshold) {
                var areSetsJoined = joinSets( fixationsSets, unions[ minIndex ], isForcedMerging ? Number.MAX_VALUE : undefined );
                if (areSetsJoined) {
                    result = fixationsSets;
                }
                else {
                    invalidUnions[ minIndex ] = true;
                }
            }
            else {
                result = null;
            }
        } while (result === undefined);

        return result;
    }

    function getUnionError( set1, set2 ) {
        var newSet = set1.concat( set2 );
        var model = regression.model( 'linear', fixationSetToFitArray( newSet ) );
        return getFittingError( newSet, model.equation );
    }

    function joinSets( fixationsSets, union, maxGradient ) {
        maxGradient = maxGradient || MAX_LINEAR_GRADIENT;

        var set1 = fixationsSets[ union.set1 ];
        var set2 = fixationsSets[ union.set2 ];
        var newSet = set1.concat( set2 );

        var model = regression.model( 'linear', fixationSetToFitArray( newSet ) );
        if (Math.abs( model.equation[1] ) < maxGradient) {
            var minIndex = Math.min( union.set1, union.set2 );
            var maxIndex = Math.max( union.set1, union.set2 );

            fixationsSets.splice( maxIndex, 1 );
            fixationsSets.splice( minIndex, 1 );
            fixationsSets.push( newSet );

            log( 'best union:', union );
            log( 'Joining sets: ', '1' ,set1, '2', set2 );
            return true;
        }

        return false;
    }

    function fixationSetToFitArray (fixations) {
        var result = [];
        for (var i = 0; i < fixations.length; i += 1) {
            var fix = fixations[i];
            result.push( [fix.x, fix.y] );
        }
        return result;
    }

    function getFittingError (fixations, model) {
        var error2 = 0;

        for (var i = 0; i < fixations.length; i += 1) {
            var fix = fixations[i];
            var y = regression.fit( model, fix.x );
            error2 += (fix.y - y) * (fix.y - y);
        }

        return Math.sqrt( error2 / fixations.length );
    }

    function avgY (fixations) {
        var sumY = 0;
        for (var i = 0; i < fixations.length; i += 1) {
            sumY += fixations[i].y;
        }
        return sumY / fixations.length;
    }

    function adjustFixations( fixations, words ) {
        const WORD_CHAR_SKIP_START = 3;
        const WORD_CHAR_SKIP_END = 6;

        const getNewLeftMostX = function (word) {
            if (word.text.length > 2 * WORD_CHAR_SKIP_START) {
                return word.x + Math.floor( WORD_CHAR_SKIP_START / word.text.length * word.width );
            }
            else {
                return word.x + Math.floor( word.width / 2 );
            }
        };
        const getNewRightMostX = function (word) {
            if (word.text.length > WORD_CHAR_SKIP_START + WORD_CHAR_SKIP_END) {
                return word.x + Math.floor( (word.text.length - WORD_CHAR_SKIP_END) / word.text.length * word.width );
            }
            else {
                return word.x + Math.floor( word.width / 2 );
            }
        };

        const firstWord = words[0];
        const leftThreshold = firstWord.x + firstWord.width;
        const lastWord = words[ words.length - 1 ];
        const rightThreshold = lastWord.fixations && lastWord.fixations.length === 1 ? lastWord.x : lastWord.x + lastWord.width;

        let leftMostX = Number.MAX_VALUE,
            rightMostX = Number.MIN_VALUE;

        for (let i = 0; i < fixations.length; i += 1) {
            let fix = fixations[i];
            if (fix.x < leftMostX) {
                leftMostX = fix.x;
            }
            else if (fix.x > rightMostX) {
                rightMostX = fix.x;
            }
        }

        log( 'left: ' + leftMostX + ' ' + leftThreshold );
        log( 'right: ' + rightMostX + ' ' + rightThreshold );

        if (leftMostX < leftThreshold || rightMostX > rightThreshold) {
            // Calculate the scaling factor
            let newLeftMostX = leftMostX < leftThreshold ?  // if the left-most fixation lands left to the 2nd word...
                            getNewLeftMostX( words[0] ) :   // ...estimate its expected location
                            leftMostX;                      // otherwise we do not know where it shoud be...
            let newRightMostX = rightMostX > rightThreshold ?               // if the right-most fixation lands right to the 2nd last word...
                            getNewRightMostX( words[ words.length - 1] ) :  // ...estimate its expected location
                            rightMostX;                                     // otherwise we do not know where it shoud be...
            let newRange = newRightMostX - newLeftMostX;
            let oldRange = rightMostX - leftMostX;
            let scale = newRange / oldRange;

            // limit the scaling factor
            let boundCorrection = 0;
            if (scale < SCALE_DIFF_THRESHOLD) {
                scale = SCALE_DIFF_THRESHOLD;
                boundCorrection = (scale * oldRange - newRange) / 2;
            }
            else if (scale > (2 - SCALE_DIFF_THRESHOLD)) {
                scale = 2 - SCALE_DIFF_THRESHOLD;
                boundCorrection = -(scale * oldRange - newRange) / 2;
            }
            newLeftMostX -= boundCorrection;
            newRightMostX += boundCorrection;

            // Recalculate x's
            log( 'X >>>>>>' );
            for (let i = 0; i < fixations.length; i += 1) {
                let fix = fixations[i];
                fix._x = fix.x;
                fix.x = newLeftMostX + scale * (fix.x - leftMostX);
                log( fix.x + ' >> ' + fix._x );
            }
        }
    }

    function mapFixationsWithinLine( fixations, words ) {
        for (var i = 0; i < fixations.length; i += 1) {
            var fix = fixations[i];
            var minDist = Number.MAX_VALUE;
            var minDistWordID = -1;
            for (var j = 0; j < words.length; j += 1) {
                var word = words[j];
                var effectiveWordWidth = word.fixations || word.text.length < 3  ? 0.7 * word.width : word.width;
                if (fix.x >= word.x && fix.x < effectiveWordWidth) {
                    minDistWordID = j;
                    minDist = 0;
                    break;
                }
                else {
                    var dist = Math.max( word.x - fix.x, fix.x - (word.x + effectiveWordWidth) );
                    if (dist < minDist) {
                        minDist = dist;
                        minDistWordID = j;
                    }
                }
            }

            var closestWord = words[ minDistWordID ];
            fix.word = {
                left: closestWord.x,
                top: closestWord.y,
                right: closestWord.x + closestWord.width,
                bottom: closestWord.y + closestWord.height,
                index: minDistWordID,
                text: closestWord.text,
                id: closestWord.id
            };

            if (closestWord.fixations) {
                closestWord.fixations.push( fix );
            }
            else {
                closestWord.fixations = [ fix ];
            }
        }
    }

    function computeRegressions (fixations) {
        var getPrevMappedFix = function (index, step) {
            var result;
            var passed = 0;
            for (var i = index - 1; i >= 0; i -= 1) {
                var fix = fixations[i];
                if (fix.line !== undefined) {
                    passed += 1;
                    if (passed === step) {
                        result = fix;
                        break;
                    }
                }
            }

            return result;
        };

        var getNextMappedFix = function (index, step) {
            var result;
            var passed = 0;
            for (var i = index + 1; i < fixations.length; i += 1) {
                var fix = fixations[i];
                if (fix.line !== undefined) {
                    passed += 1;
                    if (passed === step) {
                        result = fix;
                        break;
                    }
                }
            }

            return result;
        };

        for (var i = 0; i < fixations.length; i += 1) {
            var fix = fixations[i];
            if (fix.line !== undefined && fix.word !== undefined) {
                var prevFix = getPrevMappedFix( i, 1 );
                fix.isRegression = prevFix && fix.line == prevFix.line && fix.word.index < prevFix.word.index ? true : false;
                if (fix.isRegression) {    // requires correction in ceratin conditions
                    var nextFix = getNextMappedFix( i, 1 );
                    if (nextFix !== undefined && nextFix.line != fix.line) {
                        fix.isRegression = false;
                    }
                    else {
                        //var prevFix = getPrevMappedFix( i, 1 );
                        var prev2Fix = getPrevMappedFix( i, 2 );
                        if (prevFix !== undefined && prev2Fix !== undefined && prevFix.line != prev2Fix.line) {
                            fix.isRegression = false;
                        }
                    }
                }
            }
        }
    }

    function removeTransitionsToNextLine (fixations, words) {
        var index = fixations.length - 1;

        const getPrevFixationOnLine = function (index) {
            let result = null;
            for (; index > 0; index -= 1) {
                var fix = fixations[ index ];
                if (fix.line !== undefined) {
                    result = fix;
                    break;
                }
            }

            return result;
        };

        const getLastChunkSaccade = function (index, direction) {
            let result = null;
            for (; index > 0; index -= 1) {
                var fix = fixations[ index ];
                if (fix.line === undefined) {
                    continue;
                }

                var prevFix = getPrevFixationOnLine( index - 1 );
                if (!prevFix) {
                    index = 0;
                    break;
                }

                if (direction < 0 ? fix.x < prevFix.x : fix.x >= prevFix.x) {
                    result = fix;
                    break;
                }
            }

            return [ result, index ];
        };

        while (index) {
            let [firstProgressionFix, firstProgressionFixIndex] = getLastChunkSaccade( index, -1 );
            if (!firstProgressionFixIndex) {
                break;
            }

            var [lastProgressionFix, index] = getLastChunkSaccade( firstProgressionFixIndex, 1 );

            if (!lastProgressionFix) {
                continue;
            }

            if (firstProgressionFix.line === lastProgressionFix.line + 1) {
                for (let i = index + 1; i < firstProgressionFixIndex; i += 1) {
                    let fix = fixations[ i ];
                    if (fix.word) {
                        let word = words[ fix.word.id ];
                        word.fixations = word.fixations.filter( f => f.id !== fix.id );
                        fix.word = null;
                        fix.line = undefined;
                        log( 'Mapping removed for fix #', fix.id );
                    }
                }
            }
        }
    }

    // Export
    app.StaticFit = {
        map: map,
        settings: settings
    };

})( this.Reading || module.exports );