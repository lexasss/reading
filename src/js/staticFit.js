// Requires:
//      regression.js

if (!this['Reading']) {
	var regression = require('../../libs/regression.js');
}

(function(app) {

	var MARGIN_X = 100;
	var MARGIN_Y = 180;
	var FIT_THESHOLD = 27;
	var SKIMMING_THRESHOLD_X = 500;
	var SKIMMING_THRESHOLD_Y = 40;
	var SCALE_DIFF_THRESHOLD = 0.9;
	var MAX_LINEAR_GRADIENT = 0.15;
	var LONG_SET_LENGTH_THRESHOLD = 3;
	var SET_TYPE = {
		LONG: 'long',
		SHORT: 'short',
		ANY: 'any'
	};

	function map (data) {
		if (!data.fixations || !data.words) {
			return;
		}

		var text = getText( data.words );
		var fixations = filterFixations( data.fixations, text.box );
		var progressions = splitToProgressions( fixations );
		var sets = mergeSets( progressions, text.lines.length );
		sets = dropSingleFixations( sets );
	
		sets.sort( function (a, b) {
			return avgY(a) - avgY(b);
		});

		labelFixations( sets );
		log('Fixation labelled', data.fixations);

		mapToWords( sets, text.lines );
		computeRegressions( data.fixations );
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
			if (word.x < box.left) { box.left = word.x;	}
			if (word.y < box.top) { box.top = word.y;	}
			if (word.x + word.width > box.right) { box.right = word.x + word.width;	}
			if (word.y + word.height > box.bottom) { box.bottom = word.y + word.height;	}

			if (word.y != currentY) {
				currentY = word.y;
				createNewLine( word );
			}
			else {
				currentLine.push( word );
			}
		}

		log('lines: ' + lines.length);

		return {
			box: box,
			lines: lines
		};
	}

	function filterFixations (fixations, textbox) {
		var result = [];

		for (var i = 0; i < fixations.length; i += 1) {
			var fix = fixations[i];
			if (fix.x > textbox.left - MARGIN_X &&
				fix.x < textbox.right + MARGIN_X &&
				fix.y > textbox.top - MARGIN_Y &&
				fix.y < textbox.bottom + MARGIN_Y) { 
				result.push( fix );
			}
		}

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

		log( 'sets of progressive fixations:', result);
		return result;
	}

	function dropSingleFixations (fixationSets ) {
		var result = [];

		for (var i = 0; i < fixationSets.length; i += 1) {
			var fixationSet = fixationSets[i];
			if (fixationSet.length > 1) {
				result.push( fixationSet );
			}
		}

		return result;
	}

	function labelFixations (fixationSets) {

		for (var i = 0; i < fixationSets.length; i += 1) {
			var fixationSet = fixationSets[i];
			for (var j = 0; j < fixationSet.length; j += 1) {
				fixationSet[j].line = i;
			}
		}
	}

	function mapToWords (fixationLines, textLines) {
		for (var i = 0; i < fixationLines.length && i < textLines.length; i += 1) {
			adjustFixations( fixationLines[i], textLines[i] );
			mapFixationsWithinLine( fixationLines[i], textLines[i] );
		}
	}

	function mergeSets (fixationsSets, lineCount) {

		var result;

		log('============================');
		log('Joining only long sets');
		result = mergeSetsOfType( fixationsSets, lineCount, SET_TYPE.LONG );
		
		log('============================');
		log('Merging short to long sets');
		result = mergeSetsOfType( result, lineCount, SET_TYPE.SHORT );
		
		log('============================');
		log('Merging the remained single-fixation sets with short sets');
		result = mergeSetsOfType( result, lineCount, SET_TYPE.SHORT, 2 );

		if (result.length > lineCount) {
			log('============================');
			log('Still too long. Merging the shorts sets with any other sets');
			result = mergeSetsOfType( result, lineCount, SET_TYPE.LONG, 2, SET_TYPE.LONG );
		}

		log('============================');
		log('Final sets', result);
		
		return result;
	}

	function mergeSetsOfType (fixationsSets, lineCount, setLengthType, longSetThreshold, joiningLengthType) {
		while (fixationsSets.length > lineCount) {
			var newSets = mergeTwoNearestSets( fixationsSets, setLengthType, longSetThreshold, joiningLengthType );
			
			if (!newSets) {
				break;
			}

			fixationsSets = newSets;
			// console.log('\nnew set:');
			// console.log(fixationsSets);
			// console.log('\n------------------------n');
		}

		return fixationsSets;
	}

	function mergeTwoNearestSets (fixationsSets, setLengthType, longSetThreshold, joiningLengthType) {

		joiningLengthType = joiningLengthType || SET_TYPE.LONG;
		longSetThreshold = longSetThreshold || LONG_SET_LENGTH_THRESHOLD;

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

			if (minIndex >= 0 && minError < FIT_THESHOLD) {
				var areSetsJoined = joinSets( fixationsSets, unions[ minIndex ] );
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

	function joinSets( fixationsSets, union ) {
		var set1 = fixationsSets[ union.set1 ];
		var set2 = fixationsSets[ union.set2 ];
		var newSet = set1.concat( set2 );

		var model = regression.model( 'linear', fixationSetToFitArray( newSet ) );
		if (Math.abs( model.equation[1] ) < MAX_LINEAR_GRADIENT) {
			var minIndex = Math.min( union.set1, union.set2 );
			var maxIndex = Math.max( union.set1, union.set2 );

			fixationsSets.splice( maxIndex, 1 );
			fixationsSets.splice( minIndex, 1 );
			fixationsSets.push( newSet );

			log('best union:', union);
			log('Joining sets: ', '1' ,set1, '2', set2);
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

		return error = Math.sqrt( error2 / fixations.length );
	}

	function avgY (fixations) {
		var sumY = 0;
		for (var i = 0; i < fixations.length; i += 1) {
			sumY += fixations[i].y;
		}
		return sumY / fixations.length;
	}

	function adjustFixations( fixations, words ) {
		var getThreshold = function (word) {
			return word.x + 1 * word.width;
		};
		var getBound = function (word, side) {
			var expectedFixationCount = 1 + Math.floor( word.text.length / 12 );
			var wordFixationPart = word.width / expectedFixationCount;
			var result = word.x;
			if (side == 'right') {
				result += (expectedFixationCount - 1) * wordFixationPart;
			}
			result += 0.3 * wordFixationPart;
			return result;
		};

		var leftThreshold = getThreshold( words[0] );
		var rightThreshold = getThreshold( words[ words.length - 2 ] );

		var leftMostFix, rightMostFix;
		var leftMostX = Number.MAX_VALUE, 
			rightMostX = Number.MIN_VALUE;

		for (var i = 0; i < fixations.length; i += 1) {
			var fix = fixations[i];
			if (fix.x < leftMostX) {
				leftMostX = fix.x;
				leftMostFix = fix;
			}
			else if (fix.x > rightMostX) {
				rightMostX = fix.x;
				rightMostFix = fix;
			}
		}

		log('left: ' + leftMostX + ' ' + leftThreshold);
		log('right: ' + rightMostX + ' ' + rightThreshold);
		if (leftMostX < leftThreshold || rightMostX > rightThreshold) {
			var leftBound = leftMostX < leftThreshold ? getBound( words[0], 'left' ) : leftMostX;
			var rightBound = rightMostX > rightThreshold && words[ words.length - 1].text.length > 2 ? 
							getBound( words[ words.length - 1], 'right' ) : rightMostX;
			var newRange = rightBound - leftBound;
			var oldRange = rightMostX - leftMostX;
			var scale = newRange / oldRange;

			if (scale < SCALE_DIFF_THRESHOLD) {
				scale = SCALE_DIFF_THRESHOLD;
				var boundCorrection = (scale * oldRange - newRange) / 2;
				leftBound -= boundCorrection;
				rightBound -= boundCorrection;
			}
			else if (scale > (2 - SCALE_DIFF_THRESHOLD)) {
				scale = 2 - SCALE_DIFF_THRESHOLD;
				var boundCorrection = (scale * oldRange - newRange) / 2;
				leftBound -= boundCorrection;
				rightBound -= boundCorrection;
			}

			log('X >>>>>>');
			for (var i = 0; i < fixations.length; i += 1) {
				var fix = fixations[i];
				fix._x = fix.x;
				fix.x = leftBound + scale * (fix.x - leftMostX);
				log( fix.x + ' >> ' + fix._x );
			}
		}
	}

	function mapFixationsWithinLine( fixations, words ) {
		for (var i = 0; i < fixations.length; i += 1) {
			var fix = fixations[i];
			var minDist = Number.MAX_VALUE;
			var minDistWordID = -1
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
		        index: minDistWordID
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
				if (fix.isRegression) {	// requires correction in ceratin conditions
					var nextFix = getNextMappedFix( i, 1 );
					if (nextFix !== undefined && nextFix.line != fix.line) {
						fix.isRegression = false;
					}
					else {
						var prevFix = getPrevMappedFix( i, 1 );
						var prev2Fix = getPrevMappedFix( i, 2 );
						if (prevFix !== undefined && prev2Fix !== undefined && prevFix.line != prev2Fix.line) {
							fix.isRegression = false;
						}
					}
				}
			}
		}
	}

	function log (title) {
		
		if (this['Reading'] !== undefined) {
			return;
		} 

		console.log( '\n', title );
		for (var i = 1; i < arguments.length; i += 1) {
			var data = arguments[i];
			if (data === undefined) {
				continue;
			}
			if (data instanceof Array) {
				data.forEach( function (item) {
					console.log( item );
				});
			}
			else {
				console.log( data );
			}
		}
	}

	// Export

	app.StaticFit = {
		map: map
	};

})(this['Reading'] || module.exports);