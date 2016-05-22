<?php
/**
 * Ajax callbacks for Shiny Updates.
 *
 * @package Shiny_Updates
 */

/**
 * AJAX handler for installing a theme.
 *
 * @since 4.X.0
 */
function wp_ajax_install_theme() {
	check_ajax_referer( 'updates' );

	if ( empty( $_POST['slug'] ) ) {
		wp_send_json_error( array(
			'slug'      => '',
			'errorCode' => 'no_theme_specified',
			'error'     => __( 'No theme specified.' ),
		) );
	}

	$status = array(
		'install' => 'theme',
		'slug'    => sanitize_key( $_POST['slug'] ),
	);

	if ( ! current_user_can( 'install_themes' ) ) {
		$status['error'] = __( 'You do not have sufficient permissions to install themes on this site.' );
		wp_send_json_error( $status );
	}

	include_once( ABSPATH . 'wp-admin/includes/class-wp-upgrader.php' );
	include_once( ABSPATH . 'wp-admin/includes/theme.php' );

	$api = themes_api( 'theme_information', array(
		'slug'   => $status['slug'],
		'fields' => array( 'sections' => false ),
	) );

	if ( is_wp_error( $api ) ) {
		$status['error'] = $api->get_error_message();
		wp_send_json_error( $status );
	}

	$upgrader = new Theme_Upgrader( new Automatic_Upgrader_Skin() );
	$result   = $upgrader->install( $api->download_link );

	if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
		$status['debug'] = $upgrader->skin->get_upgrade_messages();
	}

	if ( is_wp_error( $result ) ) {
		$status['error'] = $result->get_error_message();
		wp_send_json_error( $status );

	} else if ( is_null( $result ) ) {
		global $wp_filesystem;

		$status['errorCode'] = 'unable_to_connect_to_filesystem';
		$status['error']     = __( 'Unable to connect to the filesystem. Please confirm your credentials.' );

		// Pass through the error from WP_Filesystem if one was raised.
		if ( $wp_filesystem instanceof WP_Filesystem_Base && is_wp_error( $wp_filesystem->errors ) && $wp_filesystem->errors->get_error_code() ) {
			$status['error'] = $wp_filesystem->errors->get_error_message();
		}

		wp_send_json_error( $status );
	}

	// Never switch to theme (unlike plugin activation).
	// See WP_Theme_Install_List_Table::_get_theme_status() if we wanted to check on post-install status.
	wp_send_json_success( $status );
}

/**
 * AJAX handler for updating a theme.
 *
 * @since 4.X.0
 */
function wp_ajax_update_theme() {
	check_ajax_referer( 'updates' );

	if ( empty( $_POST['slug'] ) ) {
		wp_send_json_error( array(
			'slug'      => '',
			'errorCode' => 'no_theme_specified',
			'error'     => __( 'No theme specified.' ),
		) );
	}

	$stylesheet = sanitize_key( $_POST['slug'] );
	$status     = array(
		'update'     => 'theme',
		'slug'       => $stylesheet,
		'oldVersion' => sprintf( __( 'Version %s' ), wp_get_theme( $stylesheet )->get( 'Version' ) ),
		'newVersion' => '',
	);

	if ( ! current_user_can( 'update_themes' ) ) {
		$status['error'] = __( 'You do not have sufficient permissions to update themes on this site.' );
		wp_send_json_error( $status );
	}

	include_once( ABSPATH . 'wp-admin/includes/class-wp-upgrader.php' );

	$current = get_site_transient( 'update_themes' );
	if ( empty( $current ) ) {
		wp_update_themes();
	}

	$upgrader = new Theme_Upgrader( new Automatic_Upgrader_Skin() );
	$result   = $upgrader->bulk_upgrade( array( $stylesheet ) );

	if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
		$status['debug'] = $upgrader->skin->get_upgrade_messages();
	}

	if ( is_array( $result ) && ! empty( $result[ $stylesheet ] ) ) {

		// Theme is already at the latest version.
		if ( true === $result[ $stylesheet ] ) {
			$status['error'] = $upgrader->strings['up_to_date'];
			wp_send_json_error( $status );
		}

		$theme = wp_get_theme( $stylesheet );
		if ( $theme->get( 'Version' ) ) {
			$status['theme']      = wp_prepare_themes_for_js( array( $theme ) );
			$status['newVersion'] = sprintf( __( 'Version %s' ), $theme->get( 'Version' ) );
		}

		wp_send_json_success( $status );

	} else if ( is_wp_error( $result ) ) {
		$status['error'] = $result->get_error_message();
		wp_send_json_error( $status );

	} else if ( false === $result ) {
		global $wp_filesystem;

		$status['errorCode'] = 'unable_to_connect_to_filesystem';
		$status['error']     = __( 'Unable to connect to the filesystem. Please confirm your credentials.' );

		// Pass through the error from WP_Filesystem if one was raised.
		if ( $wp_filesystem instanceof WP_Filesystem_Base && is_wp_error( $wp_filesystem->errors ) && $wp_filesystem->errors->get_error_code() ) {
			$status['error'] = $wp_filesystem->errors->get_error_message();
		}

		wp_send_json_error( $status );
	}

	// An unhandled error occurred.
	$status['error'] = __( 'Update failed.' );
	wp_send_json_error( $status );
}

