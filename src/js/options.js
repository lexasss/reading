// Requires:
//      utils/logger

(function (app) { 'use strict';

    // Controller for the text options side-slider
    // Constructor arguments:
    //      options: {
    //          root:   - slideout element ID
    //          text:   - full text selector
    //      }
    //      services: {             - get/set services
    //          showPointer (bool)
    //          highlightWord (bool)
    //          hideText (bool)
    //          path {
    //              colorMetric (index)
    //              fixationUseLineColor (bool)
    //              showConnections (bool)
    //              showSaccades (bool)
    //              showFixations (bool)
    //              showOriginalFixLocation (bool)
    //          }
    //          wordGazing {
    //              colorMetric (index)
    //              showFixations (bool)
    //              uniteSpacings (bool)
    //              showRegressions (bool)
    //          }
    //      }
    function Options(options, services) {

        this.root = options.root || '#options';
        
        this._slideout = document.querySelector( this.root );

        var logError = app.Logger.moduleErrorPrinter( 'Options' );

        _services = services;
        _services.showPointer = _services.showPointer || logError( 'showPointer' );
        _services.highlightWord = _services.highlightWord || logError( 'highlightWord' );
        _services.hideText = _services.hideText || logError( 'hideText' );

        _services.path = _services.path || {};
        _services.path.colorMetric = _services.path.colorMetric || logError( 'path.colorMetric"' );
        _services.path.showConnections = _services.path.showConnections || logError( 'path.showConnections' );
        _services.path.showSaccades = _services.path.showSaccades || logError( 'path.showSaccades' );
        _services.path.showFixations = _services.path.showFixations || logError( 'path.showFixations' );
        _services.path.showOriginalFixLocation = _services.path.showOriginalFixLocation || logError( 'path.showOriginalFixLocation' );

        _services.wordGazing = _services.wordGazing || {};
        _services.wordGazing.colorMetric = _services.wordGazing.colorMetric || logError( 'wordGazing.colorMetric' );
        _services.wordGazing.showFixations = _services.wordGazing.showFixations || logError( 'wordGazing.showFixations' );
        _services.wordGazing.uniteSpacings = _services.wordGazing.uniteSpacings || logError( 'wordGazing.uniteSpacings' );
        _services.wordGazing.showRegressions = _services.wordGazing.showRegressions || logError( 'wordGazing.showRegressions' );

        var cssRules = [
            /*{
                name:        rule CSS name
                type:        the type of control to represent the rule
                selector:    rule selector
                id:          control ID
                prefix:      the rule value prefix not to be shown in the control
                suffix:      the rule value suffix not to be shown in the control
                value:     [auto-filled] rule value
                initial:   [auto-filled] initial rule value
                editor:    [auto-filled] rule control
            }*/
            { name: 'color', type: 'color', selector: options.text, id: 'text', prefix: '#', suffix: '' },
            { name: 'color', type: 'color', selector: options.text + ' .currentWord', id: 'currentWord', prefix: '#', suffix: '' },
            { name: 'font-size', type: 'string', selector: options.text, id: 'fontSize', prefix: '', suffix: '' },
            //{ name: 'line-height', type: 'string', selector: options.text, id: 'lineHeight', prefix: '', suffix: '' },
        ];

        this._style = document.createElement( 'style' );
        document.body.appendChild( this._style );

        var apply = document.querySelector( this.root + ' .save' );
        apply.addEventListener( 'click', () => {
            getRulesFromEditors( this._style, cssRules );
            this._slideout.classList.remove( 'expanded' );

            saveSettings( cssRules );
        });

        var close = document.querySelector( this.root + ' .close' );
        close.addEventListener( 'click', () => {
            this._slideout.classList.remove( 'expanded' );
        });

        var slideoutTitle = document.querySelector( this.root + ' .title');
        slideoutTitle.addEventListener( 'click', () => {
            this._slideout.classList.toggle( 'expanded' );
            setRulesToEditors( cssRules );
        });

        window.addEventListener( 'load', () => {
            loadSettings( cssRules );
            this._style.innerHTML = cssRules.reduce( function (css, rule) {
                return css + rule.selector + ' { ' + rule.name + ': ' + rule.initial + rule.suffix + ' !important; } ';
            }, '');
            
            obtainInitialRules( cssRules );
            
            bindSettingsToEditors( this.root );
            bindRulesToEditors( cssRules, this.root + ' #' );
        });
    }

    // Disables editing
    Options.prototype.lock = function () {
        this._slideout.classList.add( 'locked' );
    };

    // Enables editing
    Options.prototype.unlock = function () {
        this._slideout.classList.remove( 'locked' );
    };

    // private

    var _services;

    function loadSettings(cssRules) {
        var options = JSON.parse( localStorage.getItem('options') );
        if (!options) {
            return;
        }

        var services = _services;

        var pop = function (storage, srv) {
            for (var name in storage) {
                if (name === 'css') {
                    continue;
                }
                else if (typeof storage[ name ] === 'object') {
                    pop( storage[ name ], srv[ name ] );
                }
                else if (srv[ name ]) {
                    srv[ name ]( storage[ name ] );
                }
            }
        };

        pop( options, services );

        // for (var name in options) {
        //     if (_services[ name ]) {
        //         _services[ name ]( options[name] );
        //     }
        // }

        if (options.css) {
            var ruleInitilization = (rule) => {
                if (rule.selector === parts[0] && rule.name === parts[1]) {
                    rule.initial = options.css[ savedRule ];
                } 
            };
            for (var savedRule in options.css) {
                var parts = savedRule.split( '____' );
                cssRules.forEach( ruleInitilization );
            }
        }
    }

    function saveSettings(cssRules) {
        var options = {};
        var services = _services;

        var push = function (storage, srv) {
            for (var name in srv) {
                if (typeof srv[ name ] === 'function') {
                    storage[ name ] = srv[ name ]();
                }
                else if (typeof srv[ name ] === 'object') {
                    storage[ name ] = { };
                    push( storage[ name ], srv[ name ] );
                }
            }
        };

        push( options, services );

        options.css = {};
        cssRules.forEach( function (rule) {
            options.css[ rule.selector + '____' + rule.name ] = rule.value; 
        });

        localStorage.setItem( 'options', JSON.stringify( options) );
    }

    function componentToHex( c ) {
        var hex = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }

    function rgbToHex( r, g, b ) {
        return '#' + componentToHex( r ) + componentToHex( g ) + componentToHex( b );
    }

    function cssColorToHex( cssColor ) {
        
        var colorRegex = /^\D+(\d+)\D+(\d+)\D+(\d+)\D+$/gim;
        var colorComps = colorRegex.exec( cssColor );

        return rgbToHex( 
            parseInt( colorComps[ 1 ] ),
            parseInt( colorComps[ 2 ] ),
            parseInt( colorComps[ 3 ] ) );
    }

    function cssToJS( cssName ) {

        var dashIndex = cssName.indexOf( '-' );
        while (dashIndex >= 0) {
            var char = cssName.charAt( dashIndex + 1);
            cssName = cssName.replace( '-' + char,  char.toUpperCase() );
            dashIndex = cssName.indexOf( '-' );
        }
        return cssName;
    }

    function obtainInitialRules( rules ) {

        for (var s = 0; s < document.styleSheets.length; s++) {
            var sheet = document.styleSheets[ s ];
            for (var r = 0; r < sheet.cssRules.length; r++) {
                var rule = sheet.cssRules[ r ];
                for (var c = 0; c < rules.length; c++) {
                    var customRule = rules[ c ];
                    if (rule.selectorText === customRule.selector) {
                        if (customRule.initial === undefined) {
                            if (customRule.type === 'color') {
                                customRule.initial = cssColorToHex( rule.style.color );
                            }
                            else if (customRule.type === 'string') {
                                customRule.initial = rule.style[ cssToJS( customRule.name ) ];
                            }
                        }
                        customRule.value = customRule.initial;
                    }
                }
            }
        }
    }

    function bindRulesToEditors( rules, idBase ) {

        for (var i = 0; i < rules.length; i++) {
            var rule = rules[ i ];
            rule.editor = document.querySelector( idBase + rule.id );

            if (rule.type === 'color') {
                rule.editor.value = rule.initial;  //color.fromString( rule.initial );
            }
            else if (rule.type === 'string') {
                rule.editor.value = rule.initial;
            }
        }
    }

    function getRulesFromEditors( style, rules ) {

        var styleText = '';
        for (var i = 0; i < rules.length; i++) {
            var rule = rules[ i ];
            if (rule.type === 'color') {
                rule.value = rule.editor.value; //'#' + rule.editor.color;
            }
            else if (rule.type === 'string') {
                rule.value = rule.editor.value;
            }
            styleText += rule.selector + ' { ' + rule.name + ': ' + rule.value + rule.suffix + ' !important; } ';
        }
        style.innerHTML = styleText;
    }

    function setRulesToEditors( rules ) {

        for (var i = 0; i < rules.length; i++) {
            var rule = rules[ i ];
            if (rule.type === 'color') {
                rule.editor.value = rule.value;//color.fromString( rules.value );
            }
            else if (rule.type === 'string') {
                rule.editor.value = rule.value;
            }
        }
    }

    function bindSettingsToEditors(root) {
        var bindCheckbox = (id, service) => {
            var flag = document.querySelector( root + ' #' + id );
            flag.checked = service();
            flag.addEventListener( 'click', function () {
                service( this.checked );
            });
        };

        var bindSelect = (id, service) => {
            var select = document.querySelector( root + ' #' + id );
            select.selectedIndex = service();
            select.addEventListener( 'change', function () {
                service( this.selectedIndex );
            });
        };

        bindCheckbox( 'showPointer', _services.showPointer );
        bindCheckbox( 'highlightWord', _services.highlightWord );
        bindCheckbox( 'hiddenText', _services.hideText );
        
        bindSelect( 'path_colorMetric', _services.path.colorMetric );
        bindCheckbox( 'path_fixationUseLineColor', _services.path.fixationUseLineColor );
        bindCheckbox( 'path_showConnections', _services.path.showConnections );
        bindCheckbox( 'path_showSaccades', _services.path.showSaccades );
        bindCheckbox( 'path_showFixations', _services.path.showFixations );
        bindCheckbox( 'path_showOriginalFixLocation', _services.path.showOriginalFixLocation );

        bindSelect( 'wordGazing_colorMetric', _services.wordGazing.colorMetric );
        bindCheckbox( 'wordGazing_showFixations', _services.wordGazing.showFixations );
        bindCheckbox( 'wordGazing_uniteSpacings', _services.wordGazing.uniteSpacings );
        bindCheckbox( 'wordGazing_showRegressions', _services.wordGazing.showRegressions );
    }

    app.Options = Options;
    
})( this.Reading || module.this.exports );
