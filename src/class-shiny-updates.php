<?php
/**
 * Shiny Updates bootstrap.
 *
 * @package Shiny_Updates
 */

/**
 * Class Shiny_Updates.
 */
class Shiny_Updates {

	/**
	 * Singleton.
	 *
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
		add_action( 'in_admin_header', array( $this, 'wp_admin_notice_template' ) );

		// Search plugins.
		add_action( 'wp_ajax_search-plugins', 'wp_ajax_search_plugins' );
		add_action( 'wp_ajax_search-install-plugins', 'wp_ajax_search_install_plugins' );

		// Plugin updates.
		add_action( 'wp_ajax_update-plugin', array( $this, 'update_plugin' ), -1 );

		// Plugin deletions.
		add_action( 'wp_ajax_delete-plugin', 'wp_ajax_delete_plugin' );

		// Plugin activations.
		add_action( 'wp_ajax_activate-plugin', array( $this, 'wp_ajax_activate_plugin' ) );

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

		if ( get_site_option( 'wp_auto_update_core' ) ) {
			add_filter( 'allow_major_auto_core_updates', '__return_true' );
		}
		if ( get_site_option( 'wp_auto_update_plugins' ) ) {
			add_filter( 'auto_update_plugin', '__return_true' );
		}
		if ( get_site_option( 'wp_auto_update_themes' ) ) {
			add_filter( 'auto_update_theme', '__return_true' );
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
	 */
	function wp_admin_notice_template() {
		?>
		<script id="tmpl-wp-updates-admin-notice" type="text/html">
			<div <# if ( data.id ) { #>id="{{ data.id }}"<# } #> class="notice {{ data.className }}"><p>{{{ data.message }}}</p></div>
		</script>
		<script id="tmpl-wp-bulk-updates-admin-notice" type="text/html">
			<div id="{{ data.id }}" class="notice <# if ( data.errors ) { #>notice-error<# } else { #>notice-success<# } #>">
				<p>
					<# if ( data.successes ) { #>
						<?php printf( __( '%s plugins successfully updated.' ), '{{ data.successes }}' ); ?>
					<# } #>
					<# if ( data.errors ) { #>
						<button class="button-link"><?php printf( __( '%s failures.' ), '{{ data.errors }}' ); ?></button>
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
	 * Enqueue scripts.
	 *
	 * @param string $hook Current admin page.
	 */
	function enqueue_scripts( $hook ) {
		if ( ! in_array( $hook, array( 'plugins.php', 'plugin-install.php', 'themes.php', 'theme-install.php' ), true ) ) {
			return;
		}

		$plugins = $totals = array();
		if ( isset( $GLOBALS['plugins'] ) ) {
			foreach ( $GLOBALS['plugins'] as $key => $list ) {
				$plugins[ $key ] = array_keys( (array) $list );
			}
		}

		if ( isset( $GLOBALS['totals'] ) ) {
			$totals = $GLOBALS['totals'];
		}

		wp_enqueue_style( 'shiny-updates', plugin_dir_url( __FILE__ ) . 'css/shiny-updates.css' );

		wp_dequeue_script( 'updates' );
		wp_enqueue_script( 'shiny-updates', plugin_dir_url( __FILE__ ) . 'js/shiny-updates.js', array( 'jquery', 'wp-util', 'wp-a11y' ), null, true );
		wp_localize_script( 'shiny-updates', '_wpUpdatesSettings', array(
			'ajax_nonce' => wp_create_nonce( 'updates' ),
			'plugins'    => $plugins,
			'totals'     => $totals,
			'l10n'       => array(
				'noPlugins'                 => __( 'You do not appear to have any plugins available at this time.' ),
				'noItemsSelected'           => __( 'Please select at least one item to perform this action on.' ),
				'updating'                  => __( 'Updating...' ), // No ellipsis.
				'updated'                   => __( 'Updated!' ),
				'updateNow'                 => __( 'Update Now' ),
				'updateFailedShort'         => __( 'Update Failed!' ),
				/* translators: Error string for a failed update */
				'updateFailed'              => __( 'Update Failed: %s' ),
				/* translators: Plugin name and version */
				'updatingLabel'             => __( 'Updating %s...' ), // No ellipsis.
				/* translators: Plugin name and version */
				'updatedLabel'              => __( '%s updated!' ),
				/* translators: Plugin name and version */
				'updateFailedLabel'         => __( '%s update failed' ),
				/* translators: JavaScript accessible string */
				'updatingMsg'               => __( 'Updating... please wait.' ), // No ellipsis.
				/* translators: JavaScript accessible string */
				'updatedMsg'                => __( 'Update completed successfully.' ),
				/* translators: JavaScript accessible string */
				'updateCancel'              => __( 'Update canceled.' ),
				'beforeunload'              => __( 'Plugin updates may not complete if you navigate away from this page.' ),
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
				/* translators: Plugin name */
				'aysDelete'                 => __( 'Are you sure you want to delete %s?' ),
				'deleting'                  => __( 'Deleting...' ),
				'deleteFailed'              => __( 'Deletion failed: %s' ),
				'deleted'                   => __( 'Deleted!' ),
			),
		) );

		if ( 'theme-install.php' === $hook || ( 'themes.php' === $hook && ! is_network_admin() ) ) {
			wp_enqueue_script( 'shiny-theme-updates', plugin_dir_url( __FILE__ ) . 'js/shiny-theme-updates.js', array( 'theme', 'shiny-updates' ), null, true );
		}

		if ( 'themes.php' === $hook ) {
			add_action( 'in_admin_header', array( $this, 'theme_templates' ) );
		}

		if ( 'theme-install.php' === $hook ) {
			add_action( 'in_admin_header', array( $this, 'theme_install_templates' ) );
		}
	}

	/**
	 * Adds a class and a data attribute to the "update now"-link.
	 *
	 * @param array $themes Theme data.
	 * @return array
	 */
	function theme_data( $themes ) {
		$update = get_site_transient( 'update_themes' );
		foreach ( $themes as $stylesheet => $theme ) {
			if ( isset( $theme['hasUpdate'] ) && $theme['hasUpdate'] && current_user_can( 'update_themes' ) && ! empty( $update->response[ $stylesheet ] ) ) {
				$themes[ $stylesheet ]['update'] = sprintf( '<p><strong>' . __( 'There is a new version of %1$s available. <a href="%2$s" class="thickbox" title="%3$s">View version %4$s details</a> or <a id="update-theme" data-slug="%5$s" href="%6$s">update now</a>.' ) . '</strong></p>', $theme['name'], esc_url( add_query_arg( array( 'TB_iframe' => 'true', 'width' => 1024, 'height' => 800 ), $update->response[ $stylesheet ]['url'] ) ), esc_attr( $theme['name'] ), $update->response[ $stylesheet ]['new_version'], $stylesheet, wp_nonce_url( admin_url( 'update.php?action=upgrade-theme&amp;theme=' . urlencode( $stylesheet ) ), 'upgrade-theme_' . $stylesheet ) );
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
	function theme_templates() {
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
				<div class="update-message notice inline notice-warning notice-alt"><?php _e( 'New version available. <button class="button-link" type="button">Update now</button>' ); ?></div>
			<# } #>

			<span class="more-details" id="{{ data.id }}-action"><?php _e( 'Theme Details' ); ?></span>
			<div class="theme-author"><?php printf( __( 'By %s' ), '{{{ data.author }}}' ); ?></div>

			<# if ( data.active ) { #>
				<h2 class="theme-name" id="{{ data.id }}-name">
					<?php
					/* translators: %s: theme name */
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
	 * Replace updates ajax handler with this new version.
	 */
	public function update_plugin() {
		remove_action( 'wp_ajax_update-plugin', 'wp_ajax_update_plugin', 1 );
		add_action( 'wp_ajax_update-plugin', 'wpsu_ajax_update_plugin', 1 );
	}

	/**
	 * Loads auto updates settings for `update-core.php`.
	 */
	public function load_auto_updates_settings() {
		include_once plugin_dir_path( __FILE__ ) . 'auto-updates.php';
	}
}
