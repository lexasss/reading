(function (app) { 'use strict';

	function WordSplit () {

	}

    WordSplit.syllables = function (word) {
        var result = [];
        var syllable = '';
        var chain = '';
        word = word.toLowerCase( word );

        for (var i = 0; i < word.length; i += 1) {
            var c = word[i];
            syllable +=c;

            var charType = vowels.some( vowel => { return c === vowel; } ) ? types.VOWEL : types.CONSONANT;
            chain += charType;
//console.log(chain, ':', syllable);
            if (charType === types.VOWEL && chain.length > 1) {			// when there are at least 2 chars, and the lst one is vowel,
                var boundIndex = bounds.findIndex( (bound, index) => {	// then search for the matching bound
//console.log('--- bound check ---' );
                    var isMatching = chain.endsWith( bound[2] );
//console.log(bound[2], isMatching);
                    if (isMatching && index === 3) { 					// cannot be diftong or long vowel
                        var s = syllable.substr( -2, 2 );
                        if (s[0] === s[1]) {
                            isMatching = false;
//console.log('    cancel - this is long vowel');
                        }
                        else if (diftongs.some( diftong => { return s === diftong; } )) {
                            isMatching = false;
//console.log('    cancel - this is diftong');
                        }
                    }
                    return isMatching;
                });
                if (boundIndex >= 0) {
                    var newSyllableLength = bounds[ boundIndex ][1].length;
//console.log(newSyllableLength);
                    result.push( syllable.substr( 0, syllable.length - newSyllableLength ) );
//console.log('syllable found:', syllable.substr( 0, syllable.length - newSyllableLength ));
                    syllable = syllable.substr( -newSyllableLength, newSyllableLength );
//console.log('   text left:', syllable);
                    chain = chain.substr( -newSyllableLength, newSyllableLength );
//console.log('   chain left:', chain);
                }
            }
        }
        
        result.push( syllable );
//console.log('   text left:', syllable);

        return result;
    };

    var types = {
        VOWEL: 'v',
        CONSONANT: 'c'
    };
    var vowels = [ 'a', 'o', 'u', 'i', 'e', 'ä', 'ö', 'y' ];
    var diftongs = [
        'ai', 'ei', 'oi', 'ui', 'yi', 'äi', 'öi', 
        'au', 'eu', 'iu', 'ou',
        'äy', 'ey', 'iy', 'öy', 
        'ie', 'uo', 'yö'
    ];
    var bounds = [
        [ 'v', 'cv'],
        [ 'vc', 'cv' ],
        [ 'vcc', 'cv' ],
        [ 'v', 'v' ]
    ];

    bounds.forEach( item => {
        item.push( item[0] + item[1] );
    });

    app.WordSplit = WordSplit;
    
})( this['Reading'] || module.exports );
