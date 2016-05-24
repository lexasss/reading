'use strict';

var wordSplit = require('../src/js/utils/wordSplit.js').WordSplit;

console.log( wordSplit.syllables('aurinko') );
console.log( wordSplit.syllables('minä') );
console.log( wordSplit.syllables('maapallo') );
console.log( wordSplit.syllables('serkku') );
console.log( wordSplit.syllables('toivonen') );
console.log( wordSplit.syllables('mies') );
console.log( wordSplit.syllables('hänen') );
console.log( wordSplit.syllables('aamulehti') );
console.log( wordSplit.syllables('Kaislarannasta') );
console.log( wordSplit.syllables('Tapasin') );
