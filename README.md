# Reading

Records and visualizes gaze data while reading text in Finnish.

## Dependencies

 * [ETU-Driver](http://www.sis.uta.fi/~csolsp/downloads.php?id=ETUDriver). Install it and run `ETU-Driver Service` and enable `Websocket server` from the menu.

## Install and run

Clone the package using git:

    git clone https://github.com/uta-gasp/reading.git
    cd reading

Install depenencies:

    npm install

Switch to the `school` branch:

    git checkout school

Build the package:

    grunt

Open `build/index.html`.