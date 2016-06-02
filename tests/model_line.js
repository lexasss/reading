'use strict';

var assert = require('chai').assert;
var Line = require('../src/js/model/line.js').Line;

Line.init();

var words = [
	{ left: 0, top: 0, right: 100, bottom: 40 },
	{ left: 110, top: 0, right: 210, bottom: 40 },
	{ left: 220, top: 0, right: 320, bottom: 40 },
	{ left: 330, top: 0, right: 430, bottom: 40 },
	{ left: 440, top: 0, right: 540, bottom: 40 },
	{ left: 550, top: 0, right: 650, bottom: 40 },
	{ left: 660, top: 0, right: 760, bottom: 40 },
	{ left: 770, top: 0, right: 870, bottom: 40 },
];

var fixations = [
	{x: 30, y: 15, saccade: {x: 0, y: 0, newLine: false}},
	{x: 130, y: 10, saccade: {x: 100, y: -5, newLine: false}},
	{x: 250, y: -5, saccade: {x: 120, y: -15, newLine: false}},
	{x: 370, y: 5, saccade: {x: 120, y: 10, newLine: false}},
	{x: 470, y: -10, saccade: {x: 100, y: -15, newLine: false}},
	{x: 490, y: 5, saccade: {x: 20, y: 15, newLine: false}},
	{x: 590, y: 0, saccade: {x: 100, y: -5, newLine: false}},
	{x: 690, y: -10, saccade: {x: 100, y: -10, newLine: false}},
	{x: 790, y: -5, saccade: {x: 100, y: 5, newLine: false}},
];

var pts = [
	{x: 0, y: 0},
	{x: 100, y: 0},
	{x: 200, y: 0},
	{x: 300, y: 0},
	{x: 400, y: 0},
	{x: 500, y: 0},
	{x: 600, y: 0},
	{x: 700, y: 0},
	{x: 800, y: 0},
	{x: 900, y: 0},
];

describe( 'Line 1', function() {
	var line = new Line();
	words.forEach( (word) => {
		line.add( word );
	});
	fixations.forEach( (fix) => {
		line.addFixation( fix );
	});
	var errs = pts.map( (pt) => {
		return line.fit( pt.x, pt.y );
	});

	describe( '#constructor()', function () {
    	it( `line props should not exist`, function () {
			assert.isNaN( line.center );
		});
	});
	describe( '#add( word )', function () {
    	it( `line width should be 870`, function () {
			assert.equal( 870, line.width() );
		});
    	it( `line center X should be 435`, function () {
			assert.equal( 435, line.center.x );
		});
    	it( `line center Y should be 20`, function () {
			assert.equal( 20, line.center.y );
		});
	});
	describe( '#addFixation( fix )', function () {
    	it( `line fit model should be below 28`, function () {
			assert.isTrue( errs.every( err => {
				return Math.abs(err < 28);
			}) );
		});
	});
});

describe( 'Line 2', function() {
	var line = new Line( words[0] );
	words.forEach( (word, index) => {
		if (index) { line.add( word ); }
	});
	fixations.forEach( (fix) => {
		line.addFixation( fix );
	});
	var errs = pts.map( (pt) => {
		return line.fit( pt.x, pt.y );
	});

	describe( '#constructor()', function () {
    	it( `line props should not exist`, function () {
			assert.isNaN( line.center );
		});
	});
	describe( '#add( word )', function () {
    	it( `line width should be 870`, function () {
			assert.equal( 870, line.width() );
		});
    	it( `line center X should be 435`, function () {
			assert.equal( 435, line.center.x );
		});
    	it( `line center Y should be 20`, function () {
			assert.equal( 20, line.center.y );
		});
	});
	describe( '#addFixation( fix )', function () {
    	it( `line fit model should be below 28`, function () {
			assert.isTrue( errs.every( err => {
				return Math.abs(err < 28);
			}) );
		});
	});
});