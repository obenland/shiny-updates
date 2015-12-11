<?php
/*
 * Plugin Name: Shiny Updates
 * Description: Hide the ugly parts of updating WordPress.
 * Author: the WordPress team
 * Version: 2
 * License: GPL2
 */

class Shiny_Updates {

	/**
	 * @return Shiny_Updates
	 */
	static function init() {
		static $instance;

		if ( empty( $instance ) ) {
			$instance = new Shiny_Updates();
		}

		return $instance;
	}

	/**
	 * Constructor.
	 */
	function __construct() {
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_scripts' ) );

		// Add the update HTML for plugin updates progress.
		add_action( 'pre_current_active_plugins', array( $this, 'wp_update_notification_template' ) );

		// Search plugins
		add_action( 'wp_ajax_search-plugins', 'wp_ajax_search_plugins' );

		// Plugin deletions.
		add_action( 'wp_ajax_delete-plugin', 'wp_ajax_delete_plugin' );

		// Plugin activations.
		add_action( 'wp_ajax_activate-plugin', array( $this, 'wp_ajax_activate_plugin' ) );

		// Plugin row actions.
		add_filter( 'plugin_action_links', array( $this, 'plugin_action_links' ), 10, 4 );

		// Themes.
		add_filter( 'wp_prepare_themes_for_js', array( $this, 'theme_data' ) );

		// Update Themes.
		add_action( 'admin_footer-themes.php', array( $this, 'admin_footer' ) );
		add_action( 'wp_ajax_install-theme', 'wp_ajax_install_theme' );

		// Install Themes.
		add_action( 'admin_footer-theme-install.php', array( $this, 'admin_footer' ) );
		add_action( 'wp_ajax_update-theme', 'wp_ajax_update_theme' );

		// Delete Themes.
		add_action( 'wp_ajax_delete-theme', 'wp_ajax_delete_theme' );

		// Auto Updates.
		add_action( 'admin_init', array( $this, 'load_auto_updates_settings' ) );

		if ( get_option( 'wp_auto_update_core' ) ) {
			add_filter( 'allow_major_auto_core_updates', '__return_true' );
		}
		if ( get_option( 'wp_auto_update_plugins' ) ) {
			add_filter( 'auto_update_plugin', '__return_true' );
		}
		if ( get_option( 'wp_auto_update_themes' ) ) {
			add_filter( 'auto_update_theme', '__return_true' );
		}
	}

	/**
	 * Add the HTML template for progress updates.
	 */
	function wp_update_notification_template() {
		?>
		<div id="wp-progress-placeholder"></div>
		<script id="tmpl-wp-progress-template" type="text/html">
			<div class="notice wp-progress-update <# if ( data.noticeClass ) { #> {{ data.noticeClass }} <# } #>">
				<p>
					<# if ( data.message ) { #>
						{{ data.message }}
					<# } #>
				</p>
			</div>
		</script>
		<?php
	}