/**
 * AJAX handler for deleting a theme.
 *
 * @since 4.X.0
 */
function wp_ajax_delete_theme() {
	check_ajax_referer( 'updates' );

	if ( empty( $_POST['slug'] ) ) {
		wp_send_json_error( array(
			'slug'      => '',
			'errorCode' => 'no_theme_specified',
			'error'     => __( 'No theme specified.' ),
		) );
	}

	$stylesheet = sanitize_key( $_POST['slug'] );
	$status     = array(
		'delete' => 'theme',
		'slug'   => $stylesheet,
	);

	if ( ! current_user_can( 'delete_themes' ) ) {
		$status['error'] = __( 'You do not have sufficient permissions to delete themes on this site.' );
		wp_send_json_error( $status );
	}

	if ( ! wp_get_theme( $stylesheet )->exists() ) {
		$status['error'] = __( 'The requested theme does not exist.' );
		wp_send_json_error( $status );
	}

	// Check filesystem credentials. `delete_plugins()` will bail otherwise.
	ob_start();
	$url = wp_nonce_url( 'themes.php?action=delete&stylesheet=' . urlencode( $stylesheet ), 'delete-theme_' . $stylesheet );
	if ( false === ( $credentials = request_filesystem_credentials( $url ) ) || ! WP_Filesystem( $credentials ) ) {
		global $wp_filesystem;
		ob_end_clean();

		$status['errorCode'] = 'unable_to_connect_to_filesystem';
		$status['error']     = __( 'Unable to connect to the filesystem. Please confirm your credentials.' );

		// Pass through the error from WP_Filesystem if one was raised.
		if ( $wp_filesystem instanceof WP_Filesystem_Base && is_wp_error( $wp_filesystem->errors ) && $wp_filesystem->errors->get_error_code() ) {
			$status['error'] = $wp_filesystem->errors->get_error_message();
		}

		wp_send_json_error( $status );
	}

	include_once( ABSPATH . 'wp-admin/includes/theme.php' );

	$result = delete_theme( $stylesheet );

	if ( is_wp_error( $result ) ) {
		$status['error'] = $result->get_error_message();
		wp_send_json_error( $status );

	} elseif ( false === $result ) {
		$status['error'] = __( 'Theme could not be deleted.' );
		wp_send_json_error( $status );
	}

	wp_send_json_success( $status );
}

// No need to register the callback - we forgot to remove it from core in 4.2.
/**
 * AJAX handler for installing a plugin.
 *
 * @since 4.X.0
 */
function wp_ajax_install_plugin() {
	check_ajax_referer( 'updates' );

	if ( empty( $_POST['slug'] ) ) {
		wp_send_json_error( array( 'errorCode' => 'no_plugin_specified' ) );
	}

	$status = array(
		'install' => 'plugin',
		'slug'    => sanitize_key( $_POST['slug'] ),
	);

	if ( ! current_user_can( 'install_plugins' ) ) {
		$status['error'] = __( 'You do not have sufficient permissions to install plugins on this site.' );
		wp_send_json_error( $status );
	}

	include_once( ABSPATH . 'wp-admin/includes/class-wp-upgrader.php' );
	include_once( ABSPATH . 'wp-admin/includes/plugin-install.php' );

	$api = plugins_api( 'plugin_information', array(
		'slug'   => sanitize_key( $_POST['slug'] ),
		'fields' => array(
			'sections' => false,
		),
	) );

	if ( is_wp_error( $api ) ) {
		$status['error'] = $api->get_error_message();
		wp_send_json_error( $status );
	}

	$status['pluginName'] = $api->name;

	$upgrader = new Plugin_Upgrader( new Automatic_Upgrader_Skin() );
	$result = $upgrader->install( $api->download_link );

	if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
		$status['debug'] = $upgrader->skin->get_upgrade_messages();
	}

	if ( is_wp_error( $result ) ) {
		$status['error'] = $result->get_error_message();
		wp_send_json_error( $status );

	} else if ( is_null( $result ) ) {
		global $wp_filesystem;

		$status['errorCode'] = 'unable_to_connect_to_filesystem';
		$status['error']     = __( 'Unable to connect to the filesystem. Please confirm your credentials.' );

		// Pass through the error from WP_Filesystem if one was raised.
		if ( $wp_filesystem instanceof WP_Filesystem_Base && is_wp_error( $wp_filesystem->errors ) && $wp_filesystem->errors->get_error_code() ) {
			$status['error'] = $wp_filesystem->errors->get_error_message();
		}

		wp_send_json_error( $status );
	}

	wp_send_json_success( $status );
}

