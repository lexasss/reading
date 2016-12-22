'use strict';

var assert = require('chai').assert;
var wordSplit = require('../src/js/utils/wordSplit.js').WordSplit;

describe( 'WordSplit', function() {
	describe( '#syllables( string )', function () {
		var words = [
			['aurinko', 3],
			['minä', 2],
			['maapallo', 3],
			['serkku', 2],
			['toivonen', 3],
			['mies', 1],
			['hänen', 2],
			['aamulehti', 4],
			['Kaislarannasta', 5],
			['Tapasin', 3],
			['Asteroidit', 4]
		];
		words.forEach( (item) => {
	    	it( `should return ${item[1]} for ${item[0]}`, function () {
	    		var result = wordSplit.syllables( item[0] );
				//console.log( result );
				assert.equal( item[1], result.length )
			});
		});
	});
});