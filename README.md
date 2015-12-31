# Shiny Updates [![Build Status](https://travis-ci.org/obenland/shiny-updates.svg?branch=master)](https://travis-ci.org/obenland/shiny-updates)

Removes the ugly bits of updating plugins, themes and such.

## Installation

1. Download Shiny Updates.
2. Unzip the folder into the `/wp-content/plugins/` directory.
3. Activate the plugin through the 'Plugins' menu in WordPress.

### Running the Unit Tests

While working on Shiny Updates, please make sure to always have Grunt in watch mode. You'll be notified immediately about failing test cases and code style errors, minimizing the amount of cleanup we will have to do when we prepare to merge this Feature Plugin into WordPress Core.

Make sure you have the necessary dependencies:

```bash
npm install
```

Start `grunt watch` or `npm start` to auto-build Shiny Updates as you work:

```bash
grunt watch
```
