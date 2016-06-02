'use strict';

var assert = require('chai').assert;
var LinePredictor = require('../src/js/model/linePredictor.js').LinePredictor;
var Geometry = require('../src/js/model/geometry.js').Geometry;
var Line = require('../src/js/model/line.js').Line;

Geometry.init();
Line.init();

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

var fixations = [
	{x: 30, y: 15, saccade: {x: 0, y: 0, newLine: false}},
	{x: 130, y: 10, saccade: {x: 100, y: -5, newLine: false}},
	{x: 250, y: -5, saccade: {x: 120, y: -15, newLine: false}},
	{x: 370, y: 5, saccade: {x: 120, y: 10, newLine: false}},
	{x: 470, y: -10, saccade: {x: 100, y: -15, newLine: false}},
	{x: 490, y: 5, saccade: {x: 20, y: 15, newLine: false}},
	{x: 590, y: 0, saccade: {x: 100, y: -5, newLine: false}},
	{x: 200, y: 30, saccade: {x: -290, y: 30, newLine: true}},
	{x: 30, y: 120, saccade: {x: -170, y: 90, newLine: true}},
	{x: 130, y: 120, saccade: {x: 100, y: 0, newLine: false}},
	{x: 250, y: 115, saccade: {x: 120, y: -5, newLine: false}},
	{x: 370, y: 100, saccade: {x: 120, y: -15, newLine: false}},
	{x: 470, y: 95, saccade: {x: 100, y: -5, newLine: false}},
	{x: 490, y: 95, saccade: {x: 20, y: 0, newLine: false}},
	{x: 590, y: 90, saccade: {x: 100, y: -5, newLine: false}},
];

var model = Geometry.create( targets );
LinePredictor.init( model );

var input = fixations.map( (fix, index) => {
	return {
		fix: fix,
		isReading: index > 1
	};
});

describe( 'LinePredictor', function() {
	describe( '#get( isEnteredReadingMode, currentFixation, currentLine, offset )', function () {
		var line = null;
		var results = input.map( (item) => {
			console.log( '\n ===== NEW FIX =====\n' );
			line = LinePredictor.get( item.isReading, item.fix, line, 0 );
			if (line) {
				line.addFixation( item.fix );
			}
			return line;
		});

    	it( `should all fixations be mapped`, function () {
			let fixCount = results.reduce( (count, line) => {
				return count + (!line ? 1 : 0);
			}, 0);
			assert.equal( 0, fixCount );
		});
    	it( `should 8 fixations be mapped onto line 0`, function () {
			let fixCount = results.reduce( (count, line) => {
				return count + (line && line.index === 0 ? 1 : 0);
			}, 0);
			assert.equal( 8, fixCount );
		});
    	it( `should 7 fixations be mapped onto line 1`, function () {
			let fixCount = results.reduce( (count, line) => {
				return count + (line && line.index === 1 ? 1 : 0);
			}, 0);
			assert.equal( 7, fixCount );
		});
	});
});