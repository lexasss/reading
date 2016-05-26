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

        _services = services;
        _services.showPointer = _services.showPointer || console.error( 'No "showPointer" service for Options' );
        _services.highlightWord = _services.highlightWord || console.error( 'No "highlightWord" service for Options' );
        _services.hideText = _services.hideText || console.error( 'No "hideText" service for Options' );

        _services.path = _services.path || {};
        _services.path.colorMetric = _services.path.colorMetric || console.error( 'No "path.colorMetric" service for Options' );
        _services.path.showConnections = _services.path.showConnections || console.error( 'No "path.showConnections" service for Options' );
        _services.path.showSaccades = _services.path.showSaccades || console.error( 'No "path.showSaccades" service for Options' );
        _services.path.showFixations = _services.path.showFixations || console.error( 'No "path.showFixations" service for Options' );
        _services.path.showOriginalFixLocation = _services.path.showOriginalFixLocation || console.error( 'No "path.showOriginalFixLocation" service for Options' );

        _services.wordGazing = _services.wordGazing || {};
        _services.wordGazing.colorMetric = _services.wordGazing.colorMetric || console.error( 'No "wordGazing.colorMetric" service for Options' );
        _services.wordGazing.showFixations = _services.wordGazing.showFixations || console.error( 'No "wordGazing.showFixations" service for Options' );
        _services.wordGazing.uniteSpacings = _services.wordGazing.uniteSpacings || console.error( 'No "wordGazing.uniteSpacings" service for Options' );
        _services.wordGazing.showRegressions = _services.wordGazing.showRegressions || console.error( 'No "wordGazing.showRegressions" service for Options' );

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

        var self = this;
        
        var apply = document.querySelector( this.root + ' .save' );
        apply.addEventListener( 'click', function () {
            getRulesFromEditors( self._style, cssRules );
            self._slideout.classList.remove( 'expanded' );

            saveSettings( cssRules );
        });

        var close = document.querySelector( this.root + ' .close' );
        close.addEventListener( 'click', function () {
            self._slideout.classList.remove( 'expanded' );
        });

        var slideoutTitle = document.querySelector( this.root + ' .title');
        slideoutTitle.addEventListener( 'click', function (e) {
            self._slideout.classList.toggle( 'expanded' );
            setRulesToEditors( cssRules );
        });

        window.addEventListener( 'load', function () {
            loadSettings( cssRules );
            self._style.innerHTML = cssRules.reduce( function (css, rule) {
                return css + rule.selector + ' { ' + rule.name + ': ' + rule.initial + rule.suffix + ' !important; } ';
            }, '');
            
            obtainInitialRules( cssRules );
            
            bindSettingsToEditors( self.root );
            bindRulesToEditors( cssRules, self.root + ' #' );
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
            flag.addEventListener( 'click', function (e) {
                service( this.checked );
            });
        };

        var bindSelect = (id, service) => {
            var select = document.querySelector( root + ' #' + id );
            select.selectedIndex = service();
            select.addEventListener( 'change', function (e) {
                service( this.selectedIndex );
            });
        };

        bindCheckbox( 'showPointer', _services.showPointer );
        bindCheckbox( 'highlightWord', _services.highlightWord );
        bindCheckbox( 'hiddenText', _services.hideText );
        
        bindSelect( 'path_colorMetric', _services.path.colorMetric );
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
