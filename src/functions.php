<?php
/**
 * Sets up plugin-related functions.
 *
 * @package Shiny_Updates
 * @since 4.X.0
 */

/**
 * Replace update row functions with our own.
 *
 * @todo Merge: Remove as it becomes unneeded.
 */
function su_new_update_rows() {
	remove_action( 'admin_init', 'wp_plugin_update_rows' );
	remove_action( 'admin_init', 'wp_theme_update_rows' );
	add_action( 'admin_init', 'su_plugin_update_rows' );
	add_action( 'admin_init', 'su_theme_update_rows' );
}

/**
 * Enqueue scripts.
 *
 * @todo Merge: Add to wp_default_scripts()
 *
 * @param string $hook Current admin page.
 */
function su_enqueue_scripts( $hook ) {
	if ( ! in_array( $hook, array(
		'plugins.php',
		'plugin-install.php',
		'themes.php',
		'theme-install.php',
		'update-core.php',
		'import.php',
	), true )
	) {
		return;
	}

	$plugins = $totals = new stdClass;

	if ( isset( $GLOBALS['totals'] ) ) {
		$totals = $GLOBALS['totals'];
	}

	if ( stristr( $hook, 'plugin' ) ) {
		if ( ! isset( $GLOBALS['plugins'] ) ) {
			$GLOBALS['plugins'] = array( 'all' => get_plugins() );
		}

		foreach ( $GLOBALS['plugins'] as $key => $list ) {
			$plugins->$key = array_keys( (array) $list );
		}
	}

	wp_enqueue_style( 'shiny-updates', plugin_dir_url( __FILE__ ) . 'css/shiny-updates.css' );

	// Override updates JS.
	wp_dequeue_script( 'updates' );
	wp_enqueue_script( 'shiny-updates', plugin_dir_url( __FILE__ ) . 'js/shiny-updates.js', array( 'jquery', 'wp-util', 'wp-a11y' ), false, true );
	wp_localize_script( 'shiny-updates', '_wpUpdatesSettings', array(
		'ajax_nonce' => wp_create_nonce( 'updates' ),
		'plugins'    => $plugins,
		'totals'     => $totals,
		'l10n'       => array(
			/* translators: %s: Search string */
			'searchResults'              => __( 'Search results for &#8220;%s&#8221;' ),
			'noPlugins'                  => __( 'You do not appear to have any plugins available at this time.' ),
			'noItemsSelected'            => __( 'Please select at least one item to perform this action on.' ),
			'updating'                   => __( 'Updating...' ), // No ellipsis.
			'updated'                    => __( 'Updated!' ),
			'update'                     => __( 'Update' ),
			'updateNow'                  => __( 'Update Now' ),
			'updateFailedShort'          => __( 'Update Failed!' ),
			/* translators: Error string for a failed update */
			'updateFailed'               => __( 'Update Failed: %s' ),
			/* translators: Plugin name and version */
			'updatingLabel'              => __( 'Updating %s...' ), // No ellipsis.
			'updatingAllLabel'           => __( 'Updating site...' ), // No ellipsis.
			'updatingCoreLabel'          => __( 'Updating WordPress...' ), // No ellipsis.
			'updatingTranslationsLabel'  => __( 'Updating translations...' ), // No ellipsis.
			/* translators: Plugin name and version */
			'updatedLabel'               => __( '%s updated!' ),
			/* translators: Plugin name and version */
			'updateFailedLabel'          => __( '%s update failed' ),
			/* translators: JavaScript accessible string */
			'updatingMsg'                => __( 'Updating... please wait.' ), // No ellipsis.
			/* translators: JavaScript accessible string */
			'updatedMsg'                 => __( 'Update completed successfully.' ),
			/* translators: JavaScript accessible string */
			'updateCancel'               => __( 'Update canceled.' ),
			'beforeunload'               => __( 'Updates may not complete if you navigate away from this page.' ),
			'installNow'                 => __( 'Install Now' ),
			'installing'                 => __( 'Installing...' ),
			'installed'                  => __( 'Installed!' ),
			'installFailedShort'         => __( 'Install Failed!' ),
			/* translators: Error string for a failed installation */
			'installFailed'              => __( 'Installation failed: %s' ),
			/* translators: Plugin/Theme name and version */
			'installingLabel'            => __( 'Installing %s...' ), // no ellipsis
			/* translators: Plugin/Theme name and version */
			'installedLabel'             => __( '%s installed!' ),
			/* translators: Plugin/Theme name and version */
			'installFailedLabel'         => __( '%s installation failed' ),
			'installingMsg'              => __( 'Installing... please wait.' ),
			'installedMsg'               => __( 'Installation completed successfully.' ),
			/* translators: Activation URL */
			'importerInstalledMsg'       => __( 'Importer installed successfully. <a href="%s">Activate plugin &#38; run importer</a>' ),
			/* translators: %s: Plugin name */
			'aysDelete'                  => __( 'Are you sure you want to delete %s and its data?' ),
			'aysBulkDelete'              => __( 'Are you sure you want to delete the selected plugins and their data?' ),
			'deleting'                   => __( 'Deleting...' ),
			/* translators: %s: Error string for a failed deletion */
			'deleteFailed'               => __( 'Deletion failed: %s' ),
			'deleted'                    => __( 'Deleted!' ),
			'activate'                   => __( 'Activate' ),
			'activateImporter'           => __( 'Activate importer' ),
		),
	) );

	if ( 'theme-install.php' === $hook || ( 'themes.php' === $hook && ! is_network_admin() ) ) {
		wp_enqueue_script( 'shiny-theme-updates', plugin_dir_url( __FILE__ ) . 'js/shiny-theme-updates.js', array( 'theme', 'shiny-updates' ), false, true );
	}

	if ( 'themes.php' === $hook ) {
		add_action( 'in_admin_header', 'su_theme_templates' );
	}

	if ( 'theme-install.php' === $hook ) {
		add_action( 'in_admin_header', 'theme_install_templates' );
	}
}

