Shiny Updates [![Build Status](https://travis-ci.org/obenland/shiny-updates.svg?branch=master)](https://travis-ci.org/obenland/shiny-updates)
===============
* Contributors: pento, obenland, adamsilverstein
* Tags: updates
* Requires at least: 4.2
* Tested up to: 4.5
* Stable tag: 2
* License: GPLv2 or later
* License URI: http://www.gnu.org/licenses/gpl-2.0.html

Removes the ugly bits of updating plugins, themes and such.

## Description #

Shiny updates was initially part of WordPress 4.2 and this continues that work to remove the ugly bits of updating plugins, themes and such.

## Installation

1. Download Shiny Updates.
2. Unzip the folder into the `/wp-content/plugins/` directory.
3. Activate the plugin through the 'Plugins' menu in WordPress.

Also available on https://wordpress.org/plugins/shiny-updates/ which is automatically synced with the github repository.

## Get Involved

Active development is taking place on GitHub, at https://github.com/obenland/shiny-updates. Please report issues, submit patches, and follow along on GitHub!

Weekly meetings are Tuesdays at 19:00 UTC in the #feature-shinyupdates channel on http://wordpress.slack.com/ -- if you don't have a Slack account, sign up at http://chat.wordpress.org/

Never submitted a pull request before? See this simple screecast of how to get started: https://drive.google.com/file/d/0B79yG8ISeYmFcngxZHdDTFVBcXc/view?usp=sharing

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

## Screenshots

Existing plugin install process:
![Existing plugin install process](/Animated gif - existing plugin install.gif?raw=true "Existing plugin install process")

Example of shiny plugin install process:
![Example of shiny plugin install process](/Animated gif - shiny plugin install.gif?raw=true "Example of shiny plugin install process")

## Changelog

### 2
* Lots of improvements after v1 of Shiny Updates was shipped with 4.2.

### 0.1
* Initial release.