<?php
/**
 * Plugin Name: Shiny Updates
 * Plugin URI: https://github.com/obenland/shiny-updates
 * Description: A smoother experience for managing plugins and themes.
 * Author: the WordPress team
 * Author URI: https://github.com/obenland/shiny-updates
 * Version: 2
 * License: GPL2
 *
 * @package Shiny_Updates
 */

/**
 * Init our plugin.
 *
 * @codeCoverageIgnore
 */
function su_init() {
	require_once( dirname( __FILE__ ) . '/src/functions.php' );
	require_once( dirname( __FILE__ ) . '/src/ajax-actions.php' );
	require_once( dirname( __FILE__ ) . '/src/update.php' );
	require_once( dirname( __FILE__ ) . '/src/default-filters.php' );
}

add_action( 'plugins_loaded', 'su_init' );
