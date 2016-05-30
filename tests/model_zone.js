'use strict';

var assert = require('chai').assert;
var zone = require('../src/js/model/zone.js').Zone;

zone.init({
	// default settings
}, {
	lineHeight: 50,
	lineWidth: 500
});

describe( 'Zone', function() {
	describe( '#match( saccade )', function () {
		var saccades = [
			[ {x: 100, y: 0}, 2],
			[ {x: -100, y: 0}, 2],
			[ {x: 100, y: 100}, 1],
			[ {x: 0, y: 300}, 0],
		];
		saccades.forEach( (item) => {
	    	it( `should return ${item[1]} for saccade ${item[0].x},${item[0].y}`, function () {
				assert.equal( item[1], zone.match( item[0] ) );
			});
		})
	});
});