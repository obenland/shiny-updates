<?php

class Shiny_Updates_List_Table extends WP_List_Table {
	/**
	 * The current WordPress version.
	 *
	 * @var string
	 */
	protected $cur_wp_version;

	/**
	 * The available WordPress version, if applicable.
	 *
	 * @var string|false
	 */
	protected $core_update_version;

	/**
	 * Constructor.
	 */
	public function __construct() {
		parent::__construct( array(
			'singular' => __( 'Update' ),
			'plural'   => __( 'Updates' ),
		) );
	}

	/**
	 * Prepares the list of items for displaying.
	 *
	 * @uses WP_List_Table::set_pagination_args()
	 */
	public function prepare_items() {
		global $wp_version;

		$this->cur_wp_version = preg_replace( '/-.*$/', '', $wp_version );

		$core_updates = (array) get_core_updates();
		$plugins      = (array) get_plugin_updates();
		$themes       = (array) get_theme_updates();

		if ( ! empty( $core_updates ) ) {
			$this->items[] = array(
				'type' => 'core',
				'slug' => 'core',
				'data' => $core_updates,
			);
		}

		foreach ( $plugins as $plugin_file => $plugin_data ) {
			$this->items[] = array(
				'type' => 'plugin',
				'slug' => $plugin_file,
				'data' => $plugin_data,
			);
		}

		foreach ( $themes as $stylesheet => $theme ) {
			$this->items[] = array(
				'type' => 'theme',
				'slug' => $stylesheet,
				'data' => $theme,
			);
		}

		if ( ! isset( $core_updates[0]->response ) ||
		     'latest' == $core_updates[0]->response ||
		     'development' == $core_updates[0]->response ||
		     version_compare( $core_updates[0]->current, $this->cur_wp_version, '=' )
		) {
			$this->core_update_version = false;
		} else {
			$this->core_update_version = $core_updates[0]->current;
		}

		$columns  = $this->get_columns();
		$hidden   = array();
		$sortable = $this->get_sortable_columns();

		$this->_column_headers = array( $columns, $hidden, $sortable );

		$this->set_pagination_args( array(
			'total_items' => count( $this->items ),
			'per_page'    => count( $this->items ),
			'total_pages' => 1,
		) );
	}

	/**
	 * Message to be displayed when there are no items
	 */
	public function no_items() {
		_e( 'Your site is up to date, there are no available updates.' );
	}

	/**
	 * Get a list of columns.
	 *
	 * @return array
	 */
	public function get_columns() {
		$action = sprintf(
			'<form method="post" action="%s" name="upgrade-all">%s<input class="button button-primary" type="submit" value="%s" name="upgrade-all" /></form>',
			'update-core.php?action=do-all-upgrade',
			wp_nonce_field( 'upgrade-core', '_wpnonce', true, false ),
			esc_attr__( 'Update All' )
		);

		return array(
			'title'  => '',
			'type'   => __( 'Type' ),
			'action' => $action,
		);
	}

	/**
	 * Handles the title column output.
	 *
	 * @param array $item The current item.
	 */
	public function column_title( $item ) {
		if ( method_exists( $this, 'column_title_' . $item['type'] ) ) {
			call_user_func(
				array( $this, 'column_title_' . $item['type'] ),
				$item
			);
		}
	}

	/**
	 * Handles the title column output for a theme update item.
	 *
	 * @param array $item The current item.
	 */
	public function column_title_theme( $item ) {
		/* @var WP_Theme $theme */
		$theme = $item['data'];
		?>
		<p>
			<img src="<?php echo esc_url( $theme->get_screenshot() ); ?>" width="85" height="64" class="updates-table-screenshot" alt=""/>
			<strong><?php echo $theme->display( 'Name' ); ?></strong>
			<?php
			/* translators: 1: theme version, 2: new version */
			printf( __( 'You have version %1$s installed. Update to %2$s.' ),
				$theme->display( 'Version' ),
				$theme->update['new_version']
			);
			?>
		</p>
		<?php
	}

	/**
	 * Handles the title column output for a plugin update item.
	 *
	 * @param array $item The current item.
	 */
	public function column_title_plugin( $item ) {
		$plugin = $item['data'];

		// Get plugin compat for running version of WordPress.
		if ( isset( $plugin->update->tested ) && version_compare( $plugin->update->tested, $this->cur_wp_version, '>=' ) ) {
			$compat = '<br />' . sprintf( __( 'Compatibility with WordPress %1$s: 100%% (according to its author)' ), $this->cur_wp_version );
		} elseif ( isset( $plugin->update->compatibility->{$this->cur_wp_version} ) ) {
			$compat = $plugin->update->compatibility->{$this->cur_wp_version};
			$compat = '<br />' . sprintf( __( 'Compatibility with WordPress %1$s: %2$d%% (%3$d "works" votes out of %4$d total)' ), $this->cur_wp_version, $compat->percent, $compat->votes, $compat->total_votes );
		} else {
			$compat = '<br />' . sprintf( __( 'Compatibility with WordPress %1$s: Unknown' ), $this->cur_wp_version );
		}
		// Get plugin compat for updated version of WordPress.
		if ( $this->core_update_version ) {
			if ( isset( $plugin->update->tested ) && version_compare( $plugin->update->tested, $this->core_update_version, '>=' ) ) {
				$compat .= '<br />' . sprintf( __( 'Compatibility with WordPress %1$s: 100%% (according to its author)' ), $this->core_update_version );
			} elseif ( isset( $plugin->update->compatibility->{$this->core_update_version} ) ) {
				$update_compat = $plugin->update->compatibility->{$this->core_update_version};
				$compat .= '<br />' . sprintf( __( 'Compatibility with WordPress %1$s: %2$d%% (%3$d "works" votes out of %4$d total)' ), $this->core_update_version, $update_compat->percent, $update_compat->votes, $update_compat->total_votes );
			} else {
				$compat .= '<br />' . sprintf( __( 'Compatibility with WordPress %1$s: Unknown' ), $this->core_update_version );
			}
		}
		// Get the upgrade notice for the new plugin version.
		if ( isset( $plugin->update->upgrade_notice ) ) {
			$upgrade_notice = '<br />' . strip_tags( $plugin->update->upgrade_notice );
		} else {
			$upgrade_notice = '';
		}

		$details_url = self_admin_url( 'plugin-install.php?tab=plugin-information&plugin=' . $plugin->update->slug . '&section=changelog&TB_iframe=true&width=640&height=662' );
		$details     = sprintf(
			'<a href="%1$s" class="thickbox open-plugin-details-modal" aria-label="%2$s">%3$s</a>',
			esc_url( $details_url ),
			/* translators: 1: plugin name, 2: version number */
			esc_attr( sprintf( __( 'View %1$s version %2$s details' ), $plugin->Name, $plugin->update->new_version ) ),
			/* translators: %s: plugin version */
			sprintf( __( 'View version %s details.' ), $plugin->update->new_version )
		);
		?>
		<p>
			<strong><?php echo $plugin->Name; ?></strong>
			<?php
			/* translators: 1: plugin version, 2: new version */
			printf( __( 'You have version %1$s installed. Update to %2$s.' ),
				$plugin->Version,
				$plugin->update->new_version
			);
			echo ' ' . $details . $compat . $upgrade_notice;
			?>
		</p>
		<?php
	}