/**
 * Add the HTML template for progress updates.
 *
 * Template takes one argument with three values:
 *
 * param {object} data {
 *     Arguments for admin notice.
 *
 *     @type string id        ID of the notice.
 *     @type string className Class names for the notice.
 *     @type string message   The notice's message.
 * }
 *
 * @todo Merge: Perhaps add to to wp-admin/includes/update.php
 *
 * @since 4.X.0
 */
function su_admin_notice_template() {
	?>
	<script id="tmpl-wp-updates-admin-notice" type="text/html">
		<div <# if ( data.id ) { #>id="{{ data.id }}"<# } #> class="notice {{ data.className }}"><p>{{{ data.message }}}</p></div>
	</script>
	<script id="tmpl-wp-bulk-updates-admin-notice" type="text/html">
		<div id="{{ data.id }}" class="notice <# if ( data.errors ) { #>notice-error<# } else { #>notice-success<# } #>">
			<p>
				<# if ( data.successes ) { #>
					<# if ( 1 === data.successes ) { #>
						<?php
							/* translators: %s: Number of plugins */
							printf( __( '%s plugin successfully updated.' ), '{{ data.successes }}' );
						?>
					<# } else { #>
						<?php
							/* translators: %s: Number of plugins */
							printf( __( '%s plugins successfully updated.' ), '{{ data.successes }}' );
						?>
					<# } #>
				<# } #>
				<# if ( data.errors ) { #>
					<# if ( 1 === data.errors ) { #>
						<button class="button-link">
							<?php
								/* translators: %s: Number of failures */
								printf( __( '%s failure.' ), '{{ data.errors }}' );
							?>
						</button>
					<# } else { #>
						<button class="button-link">
							<?php
								/* translators: %s: Number of failures */
								printf( __( '%s failures.' ), '{{ data.errors }}' );
							?>
						</button>
					<# } #>
				<# } #>
			</p>
			<# if ( data.errors ) { #>
				<ul class="hidden">
					<# _.each( data.errorMessages, function( errorMessage ) { #>
						<li>{{ errorMessage }}</li>
					<# } ); #>
				</ul>
			<# } #>
		</div>
	</script>
	<?php
}

/**
 * Adds the HTML template for plugin update rows on plugins.php.
 *
 * Template takes one argument with three values:
 *
 * param {object} data {
 *     Arguments for admin notice.
 *
 *     @type string slug    Plugin slug.
 *     @type string plugin  Plugin folder and file name.
 *     @type string content The update row content.
 * }
 *
 * @todo Merge: Perhaps add to to wp-admin/includes/update.php
 *
 * @since 4.X.0
 */