/**
 * AJAX handler for updating a plugin.
 *
 * @todo Merge: Replace wp_ajax_update_plugin()
 *
 * @since 4.2.0
 *
 * @see Plugin_Upgrader
 */
function wpsu_ajax_update_plugin() {
	check_ajax_referer( 'updates' );

	if ( empty( $_POST['plugin'] ) || empty( $_POST['slug'] ) ) {
		wp_send_json_error( array( 'errorCode' => 'no_plugin_specified' ) );
	}

	$plugin      = plugin_basename( sanitize_text_field( wp_unslash( $_POST['plugin'] ) ) );
	$plugin_data = get_plugin_data( WP_PLUGIN_DIR . '/' . $plugin );

	$status = array(
		'update'     => 'plugin',
		'plugin'     => $plugin,
		'slug'       => sanitize_key( wp_unslash( $_POST['slug'] ) ),
		'pluginName' => $plugin_data['Name'],
		'oldVersion' => '',
		'newVersion' => '',
	);

	if ( $plugin_data['Version'] ) {
		$status['oldVersion'] = sprintf( __( 'Version %s' ), $plugin_data['Version'] );
	}

	if ( ! current_user_can( 'update_plugins' ) ) {
		$status['error'] = __( 'You do not have sufficient permissions to update plugins for this site.' );
		wp_send_json_error( $status );
	}

	include_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';

	wp_update_plugins();

	$skin     = new Automatic_Upgrader_Skin();
	$upgrader = new Plugin_Upgrader( $skin );
	$result   = $upgrader->bulk_upgrade( array( $plugin ) );

	if ( is_array( $result ) && empty( $result[ $plugin ] ) && is_wp_error( $skin->result ) ) {
		$result = $skin->result;
	}

	if ( is_array( $result ) && ! empty( $result[ $plugin ] ) ) {
		$plugin_update_data = current( $result );

		/*
		 * If the `update_plugins` site transient is empty (e.g. when you update
		 * two plugins in quick succession before the transient repopulates),
		 * this may be the return.
		 *
		 * Preferably something can be done to ensure `update_plugins` isn't empty.
		 * For now, surface some sort of error here.
		 */
		if ( true === $plugin_update_data ) {
			$status['error'] = __( 'Plugin update failed.' );
			wp_send_json_error( $status );
		}

		$plugin_data = get_plugins( '/' . $result[ $plugin ]['destination_name'] );
		$plugin_data = reset( $plugin_data );

		if ( $plugin_data['Version'] ) {
			$status['newVersion'] = sprintf( __( 'Version %s' ), $plugin_data['Version'] );
		}
		wp_send_json_success( $status );

	} else if ( is_wp_error( $result ) ) {
		$status['error'] = $result->get_error_message();
		wp_send_json_error( $status );

	} else if ( false === $result ) {
		global $wp_filesystem;

		$status['errorCode'] = 'unable_to_connect_to_filesystem';
		$status['error'] = __( 'Unable to connect to the filesystem. Please confirm your credentials.' );

		// Pass through the error from WP_Filesystem if one was raised.
		if ( $wp_filesystem instanceof WP_Filesystem_Base && is_wp_error( $wp_filesystem->errors ) && $wp_filesystem->errors->get_error_code() ) {
			$status['error'] = $wp_filesystem->errors->get_error_message();
		}

		wp_send_json_error( $status );
	}

	// An unhandled error occurred.
	$status['error'] = __( 'Plugin update failed.' );
	wp_send_json_error( $status );
}

/**
 * AJAX handler for deleting a plugin.
 *
 * @since 4.X.0
 */
