(function (app) { 'use strict';

    // Word highlighting propagation routine
    // Constructor arguments:
    //      options: {
    //          syllabificationEnabled
    //          highlightingEnabled
    //          threshold - minimum fixation duration in ms to consider the word should be split
    //      }
    function Syllabifier( options ) {

        this.syllabificationEnabled = options.syllabificationEnabled || false;
        this.highlightingEnabled = options.highlightingEnabled || false;
        this.threshold = options.threshold || 1000;

        this.className = 'currentWord';
        this.spacer = '-';

        this.timer = null;
        this.currentWord = null;
        this.words = null;
    }

    // Resets the highlighting
    Syllabifier.prototype.reset = function () {

        if (this.currentWord) {
            this.currentWord.classList.remove( this.className );
            this.currentWord = null;
        }

        clearTimeout( this.timer );
        this.timer = null;
        this.words = null;
    };

    Syllabifier.prototype.init = function () {
        if (this.syllabificationEnabled) {
            this.words = new Map();
            this.timer = setInterval( () => {
                this._tick();
            }, 30);
        }
    };

    Syllabifier.prototype._tick = function () {
        for (let key of this.words.keys()) {
            let duration = this.words.get( key );
            if (duration >= 0) {    // if duration is <0, then this word is split already
                duration = Math.max( 0, duration + (key === this.currentWord ? 30 : -30) );

                if (duration > this.threshold) {
                    duration = -1;

                    const textNodes = Array.from( key.childNodes).filter( node => node.nodeType === Node.TEXT_NODE);
                    key.innerHTML = this.syllabifyWord( textNodes[0].textContent.trim() );
                }

                this.words.set( key, duration );
            }
        }
    };

    // Propagates / removed the highlighing
    // Arguments:
    //   word: - the focused word (DOM)
    Syllabifier.prototype.setFocusedWord = function (word) {

        if (this.currentWord != word) {
            if (this.highlightingEnabled) {
                if (this.currentWord) {
                    this.currentWord.classList.remove( this.className );
                }
                if (word) {
                    word.classList.add( this.className );
                }
            }
            this.currentWord = word;

            if (word && !this.words.has( word )) {
                this.words.set( word, 0 );
            }
        }
    };

    Syllabifier.prototype.syllabify = function( text ) {

        if (!this.syllabificationEnabled) {
            return text;
        }

        return text.map( line => {
            const words = line.split( ' ' ).map( word => word.toLowerCase() );
            return words.map( word => this.syllabifyWord( word ) ).join( ' ' );
        });
    };

    Syllabifier.prototype.prepareForSyllabification = function( text ) {

        if (!this.syllabificationEnabled) {
            return text;
        }

        const prepareWord = word => {
            const syllabifiedWord = this.syllabifyWord( word );
            const spacesCount = syllabifiedWord.length - word.length;
            const halfSpacesCount = Math.round( spacesCount / 2 );

            return  '<span class="syllab">' +
                        (Array( halfSpacesCount + 1 ).join( this.spacer ) ) +
                    '</span>' +
                    word +
                    '<span class="syllab">' +
                        (Array( spacesCount - halfSpacesCount + 1 ).join( this.spacer ) ) +
                    '</span>';
        };

        if ( text instanceof Array ) {
            return text.map( line => {
                const words = line.split( ' ' ).map( word => word.toLowerCase() );
                return words.map( prepareWord ).join( ' ' );
            });
        }
        else {
            return prepareWord( text );
        }
    };

    Syllabifier.prototype.syllabifyWord = function (word) {
        const vowels = [ 'a', 'o', 'u', 'i', 'e', 'ä', 'ö', 'y' ];
        const consonants = [ 'b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm',
                            'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'z' ];
        const diftongs = [ 'ai', 'ei', 'oi', 'ui', 'yi', 'äi', 'öi', 'au', 'eu',
                            'iu', 'ou', 'ey', 'iy', 'äy', 'öy', 'ie', 'uo', 'yö' ];

        const getType = c => vowels.includes( c ) ? 'V' : ( consonants.includes( c ) ? 'C' : '_' );

        const result = [];

        let hasVowel = false;
        for (let i = word.length - 1; i >= 0; i--) {
            let separate = false;
            const char = word[i];
            const type = getType( char );
            if (type === 'V') {
                if (i < word.length - 1) {
                    const charPrevious = word[ i + 1 ];
                    const typePrevious = getType( charPrevious );
                    if (charPrevious !== char && typePrevious === type
                        && !diftongs.includes( char + charPrevious)) {
                        result.unshift( this.spacer );
                    }
                }
                hasVowel = true;
            }
            else if (type === 'C' && hasVowel) {
                separate = i > 0;
                if (i === 1) {
                    const charNext = word[i - 1];
                    const typeNext = getType( charNext );
                    if (typeNext === type) {
                        separate = false;
                    }
                }
            }
            result.unshift( char );

            if (separate) {
                result.unshift( this.spacer );
                hasVowel = false;
            }
        }

        return result.join('');
    }

    // test
    // syllabified.forEach( line => line.forEach( word => { console.log(word); } ));

    // export

    app.Syllabifier = Syllabifier;

})( this.Reading || module.exports );