	/**
	 * Enqueue scripts.
	 *
	 * @param string $hook Current admin page.
	 */
	function enqueue_scripts( $hook ) {
		if ( ! in_array( $hook, array( 'plugins.php', 'plugin-install.php', 'themes.php', 'theme-install.php' ) ) ) {
			return;
		}

		wp_enqueue_style( 'shiny-updates', plugin_dir_url( __FILE__ ) . 'css/shiny-updates.css' );

		wp_enqueue_script( 'shiny-updates', plugin_dir_url( __FILE__ ) . 'js/shiny-updates.js', array( 'updates' ), null, true );
		wp_localize_script( 'shiny-updates', 'shinyUpdates', array(
			'installNow'                => __( 'Install Now' ),
			'installing'                => __( 'Installing...' ),
			'installed'                 => __( 'Installed!' ),
			'installFailedShort'        => __( 'Install Failed!' ),
			/* translators: Error string for a failed installation. */
			'installFailed'             => __( 'Installation failed: %s' ),
			/* translators: Plugin/Theme name and version */
			'installingLabel'           => __( 'Installing %s...' ), // no ellipsis
			/* translators: Plugin/Theme name and version */
			'installedLabel'            => __( '%s installed!' ),
			/* translators: Plugin/Theme name and version */
			'installFailedLabel'        => __( '%s installation failed' ),
			'installingMsg'             => __( 'Installing... please wait.' ),
			'installedMsg'              => __( 'Installation completed successfully.' ),
			'aysDelete'                 => __( 'Are you sure you want to delete this plugin?' ),
			'deletinggMsg'              => __( 'Deleting... please wait.' ),
			'deletedMsg'                => __( 'Plugin successfully deleted.' ),
			'updatedPluginsMsg'         => __( 'Plugin updates complete.' ),
			/* translators: 1. Plugins update successes. 2. Plugin update failures. */
			'updatedPluginsSuccessMsg'  => __( 'Successes: %d.' ),
			/* translators: 1. Plugins update successes. 2. Plugin update failures. */
			'updatedPluginsFailureMsg'  => __( 'Failures: %d.' ),
			/* translators: 1. Total plugins to update. */
			'updatePluginsQueuedMsg'    => __( '%d plugin updates queued.' ),
			'updateQueued'              => __( 'Update queued.')
		) );

		if ( in_array( $hook, array( 'themes.php', 'theme-install.php' ) ) ) {
			wp_enqueue_script( 'shiny-theme-updates', plugin_dir_url( __FILE__ ) . 'js/shiny-theme-updates.js', array( 'theme', 'updates' ), null, true );
		}

		if ( 'theme-install.php' == $hook ) {
			add_action( 'in_admin_header', array( $this, 'theme_install_templates' ) );
		}
		if ( 'plugins.php' === $hook ) {
			wp_localize_script( 'shiny-updates', 'pluginData', get_plugins() );
		}
	}

	/**
	 * Filter the action links displayed for each plugin in the Plugins list table.
	 *
	 * @param array  $actions     An array of plugin action links.
	 * @param string $plugin_file Path to the plugin file relative to the plugins directory.
	 * @param array  $plugin_data An array of plugin data.
	 * @param string $context     The plugin context.
	 * @return array
	 */
	function plugin_action_links( $actions, $plugin_file, $plugin_data, $context ) {
		// Adjust the delete action, adding data attributes.
		if ( ! empty( $actions['delete'] ) ) {
			$slug = empty( $plugin_data['slug'] ) ? dirname( $plugin_file ) : $plugin_data['slug'];
			$actions['delete'] = '<a data-plugin="' . $plugin_file . '" data-slug="' . $slug . '" href="' . wp_nonce_url( 'plugins.php?action=delete-selected&amp;checked[]=' . $plugin_file . '&amp;plugin_status=' . $context . '&amp;paged=' . $GLOBALS['page'] . '&amp;s=' . $GLOBALS['s'], 'bulk-plugins' ) . '" class="delete" aria-label="' . esc_attr( sprintf( __( 'Delete %s' ), $plugin_data['Name'] ) ) . '">' . __( 'Delete' ) . '</a>';
		}

		// Adjust the activate action, adding data attributes.
		if ( ! empty( $actions['activate'] ) ) {
			$slug = empty( $plugin_data['slug'] ) ? dirname( $plugin_file ) : $plugin_data['slug'];
			$actions['activate'] = '<a data-plugin="' . $plugin_file . '" data-slug="' . $slug . '" href="' . wp_nonce_url( 'plugins.php?action=activate-selected&amp;checked[]=' . $plugin_file . '&amp;plugin_status=' . $context . '&amp;paged=' . $GLOBALS['page'] . '&amp;s=' . $GLOBALS['s'], 'bulk-plugins' ) . '" class="edit" aria-label="' . esc_attr( sprintf( __( 'Activate %s' ), $plugin_data['Name'] ) ) . '">' . __( 'Activate' ) . '</a>';
		}

		return $actions;
	}