	/**
	 * Handles the title column output for a core update item.
	 *
	 * @param array $item The current item.
	 */
	public function column_title_core( $item ) {
		?>
		<p>
			<img src="<?php echo esc_url( admin_url( 'images/wordpress-logo.svg' ) ); ?>" width="85" height="85" class="updates-table-screenshot" alt=""/>
			<strong><?php _e( 'WordPress' ); ?></strong>
			<?php
			foreach ( (array) $item['data'] as $update ) {
				$this->_list_core_update( $update );
			}
			?>
		</p>
		<?php
	}

	/**
	 * Handles the type column output.
	 *
	 * @param array $item The current item.
	 */
	public function column_type( $item ) {
		switch ( $item['type'] ) {
			case 'plugin':
				echo __( 'Plugin' );
				break;
			case 'theme':
				echo __( 'Theme' );
				break;
			case 'translation':
				echo __( 'Translation' );
				break;
			default:
				echo __( 'Core' );
				break;
		}
	}

	/**
	 * Handles the action column output.
	 *
	 * @param array $item The current item.
	 */
	public function column_action( $item ) {
		$slug        = $item['slug'];
		$checkbox_id = 'checkbox_' . md5( $slug );
		$form_action = sprintf( 'update-core.php?action=do-%s-upgrade', $item['type'] );
		?>
		<form method="post" action="<?php echo esc_url( $form_action ); ?>" name="upgrade-all">
			<?php wp_nonce_field( 'upgrade-core' ); ?>
			<input type="hidden" name="checked[]" id="<?php echo $checkbox_id; ?>" value="<?php echo esc_attr( $slug ); ?>"/>
			<?php submit_button( esc_attr__( 'Update' ), 'button', $checkbox_id, false ); ?>
		</form>
		<?php
	}

	/**
	 *
	 * @global string $wp_version
	 *
	 * @param object  $update
	 */
	protected function _list_core_update( $update ) {
		global $wp_version;

		if ( 'en_US' == $update->locale && 'en_US' == get_locale() ) {
			$version_string = $update->current;
		} // If the only available update is a partial builds, it doesn't need a language-specific version string.
		elseif ( 'en_US' == $update->locale && $update->packages->partial && $wp_version == $update->partial_version && ( $updates = get_core_updates() ) && 1 == count( $updates ) ) {
			$version_string = $update->current;
		} else {
			$version_string = sprintf( "%s&ndash;<code>%s</code>", $update->current, $update->locale );
		}

		$current = false;

		if ( ! isset( $update->response ) || 'latest' == $update->response ) {
			$current = true;
		}

		$form_action  = 'update-core.php?action=do-core-upgrade';
		$show_buttons = true;
		if ( 'development' == $update->response ) {
			$message  = __( 'You are using a development version of WordPress. You can update to the latest nightly build automatically or download the nightly build and install it manually:' );
			$download = __( 'Download nightly build' );
		} else {
			if ( $current ) {
				$message     = sprintf( __( 'If you need to re-install version %s, you can do so here or download the package and re-install manually:' ), $version_string );
				$form_action = 'update-core.php?action=do-core-reinstall';
			} else {
				$message      = sprintf( __( 'You can update to <a href="https://codex.wordpress.org/Version_%1$s">WordPress %2$s</a> automatically or download the package and install it manually:' ), $update->current, $version_string );
				$show_buttons = false;
			}

			$download = sprintf( __( 'Download %s' ), $version_string );
		}

		echo '<p>';
		echo $message;

		if ( $show_buttons ) {
			echo '&nbsp;<a href="' . esc_url( $update->download ) . '">' . $download . '</a>&nbsp;';
		}
		echo '</p>';

		echo '<form method="post" action="' . $form_action . '" name="upgrade" class="upgrade">';
		wp_nonce_field( 'upgrade-core' );
		echo '<p>';
		echo '<input name="version" value="' . esc_attr( $update->current ) . '" type="hidden"/>';
		echo '<input name="locale" value="' . esc_attr( $update->locale ) . '" type="hidden"/>';

		echo '</p>';

		echo '</form>';

	}

}