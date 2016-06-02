'use strict';

var assert = require('chai').assert;
var Geometry = require('../src/js/model/geometry.js').Geometry;

Geometry.init();

function Target (x, y) {
	this.left = x;
	this.top = y;
	this.right = x + 100;
	this.bottom = y + 35;
}

Target.prototype.getBoundingClientRect = function () {
	return this;
}

var targets = [
	new Target(0, 0),
	new Target(110, 0),
	new Target(220, 0),
	new Target(330, 0),
	new Target(440, 0),
	new Target(550, 0),
	new Target(0, 100),
	new Target(110, 100),
	new Target(220, 100),
	new Target(330, 100),
	new Target(440, 100),
	new Target(550, 100),
];

describe( 'Geometry', function() {
	describe( '#create( targets )', function () {
		var model = Geometry.create( targets );
    	it( `should have 2 lines`, function () {
			assert.equal( 2, model.lines.length );
		});
    	it( `should be 650 px wide`, function () {
			assert.equal( 650, model.lineWidth );
		});
    	it( `should have 35 px high lines`, function () {
			assert.equal( 35, model.lineHeight );
		});
    	it( `should have 65 px spacing`, function () {
			assert.equal( 100, model.lineSpacing );
		});
	});
});