function wp_ajax_delete_plugin() {
	check_ajax_referer( 'updates' );

	if ( empty( $_POST['slug'] ) || empty( $_POST['plugin'] ) ) {
		wp_send_json_error( array( 'errorCode' => 'no_plugin_specified' ) );
	}

	$plugin      = plugin_basename( sanitize_text_field( wp_unslash( $_POST['plugin'] ) ) );
	$plugin_data = get_plugin_data( WP_PLUGIN_DIR . '/' . $plugin );

	$status = array(
		'delete'     => 'plugin',
		'slug'       => sanitize_key( wp_unslash( $_POST['slug'] ) ),
		'plugin'     => $plugin,
		'pluginName' => $plugin_data['Name'],
	);

	if ( ! current_user_can( 'delete_plugins' ) ) {
		$status['error'] = __( 'You do not have sufficient permissions to delete plugins for this site.' );
		wp_send_json_error( $status );
	}

	if ( is_plugin_active( $plugin ) ) {
		$status['error'] = __( 'You cannot delete a plugin while it is active on the main site.' );
		wp_send_json_error( $status );
	}

	// Check filesystem credentials. `delete_plugins()` will bail otherwise.
	ob_start();
	$url = wp_nonce_url( 'plugins.php?action=delete-selected&verify-delete=1&checked[]=' . $plugin, 'bulk-plugins' );
	if ( false === ( $credentials = request_filesystem_credentials( $url ) ) || ! WP_Filesystem( $credentials ) ) {
		global $wp_filesystem;
		ob_end_clean();

		$status['errorCode'] = 'unable_to_connect_to_filesystem';
		$status['error']     = __( 'Unable to connect to the filesystem. Please confirm your credentials.' );

		// Pass through the error from WP_Filesystem if one was raised.
		if ( $wp_filesystem instanceof WP_Filesystem_Base && is_wp_error( $wp_filesystem->errors ) && $wp_filesystem->errors->get_error_code() ) {
			$status['error'] = $wp_filesystem->errors->get_error_message();
		}

		wp_send_json_error( $status );
	}

	$result = delete_plugins( array( $plugin ) );

	if ( is_wp_error( $result ) ) {
		$status['error'] = $result->get_error_message();
		wp_send_json_error( $status );

	} elseif ( false === $result ) {
		$status['error'] = __( 'Plugin could not be deleted.' );
		wp_send_json_error( $status );
	}

	wp_send_json_success( $status );
}

/**
 * Ajax handler for searching plugins.
 *
 * @since 4.X.0
 *
 * @global WP_List_Table $wp_list_table
 * @global string        $hook_suffix
 */
function wp_ajax_search_plugins() {
	check_ajax_referer( 'updates' );

	global $wp_list_table, $hook_suffix;
	$hook_suffix = 'plugins.php';

	$status        = array();
	$wp_list_table = _get_list_table( 'WP_Plugins_List_Table' );

	if ( ! $wp_list_table->ajax_user_can() ) {
		$status['error'] = __( 'You do not have sufficient permissions to manage plugins on this site.' );
		wp_send_json_error( $status );
	}

	// Set the correct requester, so pagination works.
	$_SERVER['REQUEST_URI'] = add_query_arg( array_diff_key( $_POST, array( '_ajax_nonce' => null, 'action' => null ) ), '/wp-admin/plugins.php' );

	$wp_list_table->prepare_items();

	ob_start();
	$wp_list_table->display();
	$status['items'] = ob_get_clean();

	wp_send_json_success( $status );
}

/**
 * Ajax handler for searching plugins to install.
 *
 * @since 4.X.0
 *
 * @global WP_List_Table $wp_list_table
 * @global string        $hook_suffix
 */
function wp_ajax_search_install_plugins() {
	check_ajax_referer( 'updates' );

	global $wp_list_table, $hook_suffix;
	$hook_suffix = 'plugin-install.php';

	$status        = array();
	$wp_list_table = _get_list_table( 'WP_Plugin_Install_List_Table' );

	if ( ! $wp_list_table->ajax_user_can() ) {
		$status['error'] = __( 'You do not have sufficient permissions to manage plugins on this site.' );
		wp_send_json_error( $status );
	}

	// Set the correct requester, so pagination works.
	$_SERVER['REQUEST_URI'] = add_query_arg( array_diff_key( $_POST, array( '_ajax_nonce' => null, 'action' => null ) ), '/wp-admin/plugin-install.php' );

	$wp_list_table->prepare_items();

	ob_start();
	$wp_list_table->display();
	$status['items'] = ob_get_clean();

	wp_send_json_success( $status );
}

