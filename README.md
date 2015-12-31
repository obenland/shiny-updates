# Shiny Updates [![Build Status](https://travis-ci.org/obenland/shiny-updates.svg?branch=master)](https://travis-ci.org/obenland/shiny-updates)

Contributors: pento, obenland, adamsilverstein
Tags: updates
Requires at least: 4.2
Tested up to: 4.5
Stable tag: 2
License: GPLv2 or later

"Shiny updates" was being developed as part of WordPress 4.2, but not everything made it into core. This initiative is to continue that work of removing the ugly bits of updating plugins, themes and such.

Existing plugin install process:
![Existing plugin install process](/Animated gif - existing plugin install.gif?raw=true "Existing plugin install process")

Example of shiny plugin install process:
![Example of shiny plugin install process](/Animated gif - shiny plugin install.gif?raw=true "Example of shiny plugin install process")

## Installation

1. Download Shiny Updates.
2. Unzip the folder into the `/wp-content/plugins/` directory.
3. Activate the plugin through the 'Plugins' menu in WordPress.

Also available on https://wordpress.org/plugins/shiny-updates/ which is automatically synced with the github repository.

## Get Involved

Active development is taking place on GitHub, at https://github.com/obenland/shiny-updates

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
