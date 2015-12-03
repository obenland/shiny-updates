<?php
/**
 * Auto Updates Settings.
 */

/**
 * Register form setting for auto updates.
 */
function shiny_auto_updates() {
	add_settings_section( 'shiny_auto_updates', __( 'Automatic Updates' ), 'shiny_auto_updates_description', 'shiny_auto_updates' );

	add_settings_field( 'shiny_wordpress_auto_updates', __( 'WordPress' ), 'shiny_auto_updates_checkbox_field', 'shiny_auto_updates', 'shiny_auto_updates', array(
		'label_for'   => 'wp_auto_update_core',
		'label'       => __( 'Update WordPress automatically.' ),
		'description' => __( 'Minor versions of WordPress are automatically updated by default.' ),
	) );
	add_settings_field( 'shiny_plugin_auto_updates', __( 'Plugins' ), 'shiny_auto_updates_checkbox_field', 'shiny_auto_updates', 'shiny_auto_updates', array(
		'label_for' => 'wp_auto_update_plugins',
		'label'     => __( 'Update plugins automatically.' ),
	) );
	add_settings_field( 'shiny_theme_auto_updates', __( 'Themes' ), 'shiny_auto_updates_checkbox_field', 'shiny_auto_updates', 'shiny_auto_updates', array(
		'label_for' => 'wp_auto_update_themes',
		'label'     => __( 'Update themes automatically.' ),
	) );

	add_filter( 'sanitize_option_wp_auto_update_core',    'absint' );
	add_filter( 'sanitize_option_wp_auto_update_plugins', 'absint' );
	add_filter( 'sanitize_option_wp_auto_update_themes',  'absint' );
}
add_action( 'load-update-core.php', 'shiny_auto_updates' );

/**
 * Adds a notice when settings have been saved.
 */
function shiny_auto_updates_setting() {
	if ( isset( $_REQUEST['settings-updated'] ) ) {
		add_settings_error( 'shiny_auto_updates', 'settings_updated', __( 'Settings saved.' ), 'updated' );
	}
}
add_action( 'load-update-core.php', 'shiny_auto_updates_setting' );

/**
 * Displays notices if there are any.
 */
function shiny_auto_updates_notices() {
	settings_errors( 'shiny_auto_updates' );
}
add_action( 'all_admin_notices', 'shiny_auto_updates_notices' );

/**
 * Whitelists the new options.
 *
 * @param array $options
 * @return array
 */
function shiny_auto_updates_whitelist_options( $options ) {
	return array_merge( $options, array( 'shiny_auto_updates' => array( 'wp_auto_update_core', 'wp_auto_update_plugins', 'wp_auto_update_themes' ) ) );
}
add_action( 'whitelist_options', 'shiny_auto_updates_whitelist_options' );

/**
 * Section description.
 */
function shiny_auto_updates_description() {
	_e( 'A fancy description describing whats going on here.' );
}

/**
 * Renders the sample checkbox setting field.
 *
 * @param array $args
 */
function shiny_auto_updates_checkbox_field( $args ) {
	?>
	<label for="<?php echo esc_attr( $args['label_for'] ); ?>">
		<input type="checkbox" id="<?php echo esc_attr( $args['label_for'] ); ?>" name="<?php echo esc_attr( $args['label_for'] ); ?>" value="1" <?php checked( get_option( $args['label_for'], false ) ); ?> />
		<?php echo $args['label']; ?>
	</label>
	<?php if ( ! empty( $args['description'] ) ) : ?>
		<p class="description"><?php echo $args['description']; ?></p>
	<?php endif;
}


/**
 * Renders the auto update settings.
 */
function shiny_auto_updates_render() {
	echo '<form class="card" method="post" action="options.php">';
		settings_fields( 'shiny_auto_updates' );
		do_settings_sections( 'shiny_auto_updates' );
		submit_button();
	echo '</form>';
}
add_action( 'core_upgrade_preamble', 'shiny_auto_updates_render' );
