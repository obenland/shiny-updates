# Shiny Updates [![Build Status](https://travis-ci.org/obenland/shiny-updates.svg?branch=master)](https://travis-ci.org/obenland/shiny-updates)

Removes the ugly bits of updating plugins, themes and such.

## Installation

1. Download Shiny Updates.
2. Unzip the folder into the `/wp-content/plugins/` directory.
3. Activate the plugin through the 'Plugins' menu in WordPress.

### Testing
We need help testing the user flows! Please [install the Shiny Updates plugin](https://wordpress.org/plugins/shiny-updates/), run the tests below, and share your feedback in the [#feature-shinyupdates](https://wordpress.slack.com/archives/feature-shinyupdates) channel in Slack or [create an issue on GitHub](https://github.com/obenland/shiny-updates/issues).

*Plugin Tests*

1. Search for a new plugin and install it.
1. In a plugin card, click 'More details' and install it from the modal.
1. Activate the plugin.
1. If you have any plugins that need updating, update them. If you don't have any that need updating, you can edit the plugin and change the version number to something older. Once saved, this plugin will show as needing an update.
1. In a plugin row that needs updating, click 'View details' and update it from the modal.
1. Delete a plugin you've already installed.
1. Bulk Actions - If you have several plugins that need updating or deleting, you can try the bulk actions as well. Just select several plugins, then from the dropdown at the top select your action and 'Apply' it.
1. If you have a multisite installation, go through the checklist in the network admin.
1. Share your feedback. Or if you found a bug, [create an issue on GitHub](https://github.com/obenland/shiny-updates/issues).

*Theme Tests*

1. Search for a new theme and install it.
1. Preview a different theme and install it from the preview.
1. Activate the theme.
1. If you have any themes that need updating, update them. If you don't have any that need updating, you can edit the theme and change the version number to something older. Once saved, this theme will show as needing an update.
1. Delete a theme you've already installed.
1. If you have a multisite installation, go through the checklist in the network admin.
1. Share your feedback. Or if you found a bug, [create an issue on GitHub](https://github.com/obenland/shiny-updates/issues).

*Update core*

1. If you have any themes or plugins that need updating, update them. If you don't have any that need updating, you can edit the them and change the version number to something older. Once saved, they will show as needing an update.
1. Update one specific item, a theme or a plugin.
1. Try updating all items in the table.
1. Share your feedback. Or if you found a bug, <a href="https://github.com/obenland/shiny-updates/issues">create an issue on GitHub</a>.

*Questions*

1. What were the noticeable differences in the new install/update/activate/delete process compared to the old one without Shiny Updates?
1. How did installing and activating a plugin or theme go? Was it difficult or easy? Was it faster or slower than expected?
1. Do you have any further comments or suggestions?


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
