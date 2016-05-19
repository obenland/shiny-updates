<?php
/**
 * Changes to wp-admin/includes/update.php
 *
 * Only wp_plugin_update_row() and wp_theme_update_row() need to be changed.
 *
 * @package Shiny_Updates
 */

/**
 * Replace update row functions with our own.
 */
function su_new_update_rows() {
	remove_action( 'admin_init', 'wp_plugin_update_rows' );
	remove_action( 'admin_init', 'wp_theme_update_rows' );
	add_action( 'admin_init', 'su_plugin_update_rows' );
	add_action( 'admin_init', 'su_theme_update_rows' );
}

add_action( 'admin_init', 'su_new_update_rows', 1 );

/**
 * Register plugin update rows.
 *
 * @since 2.9.0
 */
function su_plugin_update_rows() {
	if ( ! current_user_can( 'update_plugins' ) ) {
		return;
	}

	$plugins = get_site_transient( 'update_plugins' );
	if ( isset( $plugins->response ) && is_array( $plugins->response ) ) {
		$plugins = array_keys( $plugins->response );
		foreach ( $plugins as $plugin_file ) {
			add_action( "after_plugin_row_$plugin_file", 'su_plugin_update_row', 10, 2 );
		}
	}
}

/**
 * Register theme update rows.
 *
 * @since 3.1.0
 */
function su_theme_update_rows() {
	if ( ! current_user_can( 'update_themes' ) ) {
		return;
	}

	$themes = get_site_transient( 'update_themes' );
	if ( isset( $themes->response ) && is_array( $themes->response ) ) {
		$themes = array_keys( $themes->response );

		foreach ( $themes as $theme ) {
			add_action( "after_theme_row_$theme", 'su_theme_update_row', 10, 2 );
		}
	}
}

/**
 * Displays update information for a plugin.
 *
 * @param string $file        Plugin basename.
 * @param array  $plugin_data Plugin information.
 *
 * @return false|void
 */
function su_plugin_update_row( $file, $plugin_data ) {
	$current = get_site_transient( 'update_plugins' );
	if ( ! isset( $current->response[ $file ] ) ) {
		return false;
	}

	$r = $current->response[ $file ];

	$plugins_allowedtags = array(
		'a'       => array( 'href' => array(), 'title' => array() ),
		'abbr'    => array( 'title' => array() ),
		'acronym' => array( 'title' => array() ),
		'code'    => array(),
		'em'      => array(),
		'strong'  => array(),
	);

	$plugin_name   = wp_kses( $plugin_data['Name'], $plugins_allowedtags );
	$details_url   = self_admin_url( 'plugin-install.php?tab=plugin-information&plugin=' . $r->slug . '&section=changelog&TB_iframe=true&width=600&height=800' );
	$wp_list_table = _get_list_table( 'WP_Plugins_List_Table' );

	if ( is_network_admin() || ! is_multisite() ) {
		if ( is_network_admin() ) {
			$active_class = is_plugin_active_for_network( $file ) ? ' active' : '';
		} else {
			$active_class = is_plugin_active( $file ) ? ' active' : '';
		}

		echo '<tr class="plugin-update-tr' . $active_class . '" id="' . esc_attr( $r->slug . '-update' ) . '" data-slug="' . esc_attr( $r->slug ) . '" data-plugin="' . esc_attr( $file ) . '"><td colspan="' . esc_attr( $wp_list_table->get_column_count() ) . '" class="plugin-update colspanchange"><div class="update-message notice inline notice-warning notice-alt"><p>';

		if ( ! current_user_can( 'update_plugins' ) ) {
			/* translators: 1: plugin name, 2: details URL, 3: escaped plugin name, 4: version number */
			printf( __( 'There is a new version of %1$s available. <a href="%2$s" class="thickbox open-plugin-details-modal" aria-label="View %3$s version %4$s details">View version %4$s details</a>.' ),
				$plugin_name,
				esc_url( $details_url ),
				esc_attr( $plugin_name ),
				$r->new_version
			);
		} elseif ( empty( $r->package ) ) {
			/* translators: 1: plugin name, 2: details URL, 3: escaped plugin name, 4: version number */
			printf( __( 'There is a new version of %1$s available. <a href="%2$s" class="thickbox open-plugin-details-modal" aria-label="View %3$s version %4$s details">View version %4$s details</a>. <em>Automatic update is unavailable for this plugin.</em>' ),
				$plugin_name,
				esc_url( $details_url ),
				esc_attr( $plugin_name ),
				$r->new_version
			);
		} else {
			/* translators: 1: plugin name, 2: details URL, 3: escaped plugin name, 4: version number, 5: update URL */
			printf( __( 'There is a new version of %1$s available. <a href="%2$s" class="thickbox open-plugin-details-modal" aria-label="View %3$s version %4$s details">View version %4$s details</a> or <a href="%5$s" class="update-link" aria-label="update %3$s now">update now</a>.' ),
				$plugin_name,
				esc_url( $details_url ),
				esc_attr( $plugin_name ),
				$r->new_version,
				wp_nonce_url( self_admin_url( 'update.php?action=upgrade-plugin&plugin=' ) . $file, 'upgrade-plugin_' . $file )
			);
		}

		/**
		 * Fires at the end of the update message container in each
		 * row of the plugins list table.
		 *
		 * The dynamic portion of the hook name, `$file`, refers to the path
		 * of the plugin's primary file relative to the plugins directory.
		 *
		 * @since 2.8.0
		 *
		 * @param array $plugin_data {
		 *                           An array of plugin metadata.
		 *
		 * @type string $name        The human-readable name of the plugin.
		 * @type string $plugin_uri  Plugin URI.
		 * @type string $version     Plugin version.
		 * @type string $description Plugin description.
		 * @type string $author      Plugin author.
		 * @type string $author_uri  Plugin author URI.
		 * @type string $text_domain Plugin text domain.
		 * @type string $domain_path Relative path to the plugin's .mo file(s).
		 * @type bool   $network     Whether the plugin can only be activated network wide.
		 * @type string $title       The human-readable title of the plugin.
		 * @type string $author_name Plugin author's name.
		 * @type bool   $update      Whether there's an available update. Default null.
		 * }
		 *
		 * @param array $r           {
		 *                           An array of metadata about the available plugin update.
		 *
		 * @type int    $id          Plugin ID.
		 * @type string $slug        Plugin slug.
		 * @type string $new_version New plugin version.
		 * @type string $url         Plugin URL.
		 * @type string $package     Plugin update package URL.
		 * }
		 */
		do_action( "in_plugin_update_message-{$file}", $plugin_data, $r );

		echo '</p></div></td></tr>';
	}
}

