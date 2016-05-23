(function (app) { 'use strict';

    // Text controller
    // Constructor arguments:
    //      options: {
    //          root:       - ID of the element that stores the text
    //      }
    //      services: {
    //          splitText ()        - service to split the updated text
    //      }
    function Text(options, services) {

        this.root = options.root || '#textContainer';
        _services = services;

        _services.splitText = _services.splitText || console.error( 'No "splitText" service for Text' );

        _textContainer = document.querySelector( this.root );
        
        this.texts = [
            /*[
                'Steroidivyöhykkeen pienimpiä kivikappaleita sanotaan',
                'meteoroideiksi. Joskus sellainen voi pudota maanpinnalle.',
                'Tällöin sitä kutsutaan meteoriitiksi.'
            ],*/
            [
                'Asteroidit eli pikkuplaneetat ovat pääosin kivisiä,',
                'metallisia ja jäisiä kappaleita, jotka kiertävät Aurinkoa',
                'omilla radoillaan. Suurin osa asteroideista sijaitsee',
                'Marsin ja Jupiterin välissä olevalla asteroidivyöhykkeellä.'
            ],
            [
                'Komeetat eli pyrstötähdet ovat pieniä kappaleita,',
                'jotka koostuvat jäästä ja pölystä. Ne kiertävät Aurinkoa',
                'omilla radoillaan. Kun komeetta liikkuu lähelle Aurinkoa,',
                'sille syntyy kaasusta ja pölystä pyrstö. Pyrstö voi olla miljoonien',
                'kilometrien pituinen. Pyrstö heijastaa Auringon valoa.'
            ],
            [
                'Aurinko on Maata lähinnä oleva tähti. Se on',
                'erittäin kuuma kaasupallo. Lämpötila Auringon pinnassa on',
                'noin 6 000 °C. Auringosta säteilee valoa ja lämpöä.',
                'Maa sijaitsee sopivalla etäisyydellä Auringosta.',
                'Aurinko on kooltaan 109 kertaa suurempi kuin maapallo.',
                'Aurinko ja kahdeksan planeettaa muodostavat aurinkokunnan.'
            ],
            [
                'Matka on ollut pitkä, mutta ihana. Tapasin Lapissa myös joulupukin.',
                'Minä luulin, että Lapissa on aina lunta mutta ei siellä ollut yhtään',
                'lunta. Pelkäsin, että joulupukki kysyy minulta, olenko ollut kiltti.',
                'Mutta ei hän kysynyt. Joulupukki kysyi, mistä me tulemme. Minä sanoin,',
                'että tulemme Kaislarannasta. Sitten joulupukki sanoi, että oli hauska',
                'tavata ja good bye! Minä ymmärsin heti, että nyt piti lähteä.'
            ]
        ];

        this.spacings = ['x-small', 'small', 'median', 'large', 'x-large'];

        this._initialVisibility = true;
    }

    Text.prototype.initialVisibility = function (value) {
        if (value !== undefined) {
            this._initialVisibility = value;
            if (this._initialVisibility) {
                this.show();
            }
            else {
                this.hide();
            }
        }
        else {
            return this._initialVisibility;
        }
    }

    Text.prototype.switchText = function (index) {
        _textIndex = index;
        var lines = this.texts[ index ];
        if (!lines) {
            return;
        }

        _textContainer.innerHTML = '';
        
        for (var i = 0; i < lines.length; i += 1) {
            var line = document.createElement('div');
            line.className = 'line';
            line.textContent = lines[i];

            _textContainer.appendChild( line );
        }

        _services.splitText();
    };

    Text.prototype.switchSpacing = function (index) {
        _textContainer.classList.remove( this.spacings[ _spacingIndex ] );
        _spacingIndex = index;
        _textContainer.classList.add( this.spacings[ _spacingIndex ] );
    };

    Text.prototype.getCurrentTextIndex = function () {
        return _textIndex;
    };

    Text.prototype.getCurrentSpacingIndex = function () {
        return _spacingIndex;
    };

    Text.prototype.show = function() {
        _textContainer.classList.remove( 'invisible' );
    };

    Text.prototype.hide = function() {
        _textContainer.classList.add( 'invisible' );
    };

    Text.prototype.getSetup = function () {
        return {
            textID: _textIndex,
            lineSize: _spacingIndex
        };
    };

    var _textContainer;
    var _services;
    var _textIndex = 0;
    var _spacingIndex = 0;

    app.Text = Text;
    
})( Reading || window );