function su_plugin_update_row_template() {
?>
<script id="tmpl-plugin-update-row" type="text/template">
	<tr class="plugin-update-tr update" id="{{ data.slug }}-update" data-slug="{{ data.slug }}" data-plugin="{{ data.plugin }}">
		<td colspan="{{ data.colspan }}" class="plugin-update colspanchange">
			{{{ data.content }}}
		</td>
	</tr>
</script>
<?php
}

/**
 * JavaScript theme template.
 *
 * @todo Merge: Replace template in wp-admin/themes.php
 */
function su_theme_templates() {
	?>
	<script id="tmpl-theme" type="text/template">
		<# if ( data.screenshot[0] ) { #>
			<div class="theme-screenshot">
				<img src="{{ data.screenshot[0] }}" alt="" />
			</div>
		<# } else { #>
			<div class="theme-screenshot blank"></div>
		<# } #>

		<# if ( data.hasUpdate ) { #>
			<div class="update-message notice inline notice-warning notice-alt"><p><?php _e( 'New version available. <button class="button-link" type="button">Update now</button>' ); ?></p></div>
		<# } #>

		<span class="more-details" id="{{ data.id }}-action"><?php _e( 'Theme Details' ); ?></span>
		<div class="theme-author">
			<?php
				/* translators: %s: Theme author name */
				printf( __( 'By %s' ), '{{{ data.author }}}' );
			?>
		</div>

		<# if ( data.active ) { #>
			<h2 class="theme-name" id="{{ data.id }}-name">
				<?php
					/* translators: %s: Theme name */
					printf( __( '<span>Active:</span> %s' ), '{{{ data.name }}}' );
				?>
			</h2>
		<# } else { #>
			<h2 class="theme-name" id="{{ data.id }}-name">{{{ data.name }}}</h2>
		<# } #>

		<div class="theme-actions">
			<# if ( data.active ) { #>
				<# if ( data.actions.customize ) { #>
					<a class="button button-primary customize load-customize hide-if-no-customize" href="{{{ data.actions.customize }}}"><?php _e( 'Customize' ); ?></a>
				<# } #>
			<# } else { #>
				<a class="button button-secondary activate" href="{{{ data.actions.activate }}}"><?php _e( 'Activate' ); ?></a>
				<a class="button button-primary load-customize hide-if-no-customize" href="{{{ data.actions.customize }}}"><?php _e( 'Live Preview' ); ?></a>
			<# } #>
		</div>
	</script>
	<?php
}

/**
 * JavaScript theme template.
 *
 * @todo Merge: Replace template in wp-admin/theme-install.php
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
		<div class="theme-author">
			<?php
				/* translators: %s: Theme author name */
				printf( __( 'By %s' ), '{{ data.author }}' );
			?>
		</div>
		<h3 class="theme-name">{{ data.name }}</h3>

		<div class="theme-actions">
			<a class="button button-primary theme-install" data-slug="{{ data.id }}" href="{{ data.install_url }}"><?php esc_html_e( 'Install' ); ?></a>
			<button class="button-secondary preview install-theme-preview"><?php esc_html_e( 'Preview' ); ?></button>
		</div>

		<# if ( data.installed ) { #>
			<div class="notice notice-success notice-alt"><p><?php _ex( 'Installed', 'theme' ); ?></p></div>
		<# } #>
	</script>

	<script id="tmpl-shiny-theme-preview" type="text/template">
		<div class="wp-full-overlay-sidebar">
			<div class="wp-full-overlay-header">
				<button class="close-full-overlay"><span class="screen-reader-text"><?php _e( 'Close' ); ?></span></button>
				<button class="previous-theme"><span class="screen-reader-text"><?php _ex( 'Previous', 'Button label for a theme' ); ?></span></button>
				<button class="next-theme"><span class="screen-reader-text"><?php _ex( 'Next', 'Button label for a theme' ); ?></span></button>
				<# if ( data.installed ) { #>
					<button class="button button-primary theme-install disabled"><?php _ex( 'Installed', 'theme' ); ?></button>
				<# } else { #>
					<a href="{{ data.install_url }}" class="button button-primary theme-install" data-slug="{{ data.id }}"><?php _e( 'Install' ); ?></a>
				<# } #>
			</div>
			<div class="wp-full-overlay-sidebar-content">
				<div class="install-theme-info">
					<h3 class="theme-name">{{ data.name }}</h3>
					<span class="theme-by">
						<?php
							/* translators: %s: Theme author name */
							printf( __( 'By %s' ), '{{ data.author }}' );
						?>
					</span>

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
						<div class="theme-version">
							<?php
								/* translators: %s: Theme version */
								printf( __( 'Version: %s' ), '{{ data.version }}' );
							?>
						</div>
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
			<iframe src="{{ data.preview_url }}" title="<?php esc_attr_e( 'Preview' ); ?>"></iframe>
		</div>
	</script>
	<?php
}