/**
 * Displays update information for a theme.
 *
 * @param string   $theme_key Theme stylesheet.
 * @param WP_Theme $theme     Theme object.
 *
 * @return false|void
 */
function su_theme_update_row( $theme_key, $theme ) {
	$current = get_site_transient( 'update_themes' );

	if ( ! isset( $current->response[ $theme_key ] ) ) {
		return false;
	}

	$response = $current->response[ $theme_key ];

	$details_url = add_query_arg( array(
		'TB_iframe' => 'true',
		'width'     => 1024,
		'height'    => 800,
	), $current->response[ $theme_key ]['url'] );

	$wp_list_table = _get_list_table( 'WP_MS_Themes_List_Table' );

	$active = $theme->is_allowed( 'network' ) ? ' active' : '';

	echo '<tr class="plugin-update-tr' . $active . '" id="' . esc_attr( $theme->get_stylesheet() . '-update' ) . '" data-slug="' . esc_attr( $theme->get_stylesheet() ) . '"><td colspan="' . $wp_list_table->get_column_count() . '" class="plugin-update colspanchange"><div class="update-message notice inline notice-warning notice-alt"><p>';
	if ( ! current_user_can( 'update_themes' ) ) {
		/* translators: 1: theme name, 2: details URL, 3: escaped theme name, 4: version number */
		printf( __( 'There is a new version of %1$s available. <a href="%2$s" class="thickbox open-plugin-details-modal" aria-label="View %3$s version %4$s details">View version %4$s details</a>.' ),
			$theme['Name'],
			esc_url( $details_url ),
			esc_attr( $theme['Name'] ),
			$response->new_version
		);
	} elseif ( empty( $response['package'] ) ) {
		/* translators: 1: theme name, 2: details URL, 3: escaped theme name, 4: version number */
		printf( __( 'There is a new version of %1$s available. <a href="%2$s" class="thickbox open-plugin-details-modal" aria-label="View %3$s version %4$s details">View version %4$s details</a>. <em>Automatic update is unavailable for this theme.</em>' ),
			$theme['Name'],
			esc_url( $details_url ),
			esc_attr( $theme['Name'] ),
			$response['new_version']
		);
	} else {
		/* translators: 1: theme name, 2: details URL, 3: escaped theme name, 4: version number, 5: update URL */
		printf( __( 'There is a new version of %1$s available. <a href="%2$s" class="thickbox open-plugin-details-modal" aria-label="View %3$s version %4$s details">View version %4$s details</a> or <a href="%5$s" class="update-link" aria-label="update %3$s now">update now</a>.' ),
			$theme['Name'],
			esc_url( $details_url ),
			esc_attr( $theme['Name'] ),
			$response['new_version'],
			wp_nonce_url( self_admin_url( 'update.php?action=upgrade-theme&theme=' ) . $theme_key, 'upgrade-theme_' . $theme_key )
		);
	}

	/**
	 * Fires at the end of the update message container in each
	 * row of the themes list table.
	 *
	 * The dynamic portion of the hook name, `$theme_key`, refers to
	 * the theme slug as found in the WordPress.org themes repository.
	 *
	 * @since 3.1.0
	 *
	 * @param WP_Theme $theme       The WP_Theme object.
	 * @param array    $response           {
	 *                              An array of metadata about the available theme update.
	 *
	 * @type string    $new_version New theme version.
	 * @type string    $url         Theme URL.
	 * @type string    $package     Theme update package URL.
	 * }
	 */
	do_action( "in_theme_update_message-{$theme_key}", $theme, $response );

	echo '</p></div></td></tr>';
}

