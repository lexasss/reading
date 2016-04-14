(function (app) { 'use strict';

    // Initializes and sets callbacks for the app controls
    // Constructor arguments:
    //      options: {
    //          root:               - controls container element ID
    //      }
    //      services: {
    //          getTexts ()         - retrieve the list of texts
    //          getSpacings ()      - retrieve the list of spacings
    //          switchText (id)     - switch the text to "id"
    //          switchSpacing (id)  - switch the spacing to "id"
    //          selectSession ()    - show a DB session selection dialog
    //      }
    function Controls(options, services) {
        this.root = options.root || document.documentElement;

        _services = services;

        _services.getTexts = _services.getTexts || console.error( 'No "getTexts" service for Controls' );
        _services.getSpacings = _services.getSpacings || console.error( 'No "getSpacings" service for Controls' );
        _services.switchText = _services.switchText || console.error( 'No "switchText" service for Controls' );
        _services.switchSpacing = _services.switchSpacing || console.error( 'No "switchSpacing" service for Controls' );
        _services.selectSession = _services.selectSession || console.error( 'No "selectSession" service for Controls' );

        var container = document.querySelector( this.root );

        _device = document.querySelector( this.root + ' .device' );
        
        _options = document.querySelector( this.root + ' .options' );
        _options.addEventListener('click', function () {
            GazeTargets.ETUDriver.showOptions();
        });

        _calibrate = document.querySelector( this.root + ' .calibrate' );
        _calibrate.addEventListener('click', function () {
            GazeTargets.ETUDriver.calibrate();
        });

        _toggle = document.querySelector( this.root + ' .toggle' );
        _toggle.addEventListener('click', function () {
            GazeTargets.ETUDriver.toggleTracking();
        });

        _textSwitchers = document.querySelector( this.root + ' .text' );
        var texts = _services.getTexts();
        for (var i = 0; i < texts.length; i += 1) {
            var swither = document.createElement('div');
            swither.className = 'button';
            swither.textContent = 'Text ' + (i + 1);
            swither.addEventListener('click', getTextSwitcherHandler( i ));
            if (i === 0) {
                swither.classList.add('selected');
            }
            _textSwitchers.appendChild( swither );
        }

        _spacingSwitchers = document.querySelector( this.root + ' .spacing' );
        var spacings = _services.getSpacings();
        for (var i = 0; i < spacings.length; i += 1) {
            var swither = document.createElement('div');
            swither.className = 'button';
            swither.textContent = spacings[ i ];
            swither.addEventListener('click', getSpacingSwitcherHandler( i ));
            if (i === 0) {
                swither.classList.add('selected');
            }
            _spacingSwitchers.appendChild( swither );
        }

        var loadSession = document.querySelector( '.loadSession' );
        loadSession.addEventListener('click', function () {
            _services.selectSession();
        });

        _connectionTimeout = setTimeout(function () {
            _device.textContent = 'Disconnected';
        }, 3000);
        
        _services.switchText(0);
        _services.switchSpacing(0);
    }

    Controls.prototype.onStateUpdated = function (state) {
        if (state.device) {
            _device.textContent = state.device;
            clearTimeout( _connectionTimeout );
        } 
        else if (!state.isConnected) {
            _device.textContent = 'Disconnected';
        }

        setDisabled( _options, !state.isServiceRunning || state.isTracking || state.isBusy);
        setDisabled( _calibrate, !state.isConnected || state.isTracking || state.isBusy);
        setDisabled( _toggle, !state.isCalibrated || state.isBusy);

        _toggle.textContent = state.isTracking ? 'Stop' : 'Start';
    };

    // private

    function setDisabled(button, disabled) {
        if (disabled) {
            button.classList.add('disabled');
        } else {
            button.classList.remove('disabled');
        }
    };

    function getTextSwitcherHandler(index) {
        return function () { 
            _services.switchText( index );
            select(this, _textSwitchers);
        }
    };

    function getSpacingSwitcherHandler(index) {
        return function () { 
            _services.switchSpacing( index );
            select(this, _spacingSwitchers);
        }
    };

    function select(button, container) {
        var switches = container.childNodes;
        for (var i = 0; i < switches.length; i += 1) {
            switches.item(i).classList.remove('selected');
        }
        button.classList.add('selected');
    }

    var _services;
    var _device;
    var _options;
    var _calibrate;
    var _toggle;

    var _textSwitchers;
    var _spacingSwitchers;
    
    var _connectionTimeout;

    app.Controls = Controls;
    
})( Reading || window );
