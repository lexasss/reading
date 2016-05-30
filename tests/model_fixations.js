'use strict';

var assert = require('chai').assert;
var fixations = require('../src/js/model/fixations.js').Fixations;

fixations.init({
	minDuration: 100,
	threshold: 35,
	sampleDuration: 30
});

describe( 'Fixation', function() {
	describe( '#feed( x, y )', function () {
		var samples = [
			{x: 100, y: 0},
			{x: 100, y: 0},
			{x: 100, y: 0},
			{x: 100, y: 60},
			{x: 100, y: 0},
			{x: 100, y: 0},
			{x: 100, y: 0},
			{x: 100, y: 0},
			{x: 200, y: 0},
			{x: 200, y: 0},
			{x: 200, y: 0},
			{x: 200, y: 0},
			{x: 200, y: 0},
			{x: 200, y: 0},
			{x: 200, y: 0},
			{x: 200, y: 0},
		];
		var results = [];
		samples.forEach( (sample) => {
			fixations.feed( sample.x, sample.y );
			results.push( fixations.current() );
		});

		var sample100 = results.reduce( (sum, item) => {
			return sum + (item.x === 100 ? 1 : 0);
		}, 0);
    	it( 'should return 8 for fixation 1', function () {
			assert.equal( 8, sample100 );
		});

		var sample200 = results.reduce( (sum, item) => {
			return sum + (item.x === 200 ? 1 : 0);
		}, 0);
    	it( 'should return 7 for fixation 2', function () {
			assert.equal( 7, sample200 );
		});
	});

	describe( '#feed( fix )', function () {
		fixations.reset();
		var progressingFixation = [
			{x: 100, y: 0, duration: 30},
			{x: 100, y: 0, duration: 60},
			{x: 100, y: 0, duration: 90},
			{x: 100, y: 0, duration: 120},
			{x: 100, y: 0, duration: 150},
			{x: 100, y: 0, duration: 180},
			{x: 100, y: 0, duration: 210},
			{x: 100, y: 0, duration: 240},
			{x: 200, y: 0, duration: 30},
			{x: 200, y: 0, duration: 60},
			{x: 200, y: 0, duration: 90},
			{x: 200, y: 0, duration: 120},
			{x: 200, y: 0, duration: 150},
			{x: 200, y: 0, duration: 180},
			{x: 200, y: 0, duration: 210},
			{x: 200, y: 0, duration: 240},
		];

		var results = [];
		progressingFixation.forEach( (progressingFixation) => {
			results.push( fixations.feed( progressingFixation ) );
		});

		var fix100 = results.reduce( (sum, item) => {
			return sum + (item && item.x === 100 ? 1 : 0);
		}, 0);
    	it( 'should return 1 for fixation 1', function () {
			assert.equal( 1, fix100 );
		});

		var fix200 = results.reduce( (sum, item) => {
			return sum + (item && item.x === 200 ? 1 : 0);
		}, 0);
    	it( 'should return 1 for fixation 2', function () {
			assert.equal( 1, fix200 );
		});
	});

	describe( '#add( x, y, duration )', function () {
		fixations.reset();
		var fixes = [
			{x: 100, y: 0, duration: 240},
			{x: 200, y: 0, duration: 240},
		];

		var results = [];
		fixes.forEach( (fix) => {
			results.push( fixations.add( fix.x, fix.y, fix.duration ) );
		});

		var fix100 = results.reduce( (sum, item) => {
			return sum + (item && item.x === 100 ? 1 : 0);
		}, 0);
    	it( 'should return 1 for fixation 1', function () {
			assert.equal( 1, fix100 );
		});

		var fix200 = results.reduce( (sum, item) => {
			return sum + (item && item.x === 200 ? 1 : 0);
		}, 0);
    	it( 'should return 1 for fixation 2', function () {
			assert.equal( 1, fix200 );
		});
	});
});