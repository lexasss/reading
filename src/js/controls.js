// Requires:
//      shortcut
//      GazeTargets
//      utils/logger

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
    //          selectCondition ()  - show a condition selection dialog
    //      }
    function Controls (options, services) {
        this.root = options.root || document.documentElement;

        _services = services;

        var logError = app.Logger.moduleErrorPrinter( 'Controls' );
        _services.getTexts = _services.getTexts || logError( 'getTexts' );
        _services.getSpacings = _services.getSpacings || logError( 'getSpacings' );
        _services.switchText = _services.switchText || logError( 'switchText' );
        _services.switchSpacing = _services.switchSpacing || logError( 'switchSpacing' );
        _services.selectSession = _services.selectSession || logError( 'selectSession' );
        _services.selectCondition = _services.selectCondition || logError( 'selectCondition' );
        _services.selectFile = _services.selectFile || logError( 'selectFile' );
        _services.simulate = _services.simulate || logError( 'simulate' );
        _services.gazeReplay = _services.gazeReplay || logError( 'gazeReplay' );

        //var container = document.querySelector( this.root );

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
            setButtonDisabled( _toggle, true );
            GazeTargets.ETUDriver.toggleTracking();
        });

        _textSwitchers = document.querySelector( this.root + ' .text' );
        var texts = _services.getTexts();
        for (let i = 0; i < texts.length; i += 1) {
            let swither = document.createElement('div');
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
        for (let i = 0; i < spacings.length; i += 1) {
            let swither = document.createElement('div');
            swither.className = 'button';
            swither.textContent = spacings[ i ];
            swither.addEventListener('click', getSpacingSwitcherHandler( i ));
            if (i === 0) {
                swither.classList.add('selected');
            }
            _spacingSwitchers.appendChild( swither );
        }

        _loadSession = document.querySelector( this.root + ' .loadSession' );
        _loadSession.addEventListener('click', function () {
            _services.selectSession();
        });

        _loadCondition = document.querySelector( this.root + ' .loadCondition' );
        _loadCondition.addEventListener('click', function () {
            _services.selectCondition();
        });

        _loadFile = document.querySelector( this.root + ' .loadFile' );
        _loadFile.addEventListener('click', function () {
            _services.selectFile();
        });

        _simulate = document.querySelector( this.root + ' .simulate' );
        _simulate.addEventListener('click', function () {
            _services.simulate( true );
        });

        _gazeReplay = document.querySelector( this.root + ' .gazeReplay' );
        _gazeReplay.addEventListener('click', function () {
            _services.gazeReplay( true );
        });

        // shortcut.add( 'Space', function() {
        //     _toggle.click();
        // });

        _connectionTimeout = setTimeout(function () {
            _device.textContent = 'Disconnected';
        }, 3000);

        _services.switchText(0);
        _services.switchSpacing(0);
    }

    Controls.prototype.lock = function () {
        setButtonBlockDisabled( _textSwitchers, true );
        setButtonBlockDisabled( _spacingSwitchers, true );
        _loadSession.classList.add( 'disabled' );
        _loadCondition.classList.add( 'disabled' );
        _loadFile.classList.add( 'disabled' );
        _simulate.classList.add( 'disabled' );
        _gazeReplay.classList.add( 'disabled' );
    };

    Controls.prototype.unlock = function () {
        setButtonBlockDisabled( _textSwitchers, false );
        setButtonBlockDisabled( _spacingSwitchers, false );
        _loadSession.classList.remove( 'disabled' );
        _loadCondition.classList.remove( 'disabled' );
        _loadFile.classList.remove( 'disabled' );
        _simulate.classList.remove( 'disabled' );
        _gazeReplay.classList.remove( 'disabled' );
    };

    Controls.prototype.onStateUpdated = function (state) {
        if (state.device) {
            _device.textContent = state.device;
            clearTimeout( _connectionTimeout );
        }
        else if (!state.isConnected) {
            _device.textContent = 'Disconnected';
        }

        setButtonDisabled( _options, !state.isServiceRunning || state.isTracking || state.isBusy);
        setButtonDisabled( _calibrate, !state.isConnected || state.isTracking || state.isBusy);
        setButtonDisabled( _toggle, !state.isCalibrated || state.isBusy);

        _toggle.textContent = state.isTracking ? 'Stop' : 'Start';
    };

    // private

    function setButtonDisabled(button, isDisabled) {
        if (isDisabled) {
            button.classList.add('disabled');
        } else {
            button.classList.remove('disabled');
        }
    }

    function setButtonBlockDisabled(container, isDisabled) {
        var switches = container.childNodes;
        for (var i = 0; i < switches.length; i += 1) {
            setButtonDisabled( switches.item(i), isDisabled);
        }
    }

    function getTextSwitcherHandler(index) {
        return function () {
            _services.switchText( index );
            select(this, _textSwitchers);
        };
    }

    function getSpacingSwitcherHandler(index) {
        return function () {
            _services.switchSpacing( index );
            select(this, _spacingSwitchers);
        };
    }

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
    var _loadSession;
    var _loadCondition;
    var _loadFile;
    var _simulate;
    var _gazeReplay;

    var _connectionTimeout;

    app.Controls = Controls;

})( this.Reading || module.exports );