/**
 * Adds a class and a data attribute to the "update now"-link.
 *
 * @todo Merge: Add directly to wp_prepare_themes_for_js()
 *
 * @param array $themes Theme data.
 * @return array Modified theme data.
 */
function su_theme_data( $themes ) {
	$update = get_site_transient( 'update_themes' );
	foreach ( $themes as $stylesheet => $theme ) {
		if ( isset( $theme['hasUpdate'] ) && $theme['hasUpdate'] && current_user_can( 'update_themes' ) && ! empty( $update->response[ $stylesheet ] ) ) {
			$themes[ $stylesheet ]['update'] = sprintf( '<p><strong>' . __( 'There is a new version of %1$s available. <a href="%2$s" class="thickbox open-plugin-details-modal" title="%3$s">View version %4$s details</a> or <a id="update-theme" data-slug="%5$s" href="%6$s">update now</a>.' ) . '</strong></p>', $theme['name'], esc_url( add_query_arg( array(
				'TB_iframe' => 'true',
				'width'     => 1024,
				'height'    => 800,
			), $update->response[ $stylesheet ]['url'] ) ), esc_attr( $theme['name'] ), $update->response[ $stylesheet ]['new_version'], $stylesheet, wp_nonce_url( admin_url( 'update.php?action=upgrade-theme&amp;theme=' . urlencode( $stylesheet ) ), 'upgrade-theme_' . $stylesheet ) );
		}
	}

	return $themes;
}

/**
 * Redefine `install_plugin_information()` to add an id and data attribute to the install button.
 *
 * @todo Merge: Replace install_plugin_information()
 * @SuppressWarnings(PHPMD)
 *
 * @since 2.7.0
 *
 * @global string $tab
 * @global string $wp_version
 */