/**
 * Displays the shiny update table.
 *
 * Includes core, plugin and theme updates.
 *
 * @global string $wp_version The current WordPress version.
 */
function su_update_table() {
	global $wp_version;
	?>
	<div class="wordpress-updates-table">
		<?php
		require_once( 'class-shiny-updates-list-table.php' );

		// Todo: Use _get_list_table().
		$updates_table = new Shiny_Updates_List_Table();
		$updates_table->prepare_items();
		$updates_table->display();
		?>
	</div>

	<?php
	$core_updates = (array) get_core_updates();

	if ( ! isset( $core_updates[1] ) ) {
		return;
	}

	$update = $core_updates[1];

	if ( 'en_US' == $update->locale &&
	     'en_US' == get_locale() ||
	     (
		     $update->packages->partial &&
		     $wp_version === $update->partial_version &&
		     1 === count( $core_updates )
	     )
	) {
		$version_string = $update->current;
	} else {
		$version_string = sprintf( '%s&ndash;<code>%s</code>', $update->current, $update->locale );
	}

	if ( isset( $update->response ) && 'latest' !== $update->response ) {
		return;
	}
	?>
	<div class="wordpress-reinstall-card card" data-type="core" data-version="<?php echo esc_attr( $update->current ); ?>" data-locale="<?php echo esc_attr( $update->locale ); ?>">
		<h2><?php _e( 'Need to re-install WordPress?' ); ?></h2>
		<p>
			<?php printf( __( 'If you need to re-install version %s, you can do so here.' ), $version_string ); ?>
		</p>

		<form method="post" action="update-core.php?action=do-core-reinstall" name="upgrade" class="upgrade">
			<?php wp_nonce_field( 'upgrade-core' ); ?>
			<input name="version" value="<?php echo esc_attr( $update->current ); ?>" type="hidden"/>
			<input name="locale" value="<?php echo esc_attr( $update->locale ); ?>" type="hidden"/>
			<p>
				<button type="submit" name="upgrade" id="upgrade" class="button update-link"><?php esc_attr_e( 'Re-install Now' ); ?></button>
			</p>
		</form>
	</div>
	<?php
}

add_action( 'core_upgrade_preamble', 'su_update_table' );

/**
 * Install all available updates.
 *
 * Updates themes, plugins, core and translations.
 */
function su_update_all() {
	if ( ! current_user_can( 'update_core' ) && ! current_user_can( 'update_plugins' ) && ! current_user_can( 'update_themes' ) ) {
		wp_die( __( 'You do not have sufficient permissions to update this site.' ) );
	}

	check_admin_referer( 'upgrade-core' );

	require_once( ABSPATH . 'wp-admin/admin-header.php' );

	// Update themes.
	$themes = array_keys( get_theme_updates() );

	if ( ! empty( $themes ) ) {
		$url = 'update.php?action=update-selected-themes&themes=' . urlencode( implode( ',', $themes ) );
		$url = wp_nonce_url( $url, 'bulk-update-themes' );
		?>
		<div class="wrap">
			<h1><?php _e( 'Update Themes' ); ?></h1>
			<iframe src="<?php echo $url ?>" style="width: 100%; height: 100%; min-height: 750px;" frameborder="0" title="<?php esc_attr_e( 'Update progress' ); ?>"></iframe>
		</div>
		<?php
	}

	// Update plugins.
	$plugins = array_keys( get_plugin_updates() );

	if ( ! empty( $plugins ) ) {
		$url = 'update.php?action=update-selected&plugins=' . urlencode( implode( ',', $plugins ) );
		$url = wp_nonce_url( $url, 'bulk-update-plugins' );
		?>
		<div class="wrap">
			<h1><?php _e( 'Update Plugins' ); ?></h1>
			<iframe src="<?php echo $url ?>" style="width: 100%; height: 100%; min-height: 750px;" frameborder="0" title="<?php esc_attr_e( 'Update progress' ); ?>"></iframe>
		</div>
		<?php
	}

	include_once( ABSPATH . 'wp-admin/includes/class-wp-upgrader.php' );

	// Update translations.
	$url     = 'update-core.php?action=do-translation-upgrade';
	$nonce   = 'upgrade-translations';
	$title   = __( 'Update Translations' );
	$context = WP_LANG_DIR;

	$upgrader = new Language_Pack_Upgrader( new Language_Pack_Upgrader_Skin( compact( 'url', 'nonce', 'title', 'context' ) ) );
	$upgrader->bulk_upgrade();

	// Update core.
	do_core_upgrade();

	include( ABSPATH . 'wp-admin/admin-footer.php' );
}

add_action( 'update-core-custom_do-all-upgrade', 'su_update_all' );