	/**
	 * Adds a class and a data attribute to the "update now"-link.
	 *
	 * @param array $themes
	 * @return array
	 */
	function theme_data( $themes ) {
		$update = get_site_transient('update_themes');
		foreach ( $themes as $stylesheet => $theme ) {
			if ( isset( $theme['hasUpdate'] ) && $theme['hasUpdate'] && current_user_can('update_themes') && ! empty( $update->response[ $stylesheet ] ) ) {
				$themes[ $stylesheet ]['update'] = sprintf( '<p><strong>' . __( 'There is a new version of %1$s available. <a href="%2$s" class="thickbox" title="%3$s">View version %4$s details</a> or <a id="update-theme" data-slug="%5$s" href="%6$s">update now</a>.' ) . '</strong></p>',
					$theme['name'], esc_url( add_query_arg(array('TB_iframe' => 'true', 'width' => 1024, 'height' => 800), $update->response[ $stylesheet ]['url']) ), esc_attr( $theme['name'] ), $update->response[ $stylesheet ]['new_version'], $stylesheet, wp_nonce_url( admin_url( 'update.php?action=upgrade-theme&amp;theme=' . urlencode( $stylesheet ) ), 'upgrade-theme_' . $stylesheet ) );
			}
		}
		return $themes;
	}

	/**
	 * Prints filesystem credential modal if needed.
	 *
	 * Needs to be added to `themes.php`.
	 */
	function admin_footer() {
		wp_print_request_filesystem_credentials_modal();
	}

	/**
	 * Templates here can replace core templates.
	 */
	function theme_install_templates() {
		?>
		<script id="tmpl-theme" type="text/template">
			<# if ( data.screenshot_url ) { #>
				<div class="theme-screenshot">
					<img src="{{ data.screenshot_url }}" alt="" />
				</div>
			<# } else { #>
				<div class="theme-screenshot blank"></div>
			<# } #>
			<span class="more-details"><?php _ex( 'Details &amp; Preview', 'theme' ); ?></span>
			<div class="theme-author"><?php printf( __( 'By %s' ), '{{ data.author }}' ); ?></div>
			<h3 class="theme-name">{{ data.name }}</h3>

			<div class="theme-actions">
				<a class="button button-primary theme-install" data-slug="{{ data.id }}" href="{{ data.install_url }}"><?php esc_html_e( 'Install' ); ?></a>
				<a class="button button-secondary preview install-theme-preview" href="#"><?php esc_html_e( 'Preview' ); ?></a>
			</div>

			<# if ( data.installed ) { #>
				<div class="theme-installed"><?php _ex( 'Already Installed', 'theme' ); ?></div>
			<# } #>
		</script>

		<script id="tmpl-shiny-theme-preview" type="text/template">
			<div class="wp-full-overlay-sidebar">
				<div class="wp-full-overlay-header">
					<a href="#" class="close-full-overlay"><span class="screen-reader-text"><?php _e( 'Close' ); ?></span></a>
					<a href="#" class="previous-theme"><span class="screen-reader-text"><?php _ex( 'Previous', 'Button label for a theme' ); ?></span></a>
					<a href="#" class="next-theme"><span class="screen-reader-text"><?php _ex( 'Next', 'Button label for a theme' ); ?></span></a>
					<# if ( data.installed ) { #>
						<a href="#" class="button button-primary theme-install disabled"><?php _ex( 'Installed', 'theme' ); ?></a>
					<# } else { #>
						<a href="{{ data.install_url }}" class="button button-primary theme-install" data-slug="{{ data.id }}"><?php _e( 'Install' ); ?></a>
					<# } #>
				</div>
				<div class="wp-full-overlay-sidebar-content">
					<div class="install-theme-info">
						<h3 class="theme-name">{{ data.name }}</h3>
						<span class="theme-by"><?php printf( __( 'By %s' ), '{{ data.author }}' ); ?></span>

						<img class="theme-screenshot" src="{{ data.screenshot_url }}" alt="" />

						<div class="theme-details">
							<# if ( data.rating ) { #>
								<div class="theme-rating">
									{{{ data.stars }}}
									<span class="num-ratings">({{ data.num_ratings }})</span>
								</div>
							<# } else { #>
								<span class="no-rating"><?php _e( 'This theme has not been rated yet.' ); ?></span>
							<# } #>
								<div class="theme-version"><?php printf( __( 'Version: %s' ), '{{ data.version }}' ); ?></div>
								<div class="theme-description">{{{ data.description }}}</div>
						</div>
					</div>
				</div>
				<div class="wp-full-overlay-footer">
					<button type="button" class="collapse-sidebar button-secondary" aria-expanded="true" aria-label="<?php esc_attr_e( 'Collapse Sidebar' ); ?>">
						<span class="collapse-sidebar-arrow"></span>
						<span class="collapse-sidebar-label"><?php _e( 'Collapse' ); ?></span>
					</button>
				</div>
			</div>
			<div class="wp-full-overlay-main">
				<iframe src="{{ data.preview_url }}" title="<?php esc_attr_e( 'Preview' ); ?>" />
			</div>
		</script>
<?php
	}