function su_install_plugin_information() {
	// @codingStandardsIgnoreStart
	global $tab;

	remove_action( 'install_plugins_pre_plugin-information', 'install_plugin_information' );

	if ( empty( $_REQUEST['plugin'] ) ) {
		return;
	}

	$api = plugins_api( 'plugin_information', array(
		'slug' => wp_unslash( $_REQUEST['plugin'] ),
		'is_ssl' => is_ssl(),
		'fields' => array(
			'banners' => true,
			'reviews' => true,
			'downloaded' => false,
			'active_installs' => true
		)
	) );

	if ( is_wp_error( $api ) ) {
		wp_die( $api );
	}

	$plugins_allowedtags = array(
		'a' => array( 'href' => array(), 'title' => array(), 'target' => array() ),
		'abbr' => array( 'title' => array() ), 'acronym' => array( 'title' => array() ),
		'code' => array(), 'pre' => array(), 'em' => array(), 'strong' => array(),
		'div' => array( 'class' => array() ), 'span' => array( 'class' => array() ),
		'p' => array(), 'ul' => array(), 'ol' => array(), 'li' => array(),
		'h1' => array(), 'h2' => array(), 'h3' => array(), 'h4' => array(), 'h5' => array(), 'h6' => array(),
		'img' => array( 'src' => array(), 'class' => array(), 'alt' => array() )
	);

	$plugins_section_titles = array(
		'description'  => _x( 'Description',  'Plugin installer section title' ),
		'installation' => _x( 'Installation', 'Plugin installer section title' ),
		'faq'          => _x( 'FAQ',          'Plugin installer section title' ),
		'screenshots'  => _x( 'Screenshots',  'Plugin installer section title' ),
		'changelog'    => _x( 'Changelog',    'Plugin installer section title' ),
		'reviews'      => _x( 'Reviews',      'Plugin installer section title' ),
		'other_notes'  => _x( 'Other Notes',  'Plugin installer section title' )
	);

	// Sanitize HTML
	foreach ( (array) $api->sections as $section_name => $content ) {
		$api->sections[$section_name] = wp_kses( $content, $plugins_allowedtags );
	}

	foreach ( array( 'version', 'author', 'requires', 'tested', 'homepage', 'downloaded', 'slug' ) as $key ) {
		if ( isset( $api->$key ) ) {
			$api->$key = wp_kses( $api->$key, $plugins_allowedtags );
		}
	}

	$_tab = esc_attr( $tab );

	$section = isset( $_REQUEST['section'] ) ? wp_unslash( $_REQUEST['section'] ) : 'description'; // Default to the Description tab, Do not translate, API returns English.
	if ( empty( $section ) || ! isset( $api->sections[ $section ] ) ) {
		$section_titles = array_keys( (array) $api->sections );
		$section = reset( $section_titles );
	}

	iframe_header( __( 'Plugin Install' ) );

	$_with_banner = '';

	if ( ! empty( $api->banners ) && ( ! empty( $api->banners['low'] ) || ! empty( $api->banners['high'] ) ) ) {
		$_with_banner = 'with-banner';
		$low  = empty( $api->banners['low'] ) ? $api->banners['high'] : $api->banners['low'];
		$high = empty( $api->banners['high'] ) ? $api->banners['low'] : $api->banners['high'];
		?>
		<style type="text/css">
			#plugin-information-title.with-banner {
				background-image: url( <?php echo esc_url( $low ); ?> );
			}
			@media only screen and ( -webkit-min-device-pixel-ratio: 1.5 ) {
				#plugin-information-title.with-banner {
					background-image: url( <?php echo esc_url( $high ); ?> );
				}
			}
		</style>
		<?php
	}

	echo '<div id="plugin-information-scrollable">';
	echo "<div id='{$_tab}-title' class='{$_with_banner}'><div class='vignette'></div><h2>{$api->name}</h2></div>";
	echo "<div id='{$_tab}-tabs' class='{$_with_banner}'>\n";

	foreach ( (array) $api->sections as $section_name => $content ) {
		if ( 'reviews' === $section_name && ( empty( $api->ratings ) || 0 === array_sum( (array) $api->ratings ) ) ) {
			continue;
		}

		if ( isset( $plugins_section_titles[ $section_name ] ) ) {
			$title = $plugins_section_titles[ $section_name ];
		} else {
			$title = ucwords( str_replace( '_', ' ', $section_name ) );
		}

		$class = ( $section_name === $section ) ? ' class="current"' : '';
		$href = add_query_arg( array('tab' => $tab, 'section' => $section_name) );
		$href = esc_url( $href );
		$san_section = esc_attr( $section_name );
		echo "\t<a name='$san_section' href='$href' $class>$title</a>\n";
	}

	echo "</div>\n";

	?>
