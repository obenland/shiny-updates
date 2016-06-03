/* global pagenow, commonL10n */
/**
 *
 * @param {jQuery}  $                                   jQuery object.
 * @param {object}  wp                                  WP object.
 * @param {object}  settings                            WP Updates settings.
 * @param {string}  settings.ajax_nonce                 AJAX nonce.
 * @param {object}  settings.l10n                       Translation strings.
 * @param {object=} settings.plugins                    Base names of plugins in their different states.
 * @param {Array}   settings.plugins.all                Base names of all plugins.
 * @param {Array}   settings.plugins.active             Base names of active plugins.
 * @param {Array}   settings.plugins.inactive           Base names of inactive plugins.
 * @param {Array}   settings.plugins.upgrade            Base names of plugins with updates available.
 * @param {Array}   settings.plugins.recently_activated Base names of recently activated plugins.
 * @param {object=} settings.totals                     Plugin/theme status information or null.
 * @param {number}  settings.totals.all                 Amount of all plugins or themes.
 * @param {number}  settings.totals.upgrade             Amount of plugins or themes with updates available.
 * @param {number}  settings.totals.disabled            Amount of disabled themes.
 */
(function( $, wp, settings ) {
	var $document = $( document );

	wp = wp || {};

	/**
	 * The WP Updates object.
	 *
	 * @since 4.2.0
	 *
	 * @type {object}
	 */
	wp.updates = {};

	/**
	 * User nonce for ajax calls.
	 *
	 * @since 4.2.0
	 *
	 * @type {string}
	 */
	wp.updates.ajaxNonce = settings.ajax_nonce;

	/**
	 * Localized strings.
	 *
	 * @since 4.2.0
	 *
	 * @type {object}
	 */
	wp.updates.l10n = settings.l10n;

	/**
	 * Whether filesystem credentials need to be requested from the user.
	 *
	 * @since 4.2.0
	 *
	 * @type {bool}
	 */
	wp.updates.shouldRequestFilesystemCredentials = false;

	/**
	 * Filesystem credentials to be packaged along with the request.
	 *
	 * @since 4.2.0
	 * @since 4.X.0 Added `available` property to indicate whether credentials have been provided.
	 *
	 * @type {object} filesystemCredentials                    Holds filesystem credentials.
	 * @type {object} filesystemCredentials.ftp                Holds FTP credentials.
	 * @type {string} filesystemCredentials.ftp.host           FTP host. Default empty string.
	 * @type {string} filesystemCredentials.ftp.username       FTP user name. Default empty string.
	 * @type {string} filesystemCredentials.ftp.password       FTP password. Default empty string.
	 * @type {string} filesystemCredentials.ftp.connectionType Type of FTP connection. 'ssh', 'ftp', or 'ftps'.
	 *                                                         Default empty string.
	 * @type {object} filesystemCredentials.ssh                Holds SSH credentials.
	 * @type {string} filesystemCredentials.ssh.publicKey      The public key. Default empty string.
	 * @type {string} filesystemCredentials.ssh.privateKey     The private key. Default empty string.
	 * @type {bool}   filesystemCredentials.available          Whether filesystem credentials have been provided.
	 *                                                         Default 'false'.
	 */
	wp.updates.filesystemCredentials = {
		ftp:       {
			host:           '',
			username:       '',
			password:       '',
			connectionType: ''
		},
		ssh:       {
			publicKey:  '',
			privateKey: ''
		},
		available: false
	};

	/**
	 * Flag if we're waiting for an update to complete.
	 *
	 * @since 4.2.0
	 *
	 * @type {bool}
	 */
	wp.updates.updateLock = false;

	/**
	 * Admin notice template.
	 *
	 * @since 4.X.0
	 *
	 * @type {function} A function that lazily-compiles the template requested.
	 */
	wp.updates.adminNotice = wp.template( 'wp-updates-admin-notice' );

	/**
	 * If the user tries to update a plugin while an update is
	 * already happening, it can be placed in this queue to perform later.
	 *
	 * @since 4.2.0
	 *
	 * @type {Array.object}
	 */
	wp.updates.updateQueue = [];

	/**
	 * Holds the URL the user is being redirected to after a successful core update.
	 *
	 * @since 4.X.0
	 *
	 * @type {string}
	 */
	wp.updates.coreUpdateRedirect = undefined;

	/**
	 * Store a jQuery reference to return focus to when exiting the request credentials modal.
	 *
	 * @since 4.2.0
	 *
	 * @type {jQuery}
	 */
	wp.updates.$elToReturnFocusToFromCredentialsModal = undefined;

	/**
	 * Adds or updates an admin notice.
	 *
	 * @since 4.X.0
	 *
	 * @param {object}  data
	 * @param {string}  data.id            Unique id that will be used as the notice's id attribute.
	 * @param {string=} data.className     Optional. Class names that will be used in the admin notice.
	 * @param {string=} data.message       OptionalThe message displayed in the notice.
	 * @param {number=} data.successes     Optional. The amount of successful operations.
	 * @param {number=} data.errors        Optional. The amount of failed operations.
	 * @param {Array=}  data.errorMessages Optional. Error messages of failed operations.
	 *
	 */
	wp.updates.addAdminNotice = function( data ) {
		var $notices     = $( '.wrap' ),
		    $adminNotice = wp.updates.adminNotice( data );

		if ( $notices.find( '#' + data.id ).length ) {
			$notices.find( '#' + data.id ).replaceWith( $adminNotice );
		} else {
			$notices.find( '> h1' ).after( $adminNotice );
		}

		$document.trigger( 'wp-updates-notice-added' );
	};

	/**
	 * Handles Ajax requests to WordPress.
	 *
	 * @since 4.X.0
	 *
	 * @param {string} action The type of Ajax request ('update-plugin', 'install-theme', etc).
	 * @param {object} data   Data that needs to be passed to the ajax callback.
	 * @return {$.promise}    A jQuery promise that represents the request,
	 *                        decorated with an abort() method.
	 */
	wp.updates.ajax = function( action, data ) {
		var options = {};

		if ( wp.updates.updateLock ) {
			wp.updates.updateQueue.push( {
				type: action,
				data: data
			} );

			// Return a Deferred object so callbacks can always be registered.
			return $.Deferred();
		}

		wp.updates.updateLock = true;

		if ( data.success ) {
			options.success = data.success;
			delete data.success;
		}
		if ( data.error ) {
			options.error = data.error;
			delete data.error;
		}

		options.data = _.extend( data, {
			action:          action,
			_ajax_nonce:     wp.updates.ajaxNonce,
			username:        wp.updates.filesystemCredentials.ftp.username,
			password:        wp.updates.filesystemCredentials.ftp.password,
			hostname:        wp.updates.filesystemCredentials.ftp.hostname,
			connection_type: wp.updates.filesystemCredentials.ftp.connectionType,
			public_key:      wp.updates.filesystemCredentials.ssh.publicKey,
			private_key:     wp.updates.filesystemCredentials.ssh.privateKey
		} );

		return wp.ajax.send( options ).always( wp.updates.ajaxAlways );
	};

	/**
	 * Actions performed after every Ajax request.
	 *
	 * @since 4.X.0
	 *
	 * @param {object}  response
	 * @param {array=}  response.debug     Optional. Debug information.
	 * @param {string=} response.errorCode Optional. Error code for an error that occurred.
	 */
	wp.updates.ajaxAlways = function( response ) {
		if ( ! response.errorCode && 'unable_to_connect_to_filesystem' !== response.errorCode ) {
			wp.updates.updateLock = false;
			wp.updates.queueChecker();
		}

		if ( 'undefined' !== typeof response.debug ) {
			_.map( response.debug, function( message ) {
				window.console.log( $( '<p />' ).html( message ).text() );
			} );
		}
	};

	/**
	 * Decrement update counts throughout the various menus.
	 *
	 * @since 3.9.0
	 *
	 * @param {string} upgradeType
	 */
	wp.updates.decrementCount = function( upgradeType ) {
		var $adminBarUpdates             = $( '#wp-admin-bar-updates' ),
		    $dashboardNavMenuUpdateCount = $( 'a[href="update-core.php"] .update-plugins' ),
		    count                        = $adminBarUpdates.find( '.ab-label' ).text(),
		    $menuItem, $itemCount, itemCount;

		count = parseInt( count, 10 ) - 1;

		if ( count < 0 || isNaN( count ) ) {
			return;
		}

		$adminBarUpdates.find( '.ab-item' ).removeAttr( 'title' );
		$adminBarUpdates.find( '.ab-label' ).text( count );

		if ( 0 === count ) {
			$adminBarUpdates.find( '.ab-label' ).parents( 'li' ).remove();
		}

		$dashboardNavMenuUpdateCount.each( function( index, element ) {
			element.className = element.className.replace( /count-\d+/, 'count-' + count );
		} );

		$dashboardNavMenuUpdateCount.removeAttr( 'title' );
		$dashboardNavMenuUpdateCount.find( '.update-count' ).text( count );

		switch ( upgradeType ) {
			case 'plugin':
				$menuItem  = $( '#menu-plugins' );
				$itemCount = $menuItem.find( '.plugin-count' );
				break;

			case 'theme':
				$menuItem  = $( '#menu-appearance' );
				$itemCount = $menuItem.find( '.theme-count' );
				break;
		}

		if ( $itemCount ) {
			itemCount = $itemCount.eq( 0 ).text();
			itemCount = parseInt( itemCount, 10 ) - 1;
		}

		if ( itemCount < 0 || isNaN( itemCount ) ) {
			return;
		}

		if ( itemCount > 0 ) {
			$( '.subsubsub .upgrade .count' ).text( '(' + itemCount + ')' );

			$itemCount.text( itemCount );
			$menuItem.find( '.update-plugins' ).each( function( index, element ) {
				element.className = element.className.replace( /count-\d+/, 'count-' + itemCount );
			} );
		} else {
			$( '.subsubsub .upgrade' ).remove();
			$menuItem.find( '.update-plugins' ).remove();
		}
	};

	/**
	 * Send an Ajax request to the server to update a plugin.
	 *
	 * @since 4.2.0
	 *
	 * @param {object}         args         Arguments.
	 * @param {string}         args.plugin  Plugin basename.
	 * @param {string}         args.slug    Plugin slug.
	 * @param {updateSuccess=} args.success Optional. Success callback. Default: wp.updates.updateSuccess
	 * @param {updateError=}   args.error   Optional. Error callback. Default: wp.updates.updateError
	 * @return {$.promise} A jQuery promise that represents the request,
	 *                     decorated with an abort() method.
	 */
	wp.updates.updatePlugin = function( args ) {
		var $updateRow, $card, $message, message;

		args = _.extend( {
			success: wp.updates.updateSuccess,
			error: wp.updates.updateError
		}, args );

		if ( 'plugins' === pagenow || 'plugins-network' === pagenow ) {
			$updateRow = $( 'tr[data-plugin="' + args.plugin + '"]' );
			$message   = $updateRow.find( '.update-message' ).addClass( 'updating-message' ).find( 'p' );
			message    = wp.updates.l10n.updatingLabel.replace( '%s', $updateRow.find( '.plugin-title strong' ).text() );
		} else if ( 'plugin-install' === pagenow || 'plugin-install-network' === pagenow ) {
			$card    = $( '.plugin-card-' + args.slug );
			$message = $card.find( '.update-now' ).addClass( 'updating-message' );
			message  = wp.updates.l10n.updatingLabel.replace( '%s', $message.data( 'name' ) );

			// Remove previous error messages, if any.
			$card.removeClass( 'plugin-card-update-failed' ).find( '.notice.notice-error' ).remove();
		} else if ( 'update-core' === pagenow || 'update-core-network' === pagenow ) {
			$message = $( '.update-link[data-plugin="' + args.plugin + '"]' ).addClass( 'updating-message' );
			message  = wp.updates.l10n.updatingLabel.replace( '%s', $message.data( 'name' ) );
		}

		if ( $message.html() !== wp.updates.l10n.updating ) {
			$message.data( 'originaltext', $message.html() );
		}

		$message
			.attr( 'aria-label', message )
			.text( wp.updates.l10n.updating );

		$document.trigger( 'wp-plugin-updating' );

		return wp.updates.ajax( 'update-plugin', args );
	};

	/**
	 * On a successful plugin update, update the UI with the result.
	 *
	 * @since 4.2.0
	 *
	 * @typedef {object} updateSuccess
	 * @param {object} response            Response from the server.
	 * @param {string} response.slug       Slug of the plugin to be updated.
	 * @param {string} response.plugin     Basename of the plugin to be updated.
	 * @param {string} response.pluginName Name of the plugin to be updated.
	 * @param {string} response.oldVersion Old version of the plugin.
	 * @param {string} response.newVersion New version of the plugin.
	 */
	wp.updates.updateSuccess = function( response ) {
		var $pluginRow, $updateMessage, newText;

		if ( 'plugins' === pagenow || 'plugins-network' === pagenow ) {
			$pluginRow     = $( 'tr[data-plugin="' + response.plugin + '"]' );
			$updateMessage = $pluginRow.find( '.update-message' ).removeClass( 'updating-message notice-warning' ).addClass( 'notice-success' ).find( 'p' );
			$pluginRow.addClass( 'updated' ).removeClass( 'update' );

			// Update the version number in the row.
			newText = $pluginRow.find( '.plugin-version-author-uri' ).html().replace( response.oldVersion, response.newVersion );
			$pluginRow.find( '.plugin-version-author-uri' ).html( newText );

		} else if ( 'plugin-install' === pagenow || 'plugin-install-network' === pagenow ) {
			$updateMessage = $( '.plugin-card-' + response.slug ).find( '.update-now' ).removeClass( 'updating-message' ).addClass( 'button-disabled updated-message' );
		}

		$updateMessage
			.attr( 'aria-label', wp.updates.l10n.updatedLabel.replace( '%s', response.pluginName ) )
			.text( wp.updates.l10n.updated );

		wp.a11y.speak( wp.updates.l10n.updatedMsg, 'polite' );

		wp.updates.decrementCount( 'plugin' );

		$document.trigger( 'wp-plugin-update-success', response );
	};

	/**
	 * On a plugin update error, update the UI appropriately.
	 *
	 * @since 4.2.0
	 *
	 * @typedef {object} updateError
	 * @param {object} response              Response from the server.
	 * @param {string} response.slug         Slug of the plugin to be updated.
	 * @param {string} response.plugin       Basename of the plugin to be updated.
	 * @param {string} response.pluginName   Name of the plugin to be updated.
	 * @param {string} response.errorCode    Error code for the error that occurred.
	 * @param {string} response.errorMessage The error that occurred.
	 */
	wp.updates.updateError = function( response ) {
		var $card, $message, errorMessage;

		if ( response.errorCode && 'unable_to_connect_to_filesystem' === response.errorCode ) {
			wp.updates.credentialError( response, 'update-plugin' );
			return;
		}

		errorMessage = wp.updates.l10n.updateFailed.replace( '%s', response.errorMessage );

		if ( 'plugins' === pagenow || 'plugins-network' === pagenow ) {
			$message = $( 'tr[data-plugin="' + response.plugin + '"]' ).find( '.update-message' );
			$message.removeClass( 'updating-message notice-warning' ).addClass( 'notice-error' ).find( 'p' ).html( errorMessage );
		} else if ( 'plugin-install' === pagenow || 'plugin-install-network' === pagenow ) {
			$card = $( '.plugin-card-' + response.slug )
				.addClass( 'plugin-card-update-failed' )
				.append( wp.updates.adminNotice( {
					className: 'update-message notice-error notice-alt is-dismissible',
					message:   errorMessage
				} ) );

			$card.find( '.update-now' )
				.attr( 'aria-label', wp.updates.l10n.updateFailedLabel.replace( '%s', response.pluginName ) )
				.text( wp.updates.l10n.updateFailedShort ).removeClass( 'updating-message' );

			$card.on( 'click', '.notice.is-dismissible .notice-dismiss', function() {

				// Use same delay as the total duration of the notice fadeTo + slideUp animation.
				setTimeout( function() {
					$card
						.removeClass( 'plugin-card-update-failed' )
						.find( '.column-name a' ).focus();

					$card.find( '.update-now' )
						.attr( 'aria-label', false )
						.text( wp.updates.l10n.updateNow );
				}, 200 );
			} );
		}

		wp.a11y.speak( errorMessage, 'assertive' );

		$document.trigger( 'wp-plugin-update-error', response );
	};

	/**
	 * Send an Ajax request to the server to install a plugin.
	 *
	 * @since 4.X.0
	 *
	 * @param {object}                args         Arguments.
	 * @param {string}                args.slug    Plugin identifier in the WordPress.org Plugin repository.
	 * @param {installPluginSuccess=} args.success Optional. Success callback. Default: wp.updates.installPluginSuccess
	 * @param {installPluginError=}   args.error   Optional. Error callback. Default: wp.updates.installPluginError
	 * @return {$.promise} A jQuery promise that represents the request,
	 *                     decorated with an abort() method.
	 */
	wp.updates.installPlugin = function( args ) {
		var $card    = $( '.plugin-card-' + args.slug ),
		    $message = $card.find( '.install-now' );

		args = _.extend( {
			success: wp.updates.installPluginSuccess,
			error: wp.updates.installPluginError
		}, args );

		$message.addClass( 'updating-message' );

		wp.a11y.speak( wp.updates.l10n.installingMsg, 'polite' );

		// Remove previous error messages, if any.
		$card.removeClass( 'plugin-card-install-failed' ).find( '.notice.notice-error' ).remove();

		return wp.updates.ajax( 'install-plugin', args );
	};

	/**
	 * On plugin install success, update the UI with the result.
	 *
	 * @since 4.X.0
	 *
	 * @typedef {object} installPluginSuccess
	 * @param {object} response             Response from the server.
	 * @param {string} response.slug        Slug of the plugin to be installed.
	 * @param {string} response.activateUrl URL to activate the just installed plugin.
	 */
	wp.updates.installPluginSuccess = function( response ) {
		var $message = $( '.plugin-card-' + response.slug ).find( '.install-now' );

		$message.removeClass( 'updating-message' ).addClass( 'updated-message installed button-disabled' )
			.text( wp.updates.l10n.installed );

		wp.a11y.speak( wp.updates.l10n.installedMsg, 'polite' );

		$document.trigger( 'wp-plugin-install-success', response );

		if ( response.activateUrl ) {
			setTimeout( function() {

				// Transform the 'Install' button into an 'Activate' button.
				$message.removeClass( 'install-now installed button-disabled updated-message' ).addClass( 'activate-now button-primary' )
					.attr( 'href', response.activateUrl )
					.text( wp.updates.l10n.activate );
			}, 1000 );
		}
	};

	/**
	 * On plugin install failure, update the UI appropriately.
	 *
	 * @since 4.X.0
	 *
	 * @typedef {object} installPluginError
	 * @param {object} response              Response from the server.
	 * @param {string} response.slug         Slug of the plugin to be installed.
	 * @param {string} response.plugin       Basename of the plugin to be installed.
	 * @param {string} response.pluginName   Name of the plugin to be installed.
	 * @param {string} response.errorCode    Error code for the error that occurred.
	 * @param {string} response.errorMessage The error that occurred.
	 */
	wp.updates.installPluginError = function( response ) {
		var $card   = $( '.plugin-card-' + response.slug ),
		    $button = $card.find( '.install-now' ),
		    errorMessage;

		if ( response.errorCode && 'unable_to_connect_to_filesystem' === response.errorCode ) {
			wp.updates.credentialError( response, 'install-plugin' );
			return;
		}

		errorMessage = wp.updates.l10n.installFailed.replace( '%s', response.errorMessage );

		$card
			.addClass( 'plugin-card-update-failed' )
			.append( '<div class="notice notice-error notice-alt is-dismissible"><p>' + errorMessage + '</p></div>' );

		$card.on( 'click', '.notice.is-dismissible .notice-dismiss', function() {

			// Use same delay as the total duration of the notice fadeTo + slideUp animation.
			setTimeout( function() {
				$card
					.removeClass( 'plugin-card-update-failed' )
					.find( '.column-name a' ).focus();
			}, 200 );
		} );

		$button
			.attr( 'aria-label', wp.updates.l10n.installFailedLabel.replace( '%s', response.pluginName ) )
			.text( wp.updates.l10n.installFailedShort ).removeClass( 'updating-message' );

		wp.a11y.speak( errorMessage, 'assertive' );

		$document.trigger( 'wp-plugin-install-error', response );
	};

	/**
	 * On Importer install success, update the UI with the result.
	 *
	 * @since 4.X.0
	 *
	 * @typedef {object} installImporterSuccess
	 * @param {object} response             Response from the server.
	 * @param {string} response.slug        Slug of the plugin to be installed.
	 * @param {string} response.activateUrl URL to activate the just installed plugin.
	 */
	wp.updates.installImporterSuccess = function( response ) {
		wp.updates.addAdminNotice( {
			id:        'install-success',
			className: 'notice-success is-dismissible',
			message:   wp.updates.l10n.importerInstalledMsg.replace( '%s', response.activateUrl + '&from=import' )
		} );

		$( 'a[href*="' + response.slug + '"]' )
			.removeClass( 'thickbox open-plugin-details-modal updating-message' )
			.off( 'click' )
			.attr( 'href', response.activateUrl + '&from=import' )
			.attr( 'title', wp.updates.l10n.activateImporter );

		wp.a11y.speak( wp.updates.l10n.installedMsg, 'polite' );

		$document.trigger( 'wp-installer-install-success', response );
	};

	/**
	 * On Importer install failure, update the UI appropriately.
	 *
	 * @since 4.X.0
	 *
	 * @typedef {object} installImporterError
	 * @param {object} response           Response from the server.
	 * @param {string} response.error     The error that occurred.
	 * @param {string} response.errorCode Error code for the error that occurred.
	 */
	wp.updates.installImporterError = function( response ) {
		var errorMessage = wp.updates.l10n.installFailed.replace( '%s', response.error );

		wp.updates.addAdminNotice( {
			id:        response.errorCode,
			className: 'notice-error is-dismissible',
			message:   errorMessage
		} );

		$( 'a[href*="' + response.slug + '"]' ).removeClass( 'updating-message' );

		wp.a11y.speak( errorMessage, 'assertive' );

		$document.trigger( 'wp-importer-install-error', response );
	};

	/**
	 * Send an Ajax request to the server to delete a plugin.
	 *
	 * @since 4.X.0
	 *
	 * @param {object}               args         Arguments.
	 * @param {string}               args.plugin  Plugin basename.
	 * @param {string}               args.slug    Plugin slug.
	 * @param {deletePluginSuccess=} args.success Optional. Success callback. Default: wp.updates.deletePluginSuccess
	 * @param {deletePluginError=}   args.error   Optional. Error callback. Default: wp.updates.deletePluginError
	 * @return {$.promise} A jQuery promise that represents the request,
	 *                     decorated with an abort() method.
	 */
	wp.updates.deletePlugin = function( args ) {
		args = _.extend( {
			success: wp.updates.deletePluginSuccess,
			error: wp.updates.deletePluginError
		}, args );

		wp.a11y.speak( wp.updates.l10n.deleting, 'polite' );

		return wp.updates.ajax( 'delete-plugin', args );
	};

	/**
	 * On plugin delete success, update the UI with the result.
	 *
	 * @since 4.X.0
	 *
	 * @typedef {object} deletePluginSuccess
	 * @param {object} response        Response from the server.
	 * @param {string} response.slug   Slug of the plugin to be deleted.
	 * @param {string} response.plugin Basename of the plugin to be deleted.
	 */
	wp.updates.deletePluginSuccess = function( response ) {

		// Removes the plugin and updates rows.
		$( '[data-plugin="' + response.plugin + '"]' ).css( { backgroundColor: '#faafaa' } ).fadeOut( 350, function() {
			var $form       = $( '#bulk-action-form' ),
			    $views      = $( '.subsubsub' ),
			    columnCount = $form.find( 'thead th:not(.hidden), thead td' ).length,
			    /** @type {object} plugins Base names of plugins in their different states. */
			    plugins     = settings.plugins;

			$( this ).remove();

			// Remove plugin from update count.
			if ( -1 !== plugins.upgrade.indexOf( response.plugin ) ) {
				plugins.upgrade = _.without( plugins.upgrade, response.plugin );
				wp.updates.decrementCount( 'plugin' );
			}

			// Remove from views.
			if ( -1 !== plugins.inactive.indexOf( response.plugin ) ) {
				plugins.inactive = _.without( plugins.inactive, response.plugin );
				if ( plugins.inactive.length > 0 ) {
					$views.find( '.inactive .count' ).text( '(' + plugins.inactive.length + ')' );
				} else {
					$views.find( '.inactive' ).remove();
				}
			}

			if ( -1 !== plugins.active.indexOf( response.plugin ) ) {
				plugins.active = _.without( plugins.active, response.plugin );
				if ( plugins.active.length ) {
					$views.find( '.active .count' ).text( '(' + plugins.active.length + ')' );
				} else {
					$views.find( '.active' ).remove();
				}
			}

			if ( -1 !== plugins.recently_activated.indexOf( response.plugin ) ) {
				plugins.recently_activated = _.without( plugins.recently_activated, response.plugin );
				if ( plugins.recently_activated.length ) {
					$views.find( '.recently_activated .count' ).text( '(' + plugins.recently_activated.length + ')' );
				} else {
					$views.find( '.recently_activated' ).remove();
				}
			}

			plugins.all = _.without( plugins.all, response.plugin );
			if ( plugins.all.length ) {
				$views.find( '.all .count' ).text( '(' + plugins.all.length + ')' );
			} else {
				$form.find( '.tablenav' ).css( { visibility: 'hidden' } );
				$views.find( '.all' ).remove();
				if ( ! $form.find( 'tr.no-items' ).length ) {
					$form.find( '#the-list' ).append( '<tr class="no-items"><td class="colspanchange" colspan="' + columnCount + '">' + wp.updates.l10n.noPlugins + '</td></tr>' );
				}
			}
		} );

		wp.a11y.speak( wp.updates.l10n.deleted, 'polite' );

		$document.trigger( 'wp-plugin-delete-success', response );
	};

	/**
	 * On plugin delete failure, update the UI appropriately.
	 *
	 * @since 4.X.0
	 *
	 * @typedef {object} deletePluginError
	 * @param {object} response              Response from the server.
	 * @param {string} response.plugin       Basename of the plugin to be deleted.
	 * @param {string} response.errorCode    Error code for the error that occurred.
	 * @param {string} response.errorMessage The error that occurred.
	 */
	wp.updates.deletePluginError = function( response ) {
		if ( response.errorCode && 'unable_to_connect_to_filesystem' === response.errorCode ) {
			wp.updates.credentialError( response, 'delete-plugin' );
			return;
		}

		$( 'tr[data-plugin="' + response.plugin + '"]' ).find( '.column-description' ).prepend( wp.updates.adminNotice( {
			className: 'update-message notice-error notice-alt',
			message:   response.errorMessage
		} ) );

		$document.trigger( 'wp-plugin-delete-error', response );
	};

	/**
	 * Send an Ajax request to the server to update a theme.
	 *
	 * @since 4.X.0
	 *
	 * @param {object}              args
	 * @param {string}              args.slug    Theme stylesheet.
	 * @param {updateThemeSuccess=} args.success Optional. Success callback. Default: wp.updates.updateThemeSuccess
	 * @param {updateThemeError=}   args.error   Optional. Error callback. Default: wp.updates.updateThemeError
	 * @return {$.promise} A jQuery promise that represents the request,
	 *                     decorated with an abort() method.
	 */
	wp.updates.updateTheme = function( args ) {
		var $notice;

		args = _.extend( {
			success: wp.updates.updateThemeSuccess,
			error: wp.updates.updateThemeError
		}, args );

		if ( 'update-core' === pagenow || 'update-core-network' === pagenow ) {
			$notice = $( '.update-link', '[data-slug="' + args.slug + '"]' ).addClass( 'updating-message' );

		} else if ( 'themes-network' === pagenow ) {
			$notice = $( '[data-slug="' + args.slug + '"]' ).find( '.update-message' ).addClass( 'updating-message' ).find( 'p' );

		} else {
			$notice = $( '#update-theme' ).closest( '.notice' );
			if ( ! $notice.length ) {
				$notice = $( '[data-slug="' + args.slug + '"]' ).find( '.update-message' );
			}

			$notice.find( 'h3' ).remove();
			$notice = $notice.addClass( 'updating-message' ).find( 'p' );
		}

		if ( $notice.html() !== wp.updates.l10n.updating ) {
			$notice.data( 'originaltext', $notice.html() );
		}

		wp.a11y.speak( wp.updates.l10n.updatingMsg, 'polite' );
		$notice.text( wp.updates.l10n.updating );

		return wp.updates.ajax( 'update-theme', args );
	};

	/**
	 * On a successful theme update, update the UI with the result.
	 *
	 * @since 4.X.0
	 *
	 * @typedef {object} updateThemeSuccess
	 * @param {object} response
	 * @param {string} response.slug       Slug of the theme to be updated.
	 * @param {object} response.theme      Updated theme.
	 * @param {string} response.oldVersion Old version of the theme.
	 * @param {string} response.newVersion New version of the theme.
	 */
	wp.updates.updateThemeSuccess = function( response ) {
		var isModalOpen     = $( 'body.modal-open' ).length,
		    $theme          = $( '[data-slug="' + response.slug + '"]' ),
		    $updatedMessage = wp.updates.adminNotice( {
			    className: 'update-message updated-message notice-success notice-alt',
			    message:   wp.updates.l10n.updated
		    } ),
		    $notice, newText;

		if ( 'themes-network' === pagenow ) {
			$notice = $theme.find( '.update-message' );

			// Update the version number in the row.
			newText = $theme.find( '.theme-version-author-uri' ).html().replace( response.oldVersion, response.newVersion );
			$theme.find( '.theme-version-author-uri' ).html( newText );
		} else {
			$notice = $( '.theme-info .notice' );
			if ( ! $notice.length ) {
				$notice = $theme.find( '.update-message' );
			}

			// Focus on Customize button after updating.
			if ( isModalOpen ) {
				$( '.load-customize:visible' ).focus();
			} else {
				$theme.find( '.load-customize' ).focus();
			}
		}

		$notice.replaceWith( $updatedMessage );
		wp.a11y.speak( wp.updates.l10n.updatedMsg, 'polite' );

		wp.updates.decrementCount( 'theme' );

		$document.trigger( 'wp-theme-update-success', response );

		// Show updated message after modal re-rendered.
		if ( isModalOpen ) {
			$( '.theme-info .theme-author' ).after( $updatedMessage );
		}
	};

	/**
	 * On a theme update error, update the UI appropriately.
	 *
	 * @since 4.X.0
	 *
	 * @typedef {object} updateThemeError
	 * @param {object} response              Response from the server.
	 * @param {string} response.slug         Slug of the theme to be updated.
	 * @param {string} response.errorCode    Error code for the error that occurred.
	 * @param {string} response.errorMessage The error that occurred.
	 */
	wp.updates.updateThemeError = function( response ) {
		var $theme       = $( '[data-slug="' + response.slug + '"]' ),
		    errorMessage = wp.updates.l10n.updateFailed.replace( '%s', response.errorMessage ),
		    $notice;

		if ( response.errorCode && 'unable_to_connect_to_filesystem' === response.errorCode ) {
			wp.updates.credentialError( response, 'update-theme' );
			return;
		}

		if ( 'themes-network' === pagenow ) {
			$notice = $theme.find( '.update-message ' );
		} else {
			$notice = $( '.theme-info .notice' );
			if ( ! $notice.length ) {
				$notice = $theme.find( '.notice' );
			}
			$( 'body.modal-open' ).length ? $( '.load-customize:visible' ).focus() : $theme.find( '.load-customize' ).focus();
		}

		$notice.replaceWith( wp.updates.adminNotice( {
			className: 'update-message notice-error notice-alt is-dismissible',
			message:   errorMessage
		} ) );

		wp.a11y.speak( errorMessage, 'polite' );

		$document.trigger( 'wp-theme-update-error', response );
	};

	/**
	 * Send an Ajax request to the server to install a theme.
	 *
	 * @since 4.X.0
	 *
	 * @param {object}               args
	 * @param {string}               args.slug    Theme stylesheet.
	 * @param {installThemeSuccess=} args.success Optional. Success callback. Default: wp.updates.installThemeSuccess
	 * @param {installThemeError=}   args.error   Optional. Error callback. Default: wp.updates.installThemeError
	 * @return {$.promise} A jQuery promise that represents the request,
	 *                     decorated with an abort() method.
	 */
	wp.updates.installTheme = function( args ) {
		var $message = $( '.theme-install[data-slug="' + args.slug + '"]' );

		args = _.extend( {
			success: wp.updates.installThemeSuccess,
			error: wp.updates.installThemeError
		}, args );

		$message.addClass( 'updating-message' );
		$message.parents( '.theme' ).addClass( 'focus' );
		if ( $message.html() !== wp.updates.l10n.installing ) {
			$message.data( 'originaltext', $message.html() );
		}

		$message.text( wp.updates.l10n.installing );
		wp.a11y.speak( wp.updates.l10n.installingMsg, 'polite' );

		// Remove previous error messages, if any.
		$( '.install-theme-info, [data-slug="' + args.slug + '"]' ).removeClass( 'theme-install-failed' ).find( '.notice.notice-error' ).remove();

		return wp.updates.ajax( 'install-theme', args );
	};

	/**
	 * On theme install success, update the UI with the result.
	 *
	 * @since 4.X.0
	 *
	 * @typedef {object} installThemeSuccess
	 * @param {object} response      Response from the server.
	 * @param {string} response.slug Slug of the theme to be installed.
	 */
	wp.updates.installThemeSuccess = function( response ) {
		var $card    = $( '.wp-full-overlay-header, #' + response.slug ),
		    $message = $card.find( '.theme-install' );

		$card.removeClass( 'focus' ).addClass( 'is-installed' ); // Hides the button, should show banner.
		$message.removeClass( 'updating-message' ).addClass( 'updated-message disabled' );
		$message.text( wp.updates.l10n.installed );
		wp.a11y.speak( wp.updates.l10n.installedMsg, 'polite' );

		$document.trigger( 'wp-install-theme-success', response );
	};

	/**
	 * On theme install failure, update the UI appropriately.
	 *
	 * @since 4.X.0
	 *
	 * @typedef {object} installThemeError
	 * @param {object} response              Response from the server.
	 * @param {string} response.slug         Slug of the theme to be installed.
	 * @param {string} response.errorCode    Error code for the error that occurred.
	 * @param {string} response.errorMessage The error that occurred.
	 */
	wp.updates.installThemeError = function( response ) {
		var $card, $button,
		    errorMessage = wp.updates.l10n.installFailed.replace( '%s', response.errorMessage ),
		    $message     = wp.updates.adminNotice( {
			    className: 'update-message notice-error notice-alt',
			    message:   errorMessage
		    } );

		if ( response.errorCode && 'unable_to_connect_to_filesystem' === response.errorCode ) {
			wp.updates.credentialError( response, 'install-theme' );
			return;
		}

		if ( $document.find( 'body' ).hasClass( 'full-overlay-active' ) ) {
			$button = $( '.theme-install[data-slug="' + response.slug + '"]' );
			$card   = $( '.install-theme-info' ).prepend( $message );
		} else {
			$card   = $( '[data-slug="' + response.slug + '"]' ).removeClass( 'focus' ).addClass( 'theme-install-failed' ).append( $message );
			$button = $card.find( '.theme-install' );
		}

		$button
			.attr( 'aria-label', wp.updates.l10n.installFailedLabel.replace( '%s', $card.find( '.theme-name' ).text() ) )
			.text( wp.updates.l10n.installFailedShort ).removeClass( 'updating-message' );

		wp.a11y.speak( errorMessage, 'assertive' );

		$document.trigger( 'wp-theme-install-error', response );
	};

	/**
	 * Send an Ajax request to the server to install a theme.
	 *
	 * @since 4.X.0
	 *
	 * @param {object}              args
	 * @param {string}              args.slug    Theme stylesheet.
	 * @param {deleteThemeSuccess=} args.success Optional. Success callback. Default: wp.updates.deleteThemeSuccess
	 * @param {deleteThemeError=}   args.error   Optional. Error callback. Default: wp.updates.deleteThemeError
	 * @return {$.promise} A jQuery promise that represents the request,
	 *                     decorated with an abort() method.
	 */
	wp.updates.deleteTheme = function( args ) {
		var $button = $( '.theme-actions .delete-theme' );

		args = _.extend( {
			success: wp.updates.deleteThemeSuccess,
			error: wp.updates.deleteThemeError
		}, args );

		if ( $button.html() !== wp.updates.l10n.deleting ) {
			$button.data( 'originaltext', $button.html() );
		}

		$button.text( wp.updates.l10n.deleting );
		wp.a11y.speak( wp.updates.l10n.deleting, 'polite' );

		// Remove previous error messages, if any.
		$( '.theme-info .update-message' ).remove();

		return wp.updates.ajax( 'delete-theme', args );
	};

	/**
	 * On theme delete success, update the UI appropriately.
	 *
	 * @since 4.X.0
	 *
	 * @typedef {object} deleteThemeSuccess
	 * @param {object} response      Response from the server.
	 * @param {string} response.slug Slug of the theme to be deleted.
	 */
	wp.updates.deleteThemeSuccess = function( response ) {
		var $themeRow = $( '[data-slug="' + response.slug + '"]' );

		if ( 'themes-network' === pagenow ) {

			// Removes the theme and updates rows.
			$themeRow.css( { backgroundColor: '#faafaa' } ).fadeOut( 350, function() {
				var $views = $( '.subsubsub' ),
				    totals = settings.totals;

				$themeRow.remove();

				// Remove plugin from update count.
				if ( $themeRow.hasClass( 'update' ) ) {
					totals.upgrade--;
					wp.updates.decrementCount( 'theme' );
				}

				// Remove from views.
				if ( $themeRow.hasClass( 'inactive' ) ) {
					totals.disabled--;
					if ( totals.disabled ) {
						$views.find( '.disabled .count' ).text( '(' + totals.disabled + ')' );
					} else {
						$views.find( '.disabled' ).remove();
					}
				}

				// There is always at least one theme available.
				$views.find( '.all .count' ).text( '(' + --totals.all + ')' );
			} );
		}

		wp.a11y.speak( wp.updates.l10n.deleted, 'polite' );

		$document.trigger( 'wp-delete-theme-success', response );
	};

	/**
	 * On theme delete failure, update the UI appropriately.
	 *
	 * @since 4.X.0
	 *
	 * @typedef {object} deleteThemeError
	 * @param {object} response              Response from the server.
	 * @param {string} response.slug         Slug of the theme to be deleted.
	 * @param {string} response.errorCode    Error code for the error that occurred.
	 * @param {string} response.errorMessage The error that occurred.
	 */
	wp.updates.deleteThemeError = function( response ) {
		var errorMessage = wp.updates.l10n.deleteFailed.replace( '%s', response.errorMessage ),
		    $message     = wp.updates.adminNotice( {
			    className: 'update-message notice-error notice-alt',
			    message:   errorMessage
		    } ),
		    $button      = $( '.theme-actions .delete-theme' );

		if ( response.errorCode && 'unable_to_connect_to_filesystem' === response.errorCode ) {
			wp.updates.credentialError( response, 'delete-theme' );
			return;
		}

		if ( 'themes-network' === pagenow ) {
			$( 'tr[data-slug="' + response.slug + '"]' ).find( '.column-description' ).prepend( $message );
		} else {
			$( '.theme-info .theme-description' ).before( $message );
		}
		$button.html( $button.data( 'originaltext' ) );

		wp.a11y.speak( errorMessage, 'assertive' );

		$document.trigger( 'wp-theme-delete-error', response );
	};

	/**
	 * Send an Ajax request to the server to update a single item in the updates list table
	 *
	 * @since 4.X.0
	 *
	 * @param {object}             args           Arguments.
	 * @param {string}             args.version   The version to update to.
	 * @param {string}             args.locale    The locale to get the update for.
	 * @param {boolean}            args.reinstall Whether this is a reinstall request or not.
	 * @param {updateItemSuccess=} args.success   Optional. Success callback. Default: wp.updates.updateItemSuccess
	 * @param {updateItemError=}   args.error     Optional. Error callback. Default: wp.updates.updateItemError
	 * @return {$.promise} A jQuery promise that represents the request,
	 *                     decorated with an abort() method.
	 */
	wp.updates.updateCore = function( args ) {
		var $message;

		args = _.extend( {
			success: wp.updates.updateItemSuccess,
			error: wp.updates.updateItemError
		}, args );

		$message = $( '[data-type="core"]' ).filter( function() {
			return args.reinstall && $( this ).is( '.wordpress-reinstall-card' ) ||
				! args.reinstall && ! $( this ).is( '.wordpress-reinstall-card' ) && args.locale === $( this ).data( 'locale' );
		} ).find( '.update-link' );

		if ( $message.html() !== wp.updates.l10n.updating ) {
			$message.data( 'originaltext', $message.html() );
		}

		$message.addClass( 'updating-message' )
			.attr( 'aria-label', wp.updates.l10n.updatingCoreLabel )
			.text( wp.updates.l10n.updating );

		return wp.updates.ajax( 'update-core', args );
	};

	/**
	 * Send an Ajax request to the server to update a single item in the updates list table
	 *
	 * @since 4.X.0
	 *
	 * @param {object}             args         Arguments.
	 * @param {updateItemSuccess=} args.success Optional. Success callback. Default: wp.updates.updateItemSuccess
	 * @param {updateItemError=}   args.error   Optional. Error callback. Default: wp.updates.updateItemError
	 * @return {$.promise} A jQuery promise that represents the request,
	 *                     decorated with an abort() method.
	 */
	wp.updates.updateTranslations = function( args ) {
		var $message = $( '[data-type="translations"]' ).find( '.update-link' );

		args = _.extend( {
			success: wp.updates.updateItemSuccess,
			error: wp.updates.updateItemError
		}, args );

		if ( $message.html() !== wp.updates.l10n.updating ) {
			$message.data( 'originaltext', $message.html() );
		}

		$message.addClass( 'updating-message' )
			.attr( 'aria-label', wp.updates.l10n.updatingTranslationsLabel )
			.text( wp.updates.l10n.updating );

		return wp.updates.ajax( 'update-translations', args );
	};

	/**
	 * Send an Ajax request to the server to install all available updates.
	 *
	 * @since 4.X.0
	 * @param {jQuery} $itemRow jQuery object of the item to be updated.
	 */
	wp.updates.updateItem = function( $itemRow ) {
		var type   = $itemRow.data( 'type' ),
		    update = {
				type: 'update-' + type,
				data: {
					success: wp.updates.updateItemSuccess,
					error:   wp.updates.updateItemError
				}
			};

		switch ( type ) {
			case 'plugin':
				update.data.plugin = $itemRow.data( 'plugin' );
				update.data.slug   = $itemRow.data( 'slug' );
				break;

			case 'theme':
				update.data.slug = $itemRow.data( 'slug' );
				break;

			case 'core':

				// The update queue should only ever contain one core update.
				if ( _.findWhere( wp.updates.updateQueue, { type: 'update-core' } ) ) {
					return;
				}

				update.data.version   = $itemRow.data( 'version' );
				update.data.locale    = $itemRow.data( 'locale' );
				update.data.reinstall = !! $itemRow.data( 'reinstall' );
				break;
		}

		wp.updates.updateQueue.push( update );
		wp.updates.queueChecker();
	};

	/**
	 * On a successful core update, update the UI appropriately and redirect to the about page.
	 *
	 * @since 4.X.0
	 *
	 * @typedef {object} updateItemSuccess
	 * @param {object}  response            Response from the server.
	 * @param {string}  response.update     The type of update. 'core', 'plugin', 'theme', or 'translations'.
	 * @param {string=} response.slug       Optional. Slug of the theme or plugin that was updated.
	 * @param {string=} response.reinstall  Optional. Whether this was a reinstall request or not.
	 * @param {string=} response.redirect   Optional. URL to redirect to after updating Core.
	 * @param {string=} response.plugin     Optional. Basename of the plugin that was updated.
	 * @param {string=} response.pluginName Optional. Name of the plugin that was updated.
	 * @param {string=} response.oldVersion Optional. Old version of the theme or plugin.
	 * @param {string=} response.newVersion Optional. New version of the theme or plugin.
	 */
	wp.updates.updateItemSuccess = function( response ) {
		var type = response.update,
		    $row = $( '[data-type="' + type + '"]' );

		if ( 'plugin' === type || 'theme' === type ) {
			$row = $row.filter( '[data-slug="' + response.slug + '"]' );
		} else if ( 'core' === type ) {
			$row = $row.filter( function() {
				return 'reinstall' === response.reinstall && $( this ).is( '.wordpress-reinstall-card' ) ||
					'reinstall' !== response.reinstall && ! $( this ).is( '.wordpress-reinstall-card' );
			} );
		}

		$row.find( '.update-link' )
			.removeClass( 'updating-message' )
			.addClass( 'updated-message' )
			.attr( 'aria-label', wp.updates.l10n.updated )
			.prop( 'disabled', true )
			.text( wp.updates.l10n.updated );

		wp.a11y.speak( wp.updates.l10n.updatedMsg, 'polite' );

		wp.updates.decrementCount( type );

		if ( 'core' === type && response.redirect ) {
			wp.updates.coreUpdateRedirect = response.redirect;
		}

		$document.trigger( 'wp-' + type + '-update-success', response );
	};

	/**
	 * On a core update error, update the UI appropriately.
	 *
	 * @since 4.X.0
	 *
	 * @typedef {object} updateItemError
	 * @param {object}  response              Response from the server.
	 * @param {string}  response.update       The type of update. 'core', 'plugin', 'theme', or 'translations'.
	 * @param {string}  response.errorCode    Error code for the error that occurred.
	 * @param {string}  response.errorMessage The error that occurred.
	 * @param {string=} response.slug         Optional. Slug of the theme or plugin that was updated.
	 * @param {string=} response.plugin       Optional. Basename of the plugin that was updated.
	 * @param {string=} response.pluginName   Optional. Name of the plugin that was updated.
	 * @param {string=} response.reinstall    Optional. Whether this was a reinstall request or not.
	 */
	wp.updates.updateItemError = function( response ) {
		var type = response.update,
		    $row = $( '[data-type="' + type + '"]' ),
		    errorMessage = wp.updates.l10n.updateFailed.replace( '%s', response.errorMessage );

		if ( response.errorCode && 'unable_to_connect_to_filesystem' === response.errorCode ) {
			wp.updates.credentialError( response, 'update-' + response.update );
			return;
		}

		if ( 'plugin' === type || 'theme' === type ) {
			$row = $row.filter( '[data-slug="' + response.slug + '"]' );
		} else if ( 'core' === type ) {
			$row = $row.filter( function() {
				return 'reinstall' === response.reinstall && $( this ).is( '.wordpress-reinstall-card' ) ||
					'reinstall' !== response.reinstall && ! $( this ).is( '.wordpress-reinstall-card' );
			} );
		}

		$row.find( '.update-link' )
			.removeClass( 'updating-message' )
			.attr( 'aria-label', wp.updates.l10n.updateFailedShort )
			.prop( 'disabled', true )
			.text( wp.updates.l10n.updateFailedShort );

		wp.updates.addAdminNotice( {
			id:        response.errorCode,
			className: 'notice-error is-dismissible',
			message:   errorMessage
		} );

		wp.a11y.speak( errorMessage, 'assertive' );

		$document.trigger( 'wp-' + type + '-update-error', response );
	};

	/**
	 * Adds the appropriate callback based on the type of action and the current page.
	 *
	 * @since 4.X.0
	 *
	 * @param {object} data AJAX payload.
	 * @param {string} type The type of action.
	 * @return {object} The AJAX payload with the appropriate callbacks.
	 */
	wp.updates._addCallbacks = function( data, type ) {
		if ( 'update-core' === pagenow || 'update-core-network' === pagenow ) {
			data.success = wp.updates.updateItemSuccess;
			data.error   = wp.updates.updateItemError;

		} else if ( 'import' === pagenow && 'install-plugin' === type ) {
			data.success = wp.updates.installImporterSuccess;
			data.error   = wp.updates.installImporterError;
		}

		return data;
	};

	/**
	 * If an install/update job has been placed in the queue, queueChecker pulls it out and runs it.
	 *
	 * @since 4.2.0
	 * @since 4.X.0 Can handle multiple job types.
	 */
	wp.updates.queueChecker = function() {
		var job;

		if ( wp.updates.updateQueue.length <= 0 ) {
			return;
		}

		job = wp.updates.updateQueue.shift();

		// Handle a queue job.
		switch ( job.type ) {
			case 'install-plugin':
				wp.updates.installPlugin( job.data );
				break;

			case 'update-plugin':
				wp.updates.updatePlugin( job.data );
				break;

			case 'delete-plugin':
				wp.updates.deletePlugin( job.data );
				break;

			case 'install-theme':
				wp.updates.installTheme( job.data );
				break;

			case 'update-theme':
				wp.updates.updateTheme( job.data );
				break;

			case 'delete-theme':
				wp.updates.deleteTheme( job.data );
				break;

			case 'update-core':
				wp.updates.updateCore( job.data );
				break;

			case 'update-translations':
				wp.updates.updateTranslations( job.data );
				break;

			default:
				window.console.error( 'Failed to execute queued update job.', job );
				break;
		}
	};

	/**
	 * Request the users filesystem credentials if we don't have them already.
	 *
	 * @since 4.2.0
	 *
	 * @param {Event=} event Optional. Event interface.
	 */
	wp.updates.requestFilesystemCredentials = function( event ) {
		if ( false === wp.updates.filesystemCredentials.available ) {
			/*
			 * After exiting the credentials request modal,
			 * return the focus to the element triggering the request.
			 */
			if ( event && ! wp.updates.$elToReturnFocusToFromCredentialsModal ) {
				wp.updates.$elToReturnFocusToFromCredentialsModal = $( event.target );
			}

			wp.updates.updateLock = true;
			wp.updates.requestForCredentialsModalOpen();
		}
	};

	/**
	 * Keydown handler for the request for credentials modal.
	 *
	 * Close the modal when the escape key is pressed.
	 * Constrain keyboard navigation to inside the modal.
	 *
	 * @since 4.2.0
	 *
	 * @param {Event} event Event interface.
	 */
	wp.updates.keydown = function( event ) {
		if ( 27 === event.keyCode ) {
			wp.updates.requestForCredentialsModalCancel();
		} else if ( 9 === event.keyCode ) {

			// #upgrade button must always be the last focus-able element in the dialog.
			if ( 'upgrade' === event.target.id && ! event.shiftKey ) {
				$( '#hostname' ).focus();

				event.preventDefault();
			} else if ( 'hostname' === event.target.id && event.shiftKey ) {
				$( '#upgrade' ).focus();

				event.preventDefault();
			}
		}
	};

	/**
	 * Open the request for credentials modal.
	 *
	 * @since 4.2.0
	 */
	wp.updates.requestForCredentialsModalOpen = function() {
		var $modal = $( '#request-filesystem-credentials-dialog' );

		$( 'body' ).addClass( 'modal-open' );
		$modal.show();
		$modal.find( 'input:enabled:first' ).focus();
		$modal.on( 'keydown', wp.updates.keydown );
	};

	/**
	 * Close the request for credentials modal.
	 *
	 * @since 4.2.0
	 */
	wp.updates.requestForCredentialsModalClose = function() {
		$( '#request-filesystem-credentials-dialog' ).hide();
		$( 'body' ).removeClass( 'modal-open' );

		if ( wp.updates.$elToReturnFocusToFromCredentialsModal ) {
			wp.updates.$elToReturnFocusToFromCredentialsModal.focus();
		}
	};

	/**
	 * The steps that need to happen when the modal is canceled out
	 *
	 * @since 4.2.0
	 * @since 4.X.0 Triggers an event for callbacks to listen to and add their actions.
	 */
	wp.updates.requestForCredentialsModalCancel = function() {

		// No updateLock and no updateQueue means we already have cleared things up.
		if ( false === wp.updates.updateLock && 0 === wp.updates.updateQueue.length ) {
			return;
		}

		_.each( wp.updates.updateQueue, function( job ) {
			$document.trigger( 'credential-modal-cancel', job );
		} );

		// Remove the lock, and clear the queue.
		wp.updates.updateLock  = false;
		wp.updates.updateQueue = [];

		wp.updates.requestForCredentialsModalClose();
	};

	/**
	 * Show an error message in the request for credentials form.
	 *
	 * @since 4.2.0
	 *
	 * @param {string} message Error message.
	 */
	wp.updates.showErrorInCredentialsForm = function( message ) {
		var $modal = $( '#request-filesystem-credentials-form' );

		// Remove any existing error.
		$modal.find( '.notice' ).remove();
		$modal.find( 'h2' ).after( '<div class="notice notice-alt notice-error"><p>' + message + '</p></div>' );
	};

	/**
	 * Events that need to happen when there is a credential error.
	 *
	 * @since 4.2.0
	 *
	 * @param {object} response Ajax response.
	 * @param {string} type     The type of action.
	 */
	wp.updates.credentialError = function( response, type ) {

		// Restore callbacks.
		response = wp.updates._addCallbacks( response, type );

		wp.updates.updateQueue.push( {
			type: type,

			/*
			 * Not cool that we're depending on response for this data.
			 * This would feel more whole in a view all tied together.
			 */
			data: response
		} );

		wp.updates.filesystemCredentials.available = false;
		wp.updates.showErrorInCredentialsForm( response.errorMessage );
		wp.updates.requestFilesystemCredentials();
	};

	/**
	 * Potentially add an AYS to a user attempting to leave the page.
	 *
	 * If an update is on-going and a user attempts to leave the page,
	 * open an "Are you sure?" alert.
	 *
	 * @since 4.2.0
	 */
	wp.updates.beforeunload = function() {
		if ( wp.updates.updateLock ) {
			return wp.updates.l10n.beforeunload;
		}
	};

	$( function() {
		var $theList         = $( '.wp-list-table:not(.updates)' ),
		    $bulkActionForm  = $( '#bulk-action-form' ),
		    $filesystemModal = $( '#request-filesystem-credentials-dialog' );

		/*
		 * Check whether a user needs to submit filesystem credentials based on whether
		 * the form was output on the page server-side.
		 *
		 * @see {wp_print_request_filesystem_credentials_modal() in PHP}
		 */
		wp.updates.shouldRequestFilesystemCredentials = $filesystemModal.length > 0;

		/**
		 * File system credentials form submit noop-er / handler.
		 *
		 * @since 4.2.0
		 */
		$filesystemModal.on( 'submit', 'form', function( event ) {
			event.preventDefault();

			// Persist the credentials input by the user for the duration of the page load.
			wp.updates.filesystemCredentials.ftp.hostname       = $( '#hostname' ).val();
			wp.updates.filesystemCredentials.ftp.username       = $( '#username' ).val();
			wp.updates.filesystemCredentials.ftp.password       = $( '#password' ).val();
			wp.updates.filesystemCredentials.ftp.connectionType = $( 'input[name="connection_type"]:checked' ).val();
			wp.updates.filesystemCredentials.ssh.publicKey      = $( '#public_key' ).val();
			wp.updates.filesystemCredentials.ssh.privateKey     = $( '#private_key' ).val();
			wp.updates.filesystemCredentials.available          = true;

			// Unlock and invoke the queue.
			wp.updates.updateLock = false;
			wp.updates.queueChecker();

			wp.updates.requestForCredentialsModalClose();
		} );

		/**
		 * Close the request credentials modal when clicking the 'Cancel' button or outside of the modal.
		 *
		 * @since 4.2.0
		 */
		$filesystemModal.on( 'click', '[data-js-action="close"], .notification-dialog-background', wp.updates.requestForCredentialsModalCancel );

		/**
		 * Hide SSH fields when not selected.
		 *
		 * @since 4.2.0
		 */
		$filesystemModal.on( 'change', 'input[name="connection_type"]', function() {
			$( '#ssh-keys' ).toggleClass( 'hidden', ( 'ssh' !== $( this ).val() ) );
		} ).change();

		/**
		 * Handle events after the credential modal was closed.
		 *
		 * @since 4.X.0
		 *
		 * @param {Event}  event  Event interface.
		 * @param {string} job    The install/update.delete request.
		 */
		$document.on( 'credential-modal-cancel', function( event, job ) {
			var $message, originalText;

			if ( 'update-core' === pagenow || 'update-core-network' === pagenow ) {
				$( '.updating-message' ).removeClass( 'updating-message' ).text( function() {
					return $( this ).data( 'originaltext' );
				} );
			} else if ( 'plugins' === pagenow || 'plugins-network' === pagenow ) {
				$message = $( 'tr[data-plugin="' + job.data.plugin + '"]' ).find( '.update-message' );
			} else if ( 'plugin-install' === pagenow || 'plugin-install-network' === pagenow ) {
				$message = $( '.update-now.updating-message' );
			} else {
				$message = $( '.updating-message' );
			}

			if ( $message ) {
				originalText = $message.data( 'originaltext' );
				if ( 'undefined' === typeof originalText ) {
					originalText = $( '<p>' ).html( $message.find( 'p' ).data( 'originaltext' ) );
				}

				$message.removeClass( 'updating-message' );
				$message.html( originalText );
			}

			wp.a11y.speak( wp.updates.l10n.updateCancel, 'polite' );
		} );

		/**
		 * Click handler for plugin updates in List Table view.
		 *
		 * @since 4.2.0
		 *
		 * @param {Event} event Event interface.
		 */
		$theList.on( 'click', '[data-plugin] .update-link', function( event ) {
			var $message   = $( event.target ),
			    $pluginRow = $message.parents( 'tr' );

			event.preventDefault();

			if ( $message.hasClass( 'updating-message' ) || $message.hasClass( 'button-disabled' ) ) {
				return;
			}

			if ( wp.updates.shouldRequestFilesystemCredentials && ! wp.updates.updateLock ) {
				wp.updates.requestFilesystemCredentials( event );
			}

			// Return the user to the input box of the plugin's table row after closing the modal.
			wp.updates.$elToReturnFocusToFromCredentialsModal = $pluginRow.find( '.check-column input' );
			wp.updates.updatePlugin( {
				plugin: $pluginRow.data( 'plugin' ),
				slug:   $pluginRow.data( 'slug' )
			} );
		} );

		/**
		 * Click handler for plugin updates in plugin install view.
		 *
		 * @since 4.2.0
		 *
		 * @param {Event} event Event interface.
		 */
		$( '.plugin-card' ).on( 'click', '.update-now', function( event ) {
			var $button = $( event.target );
			event.preventDefault();

			if ( $button.hasClass( 'updating-message' ) || $button.hasClass( 'button-disabled' ) ) {
				return;
			}

			if ( wp.updates.shouldRequestFilesystemCredentials && ! wp.updates.updateLock ) {
				wp.updates.requestFilesystemCredentials( event );
			}

			wp.updates.updatePlugin( {
				plugin: $button.data( 'plugin' ),
				slug:   $button.data( 'slug' )
			} );
		} );

		/**
		 * Install a plugin.
		 *
		 * @since 4.X.0
		 *
		 * @param {Event} event Event interface.
		 */
		$theList.on( 'click', '.install-now', function( event ) {
			var $button = $( event.target );
			event.preventDefault();

			if ( $button.hasClass( 'updating-message' ) || $button.hasClass( 'button-disabled' ) ) {
				return;
			}

			if ( wp.updates.shouldRequestFilesystemCredentials && ! wp.updates.updateLock ) {
				wp.updates.requestFilesystemCredentials( event );

				$document.on( 'credential-modal-cancel', function() {
					var $message = $( '.install-now.updating-message' );

					$message.removeClass( 'updating-message' );
					$message.text( wp.updates.l10n.installNow );
					wp.a11y.speak( wp.updates.l10n.updateCancel, 'polite' );
				} );
			}

			wp.updates.installPlugin( {
				slug: $button.data( 'slug' )
			} );
		} );

		/**
		 * Delete a plugin.
		 *
		 * @since 4.X.0
		 *
		 * @param {Event} event Event interface.
		 */
		$theList.on( 'click', '[data-plugin] a.delete', function( event ) {
			var $pluginRow = $( event.target ).parents( 'tr' );

			event.preventDefault();

			if ( ! window.confirm( wp.updates.l10n.aysDelete.replace( '%s', $pluginRow.find( '.plugin-title strong' ).text() ) ) ) {
				return;
			}

			if ( wp.updates.shouldRequestFilesystemCredentials && ! wp.updates.updateLock ) {
				wp.updates.requestFilesystemCredentials( event );
			}

			wp.updates.deletePlugin( {
				plugin: $pluginRow.data( 'plugin' ),
				slug:   $pluginRow.data( 'slug' )
			} );

		} );

		/**
		 * Update a theme.
		 *
		 * @since 4.X.0
		 *
		 * @param {Event} event Event interface.
		 */
		$document.on( 'click', '.themes-php.network-admin .update-link', function( event ) {
			var $message  = $( event.target ),
			    $themeRow = $message.parents( 'tr' );

			event.preventDefault();

			if ( $message.hasClass( 'updating-message' ) || $message.hasClass( 'button-disabled' ) ) {
				return;
			}

			if ( wp.updates.shouldRequestFilesystemCredentials && ! wp.updates.updateLock ) {
				wp.updates.requestFilesystemCredentials( event );
			}

			// Return the user to the input box of the theme's table row after closing the modal.
			wp.updates.$elToReturnFocusToFromCredentialsModal = $themeRow.find( '.check-column input' );
			wp.updates.updateTheme( {
				slug: $themeRow.data( 'slug' )
			} );
		} );

		/**
		 * Delete a theme.
		 *
		 * @since 4.X.0
		 *
		 * @param {Event} event Event interface.
		 */
		$document.on( 'click', '.themes-php.network-admin a.delete', function( event ) {
			var $themeRow = $( event.target ).parents( 'tr' );

			event.preventDefault();

			if ( ! window.confirm( wp.updates.l10n.aysDelete.replace( '%s', $themeRow.find( '.plugin-title strong' ).text() ) ) ) {
				return;
			}

			if ( wp.updates.shouldRequestFilesystemCredentials && ! wp.updates.updateLock ) {
				wp.updates.requestFilesystemCredentials( event );
			}

			wp.updates.deleteTheme( {
				slug: $themeRow.data( 'slug' )
			} );
		} );

		/**
		 * Bulk action handler for plugins.
		 *
		 * @since 4.X.0
		 *
		 * @param {Event} event Event interface.
		 */
		$bulkActionForm.on( 'click', '[type="submit"]', function( event ) {
			var action        = $( event.target ).siblings( 'select' ).val(),
			    itemsSelected = $bulkActionForm.find( 'input[name="checked[]"]:checked' ),
			    success       = 0,
			    error         = 0,
			    errorMessages = [],
			    pluginAction;

			if ( 'plugins' !== pagenow && 'plugins-network' !== pagenow ) {
				return;
			}

			if ( ! itemsSelected.length ) {
				event.preventDefault();
				$( 'html, body' ).animate( { scrollTop: 0 } );

				return wp.updates.addAdminNotice( {
					id:        'no-items-selected',
					className: 'notice-error is-dismissible',
					message:   wp.updates.l10n.noItemsSelected
				} );
			}

			switch ( action ) {
				case 'update-selected':
					pluginAction = wp.updates.updatePlugin;
					break;

				case 'delete-selected':
					if ( ! window.confirm( wp.updates.l10n.aysBulkDelete ) ) {
						event.preventDefault();
						return;
					}

					pluginAction = wp.updates.deletePlugin;
					break;

				default:
					window.console.error( 'Failed to identify bulk action: %s', action );
					return;
			}

			if ( wp.updates.shouldRequestFilesystemCredentials && ! wp.updates.updateLock ) {
				wp.updates.requestFilesystemCredentials( event );
			}

			event.preventDefault();

			// Un-check the bulk checkboxes.
			$bulkActionForm.find( '.manage-column [type="checkbox"]' ).prop( 'checked', false );

			// Find all the checkboxes which have been checked.
			itemsSelected.each( function( index, element ) {
				var $checkbox  = $( element ),
				    $pluginRow = $checkbox.parents( 'tr' );

				// Un-check the box.
				$checkbox.prop( 'checked', false );

				// Only add update-able plugins to the update queue.
				if ( 'update-selected' === action && ! $pluginRow.hasClass( 'update' ) ) {
					return;
				}

				pluginAction( {
					plugin:  $pluginRow.data( 'plugin' ),
					slug:    $pluginRow.data( 'slug' )
				} );
			} );

			$document.on( 'wp-plugin-update-success wp-plugin-update-error', function( event, response ) {
				if ( 'wp-plugin-update-success' === event.type ) {
					success++;
				} else {
					error++;
					errorMessages.push( response.pluginName + ': ' + response.errorMessage );
				}

				wp.updates.adminNotice = wp.template( 'wp-bulk-updates-admin-notice' );

				wp.updates.addAdminNotice( {
					id:            'bulk-action-notice',
					successes:     success,
					errors:        error,
					errorMessages: errorMessages
				} );

				$( '#bulk-action-notice' ).on( 'click', 'button', function() {
					$( '#bulk-action-notice' ).find( 'ul' ).toggleClass( 'hidden' );
				} );

				if ( 0 < error && 0 === wp.updates.updateQueue.length ) {
					$( 'html, body' ).animate( { scrollTop: 0 } );
				}
			} );

			// Reset admin notice template after #bulk-action-notice was added.
			$document.on( 'wp-updates-notice-added', function() {
				wp.updates.adminNotice = wp.template( 'wp-updates-admin-notice' );
			} );
		} );

		/**
		 * Bulk action handler for themes.
		 *
		 * @since 4.X.0
		 *
		 * @param {Event} event Event interface.
		 */
		$bulkActionForm.on( 'click', '[type="submit"]', function( event ) {
			var action        = $( event.target ).siblings( 'select' ).val(),
			    itemsSelected = $bulkActionForm.find( 'input[name="checked[]"]:checked' ),
			    themeAction;

			if ( 'themes-network' !== pagenow ) {
				return;
			}

			if ( ! itemsSelected.length ) {
				event.preventDefault();
				$( 'html, body' ).animate( { scrollTop: 0 } );

				return wp.updates.addAdminNotice( {
					id:        'no-items-selected',
					className: 'notice-error is-dismissible',
					message:   wp.updates.l10n.noItemsSelected
				} );
			}

			switch ( action ) {
				case 'update-selected':
					themeAction = wp.updates.updateTheme;
					break;

				case 'delete-selected':
					themeAction = wp.updates.deleteTheme;
					break;

				default:
					window.console.error( 'Failed to identify bulk action: %s', action );
					return;
			}

			if ( wp.updates.shouldRequestFilesystemCredentials && ! wp.updates.updateLock ) {
				wp.updates.requestFilesystemCredentials( event );
			}

			event.preventDefault();

			// Un-check the bulk checkboxes.
			$bulkActionForm.find( '.manage-column [type="checkbox"]' ).prop( 'checked', false );

			// Find all the checkboxes which have been checked.
			itemsSelected.each( function( index, element ) {
				var $checkbox = $( element ),
				    $themeRow = $checkbox.parents( 'tr' );

				// Un-check the box.
				$checkbox.prop( 'checked', false );

				// Only add update-able themes to the update queue.
				if ( 'update-selected' === action && ! $themeRow.hasClass( 'update' ) ) {
					return;
				}

				themeAction( {
					slug: $themeRow.data( 'slug' )
				} );
			} );
		} );

		/**
		 * Click handler for updates in the Update List Table view.
		 *
		 * Handles the re-install core button and "Update All" as well.
		 *
		 * @since 4.X.0
		 *
		 * @param {Event} event Event interface.
		 */
		$( '.update-core-php .update-link' ).on( 'click', function( event ) {
			var $message = $( event.target ),
			    $coreRow = $( '.update-link[data-type="core"]' ).not( this ),
				$itemRow = $message.parents( '[data-type]' );

			// There are two 'Update All' buttons
			if ( 'all' === $message.data( 'type' ) ) {
				$message = $( '.update-link[data-type="all"]' );
			}

			event.preventDefault();

			// The item has already been updated, do not proceed.
			if ( 0 === $message.length || $message.hasClass( 'updated-message' ) || $message.hasClass( 'updating-message' ) || $message.hasClass( 'button-disabled' ) ) {
				return;
			}

			// Bail if there's already another core update going on.
			if ( $coreRow.not( this ).hasClass( 'updated-message' ) || $coreRow.not( this ).hasClass( 'updating-message' ) || $coreRow.hasClass( 'button-disabled' ) ) {
				return;
			}

			if ( wp.updates.shouldRequestFilesystemCredentials && ! wp.updates.updateLock ) {
				wp.updates.requestFilesystemCredentials( event );
			}

			if ( 'all' === $message.data( 'type' ) ) {
				if ( $message.html() !== wp.updates.l10n.updating ) {
					$message.data( 'originaltext', $message.html() );
				}

				$message.addClass( 'updating-message' ).attr( 'aria-label', wp.updates.l10n.updatingAllLabel ).text( wp.updates.l10n.updating );

				$document.on( 'wp-plugin-update-success wp-theme-update-success wp-core-update-success wp-translations-update-success wp-plugin-update-error wp-theme-update-error wp-core-update-error wp-translations-update-error ', function() {
					if ( 0 === wp.updates.updateQueue.length ) {
						$message
							.removeClass( 'updating-message' )
							.attr( 'aria-label', wp.updates.l10n.updated )
							.prop( 'disabled', true )
							.text( wp.updates.l10n.updated );

						// Redirect to about page after a core update took place.
						if ( wp.updates.coreUpdateRedirect ) {
							window.location = wp.updates.coreUpdateRedirect;
						}
					}
				} );

				// Translations first, themes and plugins afterwards before updating core at last.
				$( $( 'tr[data-type]', '#wp-updates-table' ).get().reverse() ).each( function( index, element ) {
					var $itemRow = $( element );

					if ( $( '.update-link', $itemRow ).prop( 'disabled' ) ) {
						return;
					}

					// When there are two core updates (en_US + localized), only update the localized one.
					if ( 1 < $( '.update-link[data-type="core"]' ).length && 'core' === $itemRow.data( 'type' ) && 'en_US' === $itemRow.data( 'locale' ) ) {
						return;
					}

					wp.updates.updateItem( $itemRow );
				} );
			} else {
				wp.updates.updateItem( $itemRow );
			}
		} );

		/**
		 * Make notices dismissible.
		 *
		 * @since 4.X.0
		 */
		$document.on( 'wp-updates-notice-added wp-theme-update-error wp-theme-install-error', function() {
			$( '.notice.is-dismissible' ).each( function() {
				var $notice = $( this ),
				    $button = $( '<button type="button" class="notice-dismiss"><span class="screen-reader-text"></span></button>' ),
				    /** @property {string} commonL10n.dismiss Dismiss message. */
				    btnText = commonL10n.dismiss || '';

				// Ensure plain text.
				$button.find( '.screen-reader-text' ).text( btnText );
				$button.on( 'click.wp-dismiss-notice', function( event ) {
					event.preventDefault();

					$notice.fadeTo( 100, 0, function() {
						$notice.slideUp( 100, function() {
							$notice.remove();
						} );
					} );
				} );

				$notice.append( $button );
			} );
		} );

		/**
		 * Handle changes to the plugin search box on the new-plugin page,
		 * searching the repository dynamically.
		 *
		 * @since 4.X.0
		 *
		 * @todo Add a spinner during search?
		 */
		$( 'input.wp-filter-search' ).on( 'keyup search', _.debounce( function() {
			var data = {
				_ajax_nonce: wp.updates.ajaxNonce,
				s:           $( this ).val(),
				tab:         'search',
				type:        $( '#typeselector' ).val()
			};

			if ( 'undefined' !== typeof wp.updates.searchRequest ) {
				wp.updates.searchRequest.abort();
			}

			wp.updates.searchRequest = wp.ajax.post( 'search-install-plugins', data ).done( function( response ) {
				$theList.empty().append( response.items );
				delete wp.updates.searchRequest;
			} );
		}, 250 ) );

		/**
		 * Handle changes to the plugin search box on the Installed Plugins screen,
		 * searching the plugin list dynamically.
		 *
		 * @since 4.X.0
		 *
		 * @todo Add a spinner during search?
		 */
		$( '#plugin-search-input' ).on( 'keyup search', _.debounce( function() {
			var data = {
				_ajax_nonce: wp.updates.ajaxNonce,
				s:           $( this ).val()
			};

			if ( 'undefined' !== typeof wp.updates.searchRequest ) {
				wp.updates.searchRequest.abort();
			}

			wp.updates.searchRequest = wp.ajax.post( 'search-plugins', data ).done( function( response ) {

				// Can we just ditch this whole subtitle business?
				var $subTitle    = $( '<span />' ).addClass( 'subtitle' ).text( wp.updates.l10n.searchResults.replace( '%s', data.s ) ),
				    $oldSubTitle = $( '.wrap .subtitle' );

				if ( 0 === data.s.length ) {
					$oldSubTitle.remove();
				} else if ( $oldSubTitle.length ) {
					$oldSubTitle.replaceWith( $subTitle );
				} else {
					$( '.wrap h1' ).append( $subTitle );
				}

				$( '#bulk-action-form' ).empty().append( response.items );
				delete wp.updates.searchRequest;
			} );
		}, 250 ) );

		/**
		 * Trigger a search event when the search type gets changed.
		 *
		 * @since 4.X.0
		 */
		$( '#typeselector' ).on( 'change', function() {
			$( 'input.wp-filter-search' ).trigger( 'search' );
		} );

		/**
		 * Update plugin from the details modal on `plugin-install.php`.
		 *
		 * @since 4.2.0
		 *
		 * @param {Event} event Event interface.
		 */
		$( '#plugin_update_from_iframe' ).on( 'click', function( event ) {
			var target = window.parent === window ? null : window.parent,
			    update;

			$.support.postMessage = !! window.postMessage;

			if ( false === $.support.postMessage || null === target ) {
				return;
			}

			event.preventDefault();

			update = {
				action: 'updatePlugin',
				type:   'update-plugin',
				data:   {
					plugin:  $( this ).data( 'plugin' ),
					slug:    $( this ).data( 'slug' )
				}
			};

			target.postMessage( JSON.stringify( update ), window.location.origin );
		} );

		/**
		 * Install plugin from the details modal on `plugin-install.php`.
		 *
		 * @since 4.X.0
		 *
		 * @param {Event} event Event interface.
		 */
		$( '#plugin_install_from_iframe' ).on( 'click', function( event ) {
			var target = window.parent === window ? null : window.parent,
				install;

			$.support.postMessage = !! window.postMessage;

			if ( false === $.support.postMessage || null === target ) {
				return;
			}

			event.preventDefault();

			install = {
				action: 'installPlugin',
				type:   'install-plugin',
				data:   {
					slug: $( this ).data( 'slug' )
				}
			};

			target.postMessage( JSON.stringify( install ), window.location.origin );
		} );

		/**
		 * Handles postMessage events.
		 *
		 * @since 4.2.0
		 * @since 4.X.0 Switched `update-plugin` action to use the updateQueue.
		 *
		 * @param {Event} event Event interface.
		 */
		$( window ).on( 'message', function( event ) {
			var originalEvent  = event.originalEvent,
			    expectedOrigin = document.location.protocol + '//' + document.location.hostname,
			    message;

			if ( originalEvent.origin !== expectedOrigin ) {
				return;
			}

			message = $.parseJSON( originalEvent.data );

			if ( 'undefined' === typeof message.action ) {
				return;
			}

			switch ( message.action ) {
				/*
				 * Called from `wp-admin/includes/class-wp-upgrader-skins.php`.
				 * @todo Check if that can be removed once this plugin was merged.
				 */
				case 'decrementUpdateCount':
					/** @property {string} message.upgradeType */
					wp.updates.decrementCount( message.upgradeType );
					break;

				case 'updatePlugin':
					/* jscs:disable requireCamelCaseOrUpperCaseIdentifiers */
					window.tb_remove();
					/* jscs:enable */

					message.data = wp.updates._addCallbacks( message.data, 'update-plugin' );

					wp.updates.updateQueue.push( message );
					wp.updates.queueChecker();
					break;

				case 'installPlugin':
					/* jscs:disable requireCamelCaseOrUpperCaseIdentifiers */
					window.tb_remove();
					/* jscs:enable */

					message.data.success = wp.updates.installPluginSuccess;
					message.data.error   = wp.updates.installPluginError;
					message.data = wp.updates._addCallbacks( message.data, 'install-plugin' );

					if ( 'import' === pagenow ) {
						message.data.success = wp.updates.installImporterSuccess;
						message.data.error   = wp.updates.installImporterError;
					} else {
						message.data.success = wp.updates.installPluginSuccess;
						message.data.error   = wp.updates.installPluginError;
					}

					wp.updates.updateQueue.push( message );
					wp.updates.queueChecker();
					break;
			}
		} );

		/**
		 * Adds a callback to display a warning before leaving the page.
		 *
		 * @since 4.2.0
		 */
		$( window ).on( 'beforeunload', wp.updates.beforeunload );
	} );
})( jQuery, window.wp, window._wpUpdatesSettings );