/**
 * AJAX handler for updating translations.
 *
 * @since 4.6.0
 *
 * @see Language_Pack_Upgrader
 */
function wp_ajax_update_translations() {
	check_ajax_referer( 'updates' );

	if ( ! current_user_can( 'update_core' ) && ! current_user_can( 'update_plugins' ) && ! current_user_can( 'update_themes' ) ) {
		$status['error'] = __( 'You do not have sufficient permissions to update this site.' );
		wp_send_json_error( $status );
	}

	include_once( ABSPATH . 'wp-admin/includes/class-wp-upgrader.php' );

	$url     = 'update-core.php?action=do-translation-upgrade';
	$nonce   = 'upgrade-translations';
	$title   = __( 'Update Translations' );
	$context = WP_CONTENT_DIR;

	$skin     = new Automatic_Upgrader_Skin( compact( 'url', 'nonce', 'title', 'context' ) );
	$upgrader = new Language_Pack_Upgrader( $skin );
	$result   = $upgrader->bulk_upgrade();

	$status = array(
		'update' => 'translation',
	);

	if ( is_array( $result ) && is_wp_error( $skin->result ) ) {
		$result = $skin->result;
	}

	if ( is_array( $result ) && ! empty( $result[0] ) ) {
		wp_send_json_success( $status );
	} else if ( is_wp_error( $result ) ) {
		$status['error'] = $result->get_error_message();
		wp_send_json_error( $status );
	} else if ( false === $result ) {
		global $wp_filesystem;

		$status['errorCode'] = 'unable_to_connect_to_filesystem';
		$status['error']     = __( 'Unable to connect to the filesystem. Please confirm your credentials.' );

		// Pass through the error from WP_Filesystem if one was raised.
		if ( $wp_filesystem instanceof WP_Filesystem_Base && is_wp_error( $wp_filesystem->errors ) && $wp_filesystem->errors->get_error_code() ) {
			$status['error'] = $wp_filesystem->errors->get_error_message();
		}

		wp_send_json_error( $status );
	}

	// An unhandled error occurred.
	$status['error'] = __( 'Translations update failed.' );
	wp_send_json_error( $status );
}


/**
 * AJAX handler for updating core.
 *
 * @since 4.6.0
 *
 * @see Core_Upgrader
 */
function wp_ajax_update_core() {
	check_ajax_referer( 'updates' );

	if ( ! current_user_can( 'update_core' ) ) {
		$status['error'] = __( 'You do not have sufficient permissions to update this site.' );
		wp_send_json_error( $status );
	}

	$reinstall = isset( $_POST['reinstall'] ) ? (bool) $_POST['reinstall'] : false;

	$version = isset( $_POST['version'] ) ? sanitize_text_field( wp_unslash( $_POST['version'] ) ) : false;
	$locale  = isset( $_POST['locale'] ) ? sanitize_text_field( wp_unslash( $_POST['locale'] ) ) : 'en_US';

	$update = find_core_update( $version, $locale );

	if ( ! $update ) {
		return;
	}

	$status = array(
		'update'   => 'core',
		'redirect' => esc_url( self_admin_url( 'about.php?updated' ) ),
	);

	include_once( ABSPATH . 'wp-admin/includes/class-wp-upgrader.php' );

	if ( $reinstall ) {
		$update->response = 'reinstall';
	}

	$url     = 'update-core.php?action=do-core-upgrade';
	$nonce   = 'upgrade-translations';
	$title   = __( 'Update Core' );
	$context = ABSPATH;

	$skin     = new Automatic_Upgrader_Skin( compact( 'url', 'nonce', 'title', 'context' ) );
	$upgrader = new Core_Upgrader( $skin );
	$result   = $upgrader->upgrade( $update, array(
		'allow_relaxed_file_ownership' => ! $reinstall && isset( $update->new_files ) && ! $update->new_files,
	) );

	if ( is_array( $result ) && ! empty( $result[0] ) ) {
		wp_send_json_success( $status );
	} else if ( is_wp_error( $result ) ) {
		$status['error'] = $result->get_error_message();
		wp_send_json_error( $status );
	} else if ( false === $result ) {
		// These aren't actual errors.
		$status['error'] = __( 'Installation Failed' );
		wp_send_json_error( $status );
	}

	// An unhandled error occurred.
	$status['error'] = __( 'Installation failed.' );
	wp_send_json_error( $status );
}