	/**
	 * Loads auto updates settings for `update-core.php`.
	 */
	public function load_auto_updates_settings() {
		include_once plugin_dir_path( __FILE__ ) . 'auto-updates.php';
	}
}
add_action( 'init', array( 'Shiny_Updates', 'init' ) );

/**
 * AJAX handler for activating a plugin.
 */
function wp_ajax_activate_plugin() {

}

/**
 * AJAX handler for installing a theme.
 *
 * @since 4.5.0
 */
function wp_ajax_install_theme() {
	$status = array(
		'install' => 'theme',
		'slug'    => sanitize_key( $_POST['slug'] ),
	);

	if ( ! current_user_can( 'install_themes' ) ) {
		$status['error'] = __( 'You do not have sufficient permissions to install themes on this site.' );
		wp_send_json_error( $status );
	}

	check_ajax_referer( 'updates' );

	include_once( ABSPATH . 'wp-admin/includes/class-wp-upgrader.php' );
	include_once( ABSPATH . 'wp-admin/includes/theme.php' );

	$api = themes_api( 'theme_information', array(
		'slug'   => $status['slug'],
		'fields' => array( 'sections' => false )
	) );

	if ( is_wp_error( $api ) ) {
		$status['error'] = $api->get_error_message();
		wp_send_json_error( $status );
	}

	$upgrader = new Theme_Upgrader( new Automatic_Upgrader_Skin() );
	$result   = $upgrader->install( $api->download_link );

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
 * @since 4.5.0
 */
function wp_ajax_update_theme() {
	check_ajax_referer( 'updates' );

	$stylesheet = sanitize_key( $_POST['slug'] );
	$status     = array(
		'update'     => 'theme',
		'slug'       => $stylesheet,
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

	if ( is_array( $result ) && ! empty( $result[ $stylesheet ] ) ) {

		// Theme is already at the latest version.
		if ( true === $result[ $stylesheet ] ) {
			$status['error'] = $upgrader->strings['up_to_date'];
			wp_send_json_error( $status );
		}

		$theme = wp_get_theme( $stylesheet );
		if ( $theme->get( 'Version' ) ) {
			$status['newVersion'] = sprintf( __( 'Version: %s' ), $theme->get( 'Version' ) );
		}

		wp_send_json_success( $status );

	} else if ( is_wp_error( $result ) ) {
		$status['error'] = $result->get_error_message();
		wp_send_json_error( $status );

	} else if ( is_bool( $result ) && ! $result ) {
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
 * @since 4.5.0
 */
function wp_ajax_delete_theme() {
	check_ajax_referer( 'updates' );

	$stylesheet = sanitize_key( $_POST['slug'] );
	$status     = array(
		'update' => 'theme',
		'slug'   => $stylesheet,
	);

	if ( ! current_user_can( 'delete_themes' ) ) {
		$status['error'] = __( 'You do not have sufficient permissions to delete themes on this site.' );
		wp_send_json_error( $status );
	}

	if (  wp_get_theme( $stylesheet )->exists() ) {
		$status['error'] = __( 'The requested theme does not exist.' );
		wp_send_json_error( $status );
	}

	include_once( ABSPATH . 'wp-admin/includes/theme.php' );

	$result = delete_theme( $stylesheet );

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
 * AJAX handler for deleting a plugin.
 *
 * @since 4.5.0
 */
function wp_ajax_delete_plugin() {
	check_ajax_referer( 'updates' );

	$plugin      = urldecode( $_POST['plugin'] );
	$plugin_data = get_plugin_data( WP_PLUGIN_DIR . '/' . $plugin );

	$status = array(
		'delete' => 'plugin',
		'id'     => sanitize_title( $plugin_data['Name'] ),
		'slug'   => sanitize_key( $_POST['slug'] ),
		'plugin' => $plugin,
	);

	if ( ! current_user_can( 'delete_plugins' ) ) {
		$status['error'] = __( 'You do not have sufficient permissions to delete plugins for this site.' );
		wp_send_json_error( $status );
	}

	if ( ! is_plugin_inactive( $plugin ) ) {
		$status['error'] = __( 'You cannot delete a plugin while it is active on the main site.' );
		wp_send_json_error( $status );
	}

	$delete_result = delete_plugins( array( $plugin ) );

	if ( is_wp_error( $delete_result ) ) {
		$status['error'] = $delete_result->get_error_message();
		wp_send_json_error( $status );

	} else if ( is_null( $delete_result ) ) {
		global $wp_filesystem;

		$status['errorCode'] = 'unable_to_connect_to_filesystem';
		$status['error']     = __( 'Unable to connect to the filesystem. Please confirm your credentials.' );

		// Pass through the error from WP_Filesystem if one was raised.
		if ( is_wp_error( $wp_filesystem->errors ) && $wp_filesystem->errors->get_error_code() ) {
			$status['error'] = $wp_filesystem->errors->get_error_message();
		}

		wp_send_json_error( $status );

	} elseif ( false === $delete_result ) {
		$status['error'] = __( 'Plugin could not be deleted.' );
		wp_send_json_error( $status );
	}

	wp_send_json_success( $status );
}

// No need to register the callback - we forgot to remove it from core in 4.2.
/**
 * AJAX handler for installing a plugin.
 *
 * @since 4.5.0
 */
function wp_ajax_install_plugin() {
	check_ajax_referer( 'updates' );

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

	$upgrader = new Plugin_Upgrader( new Automatic_Upgrader_Skin() );
	$result = $upgrader->install( $api->download_link );

	if ( is_wp_error( $result ) ) {
		$status['error'] = $result->get_error_message();
		wp_send_json_error( $status );

	} else if ( is_null( $result ) ) {
		global $wp_filesystem;

		$status['errorCode'] = 'unable_to_connect_to_filesystem';
		$status['error']     = __( 'Unable to connect to the filesystem. Please confirm your credentials.' );

		// Pass through the error from WP_Filesystem if one was raised.
		if ( is_wp_error( $wp_filesystem->errors ) && $wp_filesystem->errors->get_error_code() ) {
			$status['error'] = $wp_filesystem->errors->get_error_message();
		}

		wp_send_json_error( $status );
	}

	wp_send_json_success( $status );
}


/**
 * Ajax handler for searching plugins.
 *
 * @since 4.5.0
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

	$wp_list_table->prepare_items();

	ob_start();
	$wp_list_table->display_rows_or_placeholder();
	$status['items'] = ob_get_clean();

	wp_send_json_success( $status );
}