<div id="<?php echo $_tab; ?>-content" class='<?php echo $_with_banner; ?>'>
	<div class="fyi">
		<ul>
			<?php if ( ! empty( $api->version ) ) { ?>
				<li><strong><?php _e( 'Version:' ); ?></strong> <?php echo $api->version; ?></li>
			<?php } if ( ! empty( $api->author ) ) { ?>
				<li><strong><?php _e( 'Author:' ); ?></strong> <?php echo links_add_target( $api->author, '_blank' ); ?></li>
			<?php } if ( ! empty( $api->last_updated ) ) { ?>
				<li><strong><?php _e( 'Last Updated:' ); ?></strong>
					<?php
						/* translators: %s: Time since the last update */
						printf( __( '%s ago' ), human_time_diff( strtotime( $api->last_updated ) ) );
					?>
				</li>
			<?php } if ( ! empty( $api->requires ) ) { ?>
				<li>
					<strong><?php _e( 'Requires WordPress Version:' ); ?></strong>
					<?php
						/* translators: %s: WordPress version */
						printf( __( '%s or higher' ), $api->requires );
					?>
				</li>
			<?php } if ( ! empty( $api->tested ) ) { ?>
				<li><strong><?php _e( 'Compatible up to:' ); ?></strong> <?php echo $api->tested; ?></li>
			<?php } if ( ! empty( $api->active_installs ) ) { ?>
				<li><strong><?php _e( 'Active Installs:' ); ?></strong> <?php
					if ( $api->active_installs >= 1000000 ) {
						_ex( '1+ Million', 'Active plugin installs' );
					} else {
						echo number_format_i18n( $api->active_installs ) . '+';
					}
					?></li>
			<?php } if ( ! empty( $api->slug ) && empty( $api->external ) ) { ?>
				<li><a target="_blank" href="https://wordpress.org/plugins/<?php echo $api->slug; ?>/"><?php _e( 'WordPress.org Plugin Page &#187;' ); ?></a></li>
			<?php } if ( ! empty( $api->homepage ) ) { ?>
				<li><a target="_blank" href="<?php echo esc_url( $api->homepage ); ?>"><?php _e( 'Plugin Homepage &#187;' ); ?></a></li>
			<?php } if ( ! empty( $api->donate_link ) && empty( $api->contributors ) ) { ?>
				<li><a target="_blank" href="<?php echo esc_url( $api->donate_link ); ?>"><?php _e( 'Donate to this plugin &#187;' ); ?></a></li>
			<?php } ?>
		</ul>
		<?php if ( ! empty( $api->rating ) ) { ?>
			<h3><?php _e( 'Average Rating' ); ?></h3>
			<?php wp_star_rating( array( 'rating' => $api->rating, 'type' => 'percent', 'number' => $api->num_ratings ) ); ?>
			<p aria-hidden="true" class="fyi-description"><?php printf( _n( '(based on %s rating)', '(based on %s ratings)', $api->num_ratings ), number_format_i18n( $api->num_ratings ) ); ?></p>
		<?php }

		if ( ! empty( $api->ratings ) && array_sum( (array) $api->ratings ) > 0 ) { ?>
			<h3><?php _e( 'Reviews' ); ?></h3>
			<p class="fyi-description"><?php _e( 'Read all reviews on WordPress.org or write your own!' ); ?></p>
			<?php
			foreach ( $api->ratings as $key => $ratecount ) {
				// Avoid div-by-zero.
				$_rating = $api->num_ratings ? ( $ratecount / $api->num_ratings ) : 0;
				/* translators: 1: number of stars (used to determine singular/plural), 2: number of reviews */
				$aria_label = esc_attr( sprintf( _n( 'Reviews with %1$d star: %2$s. Opens in a new window.', 'Reviews with %1$d stars: %2$s. Opens in a new window.', $key ),
					$key,
					number_format_i18n( $ratecount )
				) );
				?>
				<div class="counter-container">
						<span class="counter-label"><a href="https://wordpress.org/support/view/plugin-reviews/<?php echo $api->slug; ?>?filter=<?php echo $key; ?>"
						                               target="_blank" aria-label="<?php echo $aria_label; ?>"><?php printf( _n( '%d star', '%d stars', $key ), $key ); ?></a></span>
						<span class="counter-back">
							<span class="counter-bar" style="width: <?php echo 92 * $_rating; ?>px;"></span>
						</span>
					<span class="counter-count" aria-hidden="true"><?php echo number_format_i18n( $ratecount ); ?></span>
				</div>
				<?php
			}
		}
		if ( ! empty( $api->contributors ) ) { ?>
			<h3><?php _e( 'Contributors' ); ?></h3>
			<ul class="contributors">
				<?php
				foreach ( (array) $api->contributors as $contrib_username => $contrib_profile ) {
					if ( empty( $contrib_username ) && empty( $contrib_profile ) ) {
						continue;
					}
					if ( empty( $contrib_username ) ) {
						$contrib_username = preg_replace( '/^.+\/(.+)\/?$/', '\1', $contrib_profile );
					}
					$contrib_username = sanitize_user( $contrib_username );
					if ( empty( $contrib_profile ) ) {
						echo "<li><img src='https://wordpress.org/grav-redirect.php?user={$contrib_username}&amp;s=36' width='18' height='18' alt='' />{$contrib_username}</li>";
					} else {
						echo "<li><a href='{$contrib_profile}' target='_blank'><img src='https://wordpress.org/grav-redirect.php?user={$contrib_username}&amp;s=36' width='18' height='18' alt='' />{$contrib_username}</a></li>";
					}
				}
				?>
			</ul>
			<?php if ( ! empty( $api->donate_link ) ) { ?>
				<a target="_blank" href="<?php echo esc_url( $api->donate_link ); ?>"><?php _e( 'Donate to this plugin &#187;' ); ?></a>
			<?php } ?>
		<?php } ?>
	</div>
	<div id="section-holder" class="wrap">
	<?php
	if ( ! empty( $api->tested ) && version_compare( substr( $GLOBALS['wp_version'], 0, strlen( $api->tested ) ), $api->tested, '>' ) ) {
		echo '<div class="notice notice-warning notice-alt"><p>' . __( '<strong>Warning:</strong> This plugin has <strong>not been tested</strong> with your current version of WordPress.' ) . '</p></div>';
	} elseif ( ! empty( $api->requires ) && version_compare( substr( $GLOBALS['wp_version'], 0, strlen( $api->requires ) ), $api->requires, '<' ) ) {
		echo '<div class="notice notice-warning notice-alt"><p>' . __( '<strong>Warning:</strong> This plugin has <strong>not been marked as compatible</strong> with your version of WordPress.' ) . '</p></div>';
	}

	foreach ( (array) $api->sections as $section_name => $content ) {
		$content = links_add_base_url( $content, 'https://wordpress.org/plugins/' . $api->slug . '/' );
		$content = links_add_target( $content, '_blank' );

		$san_section = esc_attr( $section_name );

		$display = ( $section_name === $section ) ? 'block' : 'none';

		echo "\t<div id='section-{$san_section}' class='section' style='display: {$display};'>\n";
		echo $content;
		echo "\t</div>\n";
	}
	echo "</div>\n";
	echo "</div>\n";
	echo "</div>\n"; // #plugin-information-scrollable
	echo "<div id='$tab-footer'>\n";
	if ( ! empty( $api->download_link ) && ( current_user_can( 'install_plugins' ) || current_user_can( 'update_plugins' ) ) ) {
		$status = install_plugin_install_status( $api );
		switch ( $status['status'] ) {
			case 'install':
				if ( $status['url'] ) {
					echo '<a data-slug="' . esc_attr( $api->slug ) . '" id="plugin_install_from_iframe" class="button button-primary right" href="' . $status['url'] . '" target="_parent">' . __( 'Install Now' ) . '</a>';
				}
				break;
			case 'update_available':
				if ( $status['url'] ) {
					echo '<a data-slug="' . esc_attr( $api->slug ) . '" data-plugin="' . esc_attr( $status['file'] ) . '" id="plugin_update_from_iframe" class="button button-primary right" href="' . $status['url'] . '" target="_parent">' . __( 'Install Update Now' ) .'</a>';
				}
				break;
			case 'newer_installed':
				/* translators: %s: Plugin version */
				echo '<a class="button button-primary right disabled">' . sprintf( __( 'Newer Version (%s) Installed'), $status['version'] ) . '</a>';
				break;
			case 'latest_installed':
				echo '<a class="button button-primary right disabled">' . __( 'Latest Version Installed' ) . '</a>';
				break;
		}
	}
	echo "</div>\n";

	iframe_footer();
	exit;
	// @codingStandardsIgnoreEnd
}


