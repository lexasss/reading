'use strict';

var assert = require('chai').assert;
var Model = require('../src/js/model/model2.js').Model2;

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

function Fix (x, y, prevFix) {
	this.x = x;
	this.y = y;
	this.saccade = { };
	this.saccade.x = prevFix ? x - prevFix.x : 0;
	this.saccade.y = prevFix ? y - prevFix.y : 0;
	this.saccade.newLine = prevFix ? (x < prevFix.x && y > prevFix.y + 50) : false;
	this.previous = prevFix;
	this.next = null;
}

Fix.prototype.toString = function () {
	return `${this.x}, ${this.y}`;
};

var fixations = [
	{x: 30, y: 15},
	{x: 130, y: 10},
	{x: 250, y: -5},
	{x: 370, y: 5},
	{x: 470, y: -10},
	{x: 490, y: 5},
	{x: 590, y: 0},
	{x: 200, y: 30},
	{x: 30, y: 120},
	{x: 130, y: 120},
	{x: 250, y: 115},
	{x: 370, y: 100},
	{x: 470, y: 95},
	{x: 490, y: 95},
	{x: 590, y: 90},
];

var fixes = [];
for (let i = 0, lf = null; i < fixations.length; i += 1) {
	let fix = fixations[i];
	fix = new Fix( fix.x, fix.y, lf );
	if (lf) {
		lf.next = fix;
	}
	lf = fix;
	fixes.push( fix );
}

Model.init();

describe( 'Model1', function() {
	describe( '#reset( targets )', function () {
		Model.reset( targets );
    	console.log('\n\n\n');
    	it( `should be OK`, function () {
			assert.isOk( 'just ok' );
		});
	});
	describe( '#feedFixation( fix )', function () {
		// var line = null;
		// var results = input.map( (item) => {
		// 	console.log( '\n ===== NEW FIX =====\n' );
		// 	line = LinePredictor.get( item.isReading, item.fix, line, 0 );
		// 	if (line) {
		// 		line.addFixation( item.fix );
		// 	}
		// 	return line;
		// });

		fixes.forEach( (fix) => {
			Model.feedFixation( fix );
		});
        console.log('\n\n\n');

    	it( `should be OK`, function () {
			assert.isOk( 'just ok' );
		});
	});
});