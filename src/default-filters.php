<?php
/**
 * Sets up the default filters and actions for most
 * of the plugin hooks.
 *
 * If you need to remove a default hook, this file will
 * give you the priority for which to use to remove the
 * hook.
 *
 * @todo Merge: Add to wp-includes/default-filters.php, wp-admin/includes/admin-filters.php
 *       and the Ajax stuff to wp-admin/admin-ajax.php
 *
 * @package Shiny_Updates
 * @since 4.X.0
 */

// Enqueue JavaScript and CSS.
add_action( 'admin_enqueue_scripts', 'su_enqueue_scripts' );

// Add the update HTML for plugin updates progress.
add_action( 'in_admin_header', 'su_admin_notice_template' );
add_action( 'in_admin_header', 'su_plugin_update_row_template' );

// Search plugins.
add_action( 'wp_ajax_search-plugins', 'wp_ajax_search_plugins' );
add_action( 'wp_ajax_search-install-plugins', 'wp_ajax_search_install_plugins' );

// Plugin updates.
add_action( 'wp_ajax_update-plugin', 'wpsu_ajax_update_plugin', -1 );

// Plugin deletions.
add_action( 'wp_ajax_delete-plugin', 'wp_ajax_delete_plugin' );

// Plugin activations.
add_action( 'wp_ajax_activate-plugin', 'su_wp_ajax_activate_plugin' );
add_filter( 'plugin_install_action_links', 'su_plugin_install_actions', 10, 2 );

// Themes.
add_filter( 'wp_prepare_themes_for_js', 'su_theme_data' );

// Update Themes.
add_action( 'admin_footer-themes.php', 'wp_print_request_filesystem_credentials_modal' );
add_action( 'wp_ajax_install-theme', 'wp_ajax_install_theme' );

// Install Themes.
add_action( 'admin_footer-theme-install.php', 'wp_print_request_filesystem_credentials_modal' );
add_action( 'wp_ajax_update-theme', 'wp_ajax_update_theme' );

// Delete Themes.
add_action( 'wp_ajax_delete-theme', 'wp_ajax_delete_theme' );

// Plugin modal installations.
add_action( 'install_plugins_pre_plugin-information', 'su_install_plugin_information', 9 );

// Translation updates.
add_action( 'wp_ajax_update-translations', 'wp_ajax_update_translations', -1 );

// Core updates.
add_action( 'wp_ajax_update-core', 'wp_ajax_update_core', -1 );
add_action( 'core_upgrade_preamble', 'su_update_table' );
add_action( 'update-core-custom_do-all-upgrade', 'su_update_all' );
add_action( 'admin_footer-update-core.php', 'wp_print_request_filesystem_credentials_modal' );
add_action( 'admin_footer-import.php',      'wp_print_request_filesystem_credentials_modal' );

add_filter( 'removable_query_args', 'su_wp_removable_query_args' );

// Replace update row functions.
add_action( 'admin_init', 'su_new_update_rows', 1 );