/**
 * Displays the shiny update table.
 *
 * Includes core, plugin and theme updates.
 *
 * @todo Merge: Add directly to wp-admin/update-core.php
 *
 * @global string $wp_version             The current WordPress version.
 * @global string $required_php_version   The required PHP version string.
 * @global string $required_mysql_version The required MySQL version string.
 */
function su_update_table() {
	global $wp_version, $required_php_version, $required_mysql_version;
	?>
	<div class="wordpress-updates-table">
		<?php
		require_once( 'class-shiny-updates-list-table.php' );

		// Do the (un)dismiss actions before headers, so that they can redirect.
		if ( isset( $_GET['dismiss'] ) || isset( $_GET['undismiss'] ) ) {
			$version = isset( $_GET['version'] ) ? sanitize_text_field( wp_unslash( $_GET['version'] ) ) : false;
			$locale  = isset( $_GET['locale'] ) ? sanitize_text_field( wp_unslash( $_GET['locale'] ) ) : 'en_US';

			$update = find_core_update( $version, $locale );

			if ( $update ) {
				if ( isset( $_GET['dismiss'] ) ) {
					dismiss_core_update( $update );
				} else {
					undismiss_core_update( $version, $locale );
				}
			}
		}

		// Todo: Use _get_list_table().
		$updates_table = new Shiny_Updates_List_Table();
		$updates_table->prepare_items();

		if ( $updates_table->has_available_updates() ) :
			$updates_table->display();
		else : ?>
		<div class="notice notice-success inline">
			<p>
				<strong><?php _e( 'Everything is up to date.' ); ?></strong>
				<?php
				if ( wp_http_supports( array( 'ssl' ) ) ) {
					require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';

					$upgrader = new WP_Automatic_Updater();

					$future_minor_update = (object) array(
						'current'       => $wp_version . '.1.next.minor',
						'version'       => $wp_version . '.1.next.minor',
						'php_version'   => $required_php_version,
						'mysql_version' => $required_mysql_version,
					);

					if ( $upgrader->should_update( 'core', $future_minor_update, ABSPATH ) ) {
						echo ' ' . __( 'Future security updates will be applied automatically.' );
					}
				}
				?>
			</p>
		</div>
		<?php endif; ?>
	</div>

	<?php
	$core_updates = (array) get_core_updates();

	if ( empty( $core_updates ) ) {
		return;
	}

	$update = array_pop( $core_updates );

	if ( 'en_US' === $update->locale &&
	     'en_US' === get_locale() ||
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
	<div class="wordpress-reinstall-card card" data-type="core" data-reinstall="true" data-version="<?php echo esc_attr( $update->current ); ?>" data-locale="<?php echo esc_attr( $update->locale ); ?>">
		<h2><?php _e( 'Need to re-install WordPress?' ); ?></h2>
		<p>
			<?php
				/* translators: %s: WordPress version */
				printf( __( 'If you need to re-install version %s, you can do so here.' ), $version_string );
			?>
		</p>

		<form method="post" action="update-core.php?action=do-core-reinstall" name="upgrade" class="upgrade">
			<?php wp_nonce_field( 'upgrade-core' ); ?>
			<input name="version" value="<?php echo esc_attr( $update->current ); ?>" type="hidden"/>
			<input name="locale" value="<?php echo esc_attr( $update->locale ); ?>" type="hidden"/>
			<p>
				<button type="submit" name="upgrade" class="button update-link"><?php esc_attr_e( 'Re-install Now' ); ?></button>
			</p>
		</form>
	</div>
	<?php
}

/**
 * Install all available updates.
 *
 * Updates themes, plugins, core and translations.
 *
 * @todo Use only one iframe for all updates.
 * @todo Merge: Add directly to wp-admin/update-core.php
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

/**
 * Filter the actions available on the new plugin screen, enabling activation
 * for plugins that are installed and inactive.
 *
 * @todo Merge: Add to WP_Plugin_Install_List_Table::display_rows()
 *
 * @param array $action_links An array of plugin action hyperlinks. Defaults are links to Details and Install Now.
 * @param array $plugin       The plugin currently being listed.
 * @return array The modified action links.
 */
function su_plugin_install_actions( $action_links, $plugin ) {
	$status = install_plugin_install_status( $plugin );

	if ( is_plugin_active( $status['file'] ) && 'update_available' !== $status['status'] ) {
		$action_links[0] = '<button type="button" class="button button-disabled" disabled="disabled">' . _x( 'Active', 'plugin' ) . '</button>';

		// If the plugin is installed, potentially add an activation link.
	} else if ( current_user_can( 'activate_plugins' ) && in_array( $status['status'], array( 'latest_installed', 'newer_installed' ), true ) ) {
		$action_links[0] = sprintf(
			'<a href="%1$s" class="button activate-now button-secondary" aria-label="%2$s">%3$s</a>',
			esc_url( add_query_arg( array(
				'_wpnonce' => wp_create_nonce( 'activate-plugin_' . $status['file'] ),
				'action'   => 'activate',
				'plugin'   => $status['file'],
			), admin_url( 'plugins.php' ) ) ),
			/* translators: %s: Plugin name */
			esc_attr( sprintf( __( 'Activate %s' ), $plugin['name'] ) ),
			__( 'Activate' )
		);
	}

	return $action_links;
}

/**
 * Filters the list of removable query args to add query args needed for Shiny Updates.
 *
 * @todo Merge: Add directly to wp_removable_query_args()
 *
 * @param array $query_args An array of query variables to remove from a URL.
 * @return array The filtered query args.
 */
function su_wp_removable_query_args( $query_args ) {
	$query_args[] = 'locale';
	$query_args[] = 'version';
	$query_args[] = 'dismiss';
	$query_args[] = 'undismiss';

	return $query_args;
}
