/* global pagenow, pluginData, commonL10n, _ */
window.wp = window.wp || {};

(function( $, wp ) {
	var $document = $( document );

	// Not needed in core.
	wp.updates = wp.updates || {};

	// Not needed in core.
	wp.updates.l10n = _.extend( wp.updates.l10n, window.shinyUpdates );

	/**
	 * Actions performed after every Ajax request.
	 *
	 * @todo Maybe we can find a better function name here.
	 *
	 * @since 4.5.0
	 *
	 * @param {object} response
	 */
	wp.updates.ajaxAlways = function( response ) {

		wp.updates.updateLock = false;
		wp.updates.queueChecker();

		if ( 'undefined' !== typeof response.debug ) {
			_.map( response.debug, function( message ) {
				window.console.log( $( '<p />' ).html( message ).text() );
			} );
		}
	};

	/**
	 *
	 * PLUGIN UPDATES
	 * ===============================================================================
	 */

	/**
	 * Send an Ajax request to the server to update a plugin.
	 *
	 * @since 4.2.0
	 *
	 * @param {string} plugin
	 * @param {string} slug
	 */
	wp.updates.updatePlugin = function( plugin, slug ) {
		var $message, name, $updateRow, message, data,
			$card = $( '.plugin-card-' + slug );

		if ( 'plugins' === pagenow || 'plugins-network' === pagenow ) {
			$updateRow = $( 'tr[data-plugin="' + plugin + '"]' );
			$message   = $updateRow.find( '.update-message' );
			name       = pluginData[ plugin ].Name;

		} else if ( 'plugin-install' === pagenow ) {
			$message = $card.find( '.update-now' );
			name     = $message.data( 'name' );

			// Remove previous error messages, if any.
			$card.removeClass( 'plugin-card-update-failed' ).find( '.notice.notice-error' ).remove();
		}

		message = wp.updates.l10n.updatingLabel.replace( '%s', name );
		$message.attr( 'aria-label', message );

		$message.addClass( 'updating-message' );
		if ( $message.html() !== wp.updates.l10n.updating ) {
			$message.data( 'originaltext', $message.html() );
		}

		wp.updates.updateProgressMessage( message );
		$message.text( wp.updates.l10n.updating );

		$( document ).trigger( 'wp-plugin-updating' );

		if ( wp.updates.updateLock ) {
			wp.updates.updateQueue.push( {
				type: 'update-plugin',
				data: {
					plugin: plugin,
					slug: slug
				}
			} );
			return;
		}

		wp.updates.updateLock = true;

		data = {
			_ajax_nonce:     wp.updates.ajaxNonce,
			plugin:          plugin,
			slug:            slug,
			username:        wp.updates.filesystemCredentials.ftp.username,
			password:        wp.updates.filesystemCredentials.ftp.password,
			hostname:        wp.updates.filesystemCredentials.ftp.hostname,
			connection_type: wp.updates.filesystemCredentials.ftp.connectionType,
			public_key:      wp.updates.filesystemCredentials.ssh.publicKey,
			private_key:     wp.updates.filesystemCredentials.ssh.privateKey
		};

		wp.ajax.post( 'update-plugin', data )
			.done( wp.updates.updateSuccess )
			.fail( wp.updates.updateError );
	};

	/**
	 * On a successful plugin update, update the UI with the result.
	 *
	 * @since 4.2.0
	 *
	 * @param {object} response
	 */
	wp.updates.updateSuccess = function( response ) {
		var $updateMessage, name, $pluginRow, newText;
		if ( 'plugins' === pagenow || 'plugins-network' === pagenow ) {
			$pluginRow = $( 'tr[data-plugin="' + response.plugin + '"]' ).first().prev();
			$updateMessage = $pluginRow.next().find( '.update-message' );
			$pluginRow.addClass( 'updated' ).removeClass( 'update' );

			// Update the version number in the row.
			newText = $pluginRow.find( '.plugin-version-author-uri' ).html().replace( response.oldVersion, response.newVersion );
			$pluginRow.find( '.plugin-version-author-uri' ).html( newText );

			// Add updated class to update message plugin row.
			$pluginRow.addClass( 'updated' );

		} else if ( 'plugin-install' === pagenow ) {
			$updateMessage = $( '.plugin-card-' + response.slug ).find( '.update-now' );
			$updateMessage.addClass( 'button-disabled' );
			name = pluginData[ response.plugin ].Name;
			$updateMessage.attr( 'aria-label', wp.updates.l10n.updatedLabel.replace( '%s', name ) );
		}

		$updateMessage.removeClass( 'updating-message' ).addClass( 'updated-message' );
		$updateMessage.text( wp.updates.l10n.updated );
		wp.updates.updateProgressMessage( wp.updates.l10n.updatedMsg );

		wp.updates.decrementCount( 'plugin' );

		wp.updates.updateDoneSuccessfully = true;

		/*
		 * The lock can be released since the update was successful,
		 * and any other updates can commence.
		 */
		wp.updates.updateLock = false;

		$document.trigger( 'wp-plugin-update-success', response );
		wp.updates.pluginUpdateSuccesses++;

		wp.updates.queueChecker();
	};

	/**
	 * On a plugin update error, update the UI appropriately.
	 *
	 * @since 4.2.0
	 *
	 * @param {object} response
	 */
	wp.updates.updateError = function( response ) {
		var $message, $button, name, errorMessage,
			$card = $( '.plugin-card-' + response.slug );

		wp.updates.updateDoneSuccessfully = false;
		wp.updates.updateLock             = false;
		if (
			response.errorCode &&
			'unable_to_connect_to_filesystem' === response.errorCode &&
			wp.updates.shouldRequestFilesystemCredentials
		) {
			wp.updates.credentialError( response, 'update-plugin' );
			wp.updates.queueChecker();
			return;
		}

		errorMessage = wp.updates.l10n.updateFailed.replace( '%s', response.error );

		if ( 'plugins' === pagenow || 'plugins-network' === pagenow ) {
			$message = $( 'tr[data-plugin="' + response.plugin + '"]' ).find( '.update-message' );
			$message.html( errorMessage ).removeClass( 'updating-message' );
		} else if ( 'plugin-install' === pagenow ) {
			$button = $card.find( '.update-now' );
			name    = pluginData[ response.plugin ].Name;

			$card
				.addClass( 'plugin-card-update-failed' )
				.append( '<div class="notice notice-error is-dismissible"><p>' + errorMessage + '</p></div>' );

			$button
				.attr( 'aria-label', wp.updates.l10n.updateFailedLabel.replace( '%s', name ) )
				.html( wp.updates.l10n.updateFailedShort ).removeClass( 'updating-message' );

			$card.on( 'click', '.notice.is-dismissible .notice-dismiss', function() {

				// Use same delay as the total duration of the notice fadeTo + slideUp animation.
				setTimeout( function() {
					$card
						.removeClass( 'plugin-card-update-failed' )
						.find( '.column-name a' ).focus();
				}, 200 );
			} );
		}

		wp.updates.updateProgressMessage( errorMessage, 'notice-error' );

		$document.trigger( 'wp-plugin-update-error', response );
		wp.updates.pluginUpdateFailures++;

		wp.updates.queueChecker();
	};

	/**
	 * ===============================================================================
	 * PROGRESS INDICATOR
	 * ===============================================================================
	 */

	/**
	 * Set up the progress indicator.
	 */
	wp.updates.setupProgressIndicator = function() {
		var $progressTemplate;

		/**
		 * Only set up the progress updater once.
		 */
		if ( ! _.isUndefined( wp.updates.progressUpdates ) ) {
			return;
		}

		// Set up the message lock for message queueing.
		wp.updates.messageLock  = false;
		wp.updates.messageQueue = [];

		/**
		 * Set up the notifcation template.
		 */
		$progressTemplate = $( '#tmpl-wp-progress-template' );
		if ( 0 !== $progressTemplate.length ) {
			wp.updates.progressTemplate = wp.template( 'wp-progress-template' );
			wp.updates.progressUpdates  = $( '#wp-progress-placeholder' );
		}

	};

	/**
	 * Update the progress indicator with a new message.
	 *
	 * @param {String}  message A string to display in the prigress indicator.
	 * @param {boolean} isError Whether the message indicates an error.
	 */
	wp.updates.updateProgressMessage = function( message, messageClass ) {

		// Check to ensure progress updater is set up.
		if ( ! _.isUndefined( wp.updates.progressUpdates ) ) {

			// Add the message to a queue so we can display messages in a throttled manner.
			wp.updates.messageQueue.push( { message: message, messageClass: messageClass } );
			wp.updates.processMessageQueue();
		}
	};

	/**
	 * Process the message queue, showing messages in a throttled manner.
	 */
	wp.updates.processMessageQueue = function() {
		var queuedMessage;

		// If we are already displaying a message, pause briefly and try again.
		if ( wp.updates.messageLock ) {
			setTimeout( wp.updates.processMessageQueue, 500 );
		} else {

			// Anything left in the queue?
			if ( 0 !== wp.updates.messageQueue.length ) {

				// Lock message displaying until our message displays briefly.
				wp.updates.messageLock = true;

				queuedMessage = wp.updates.messageQueue.shift();

				// Update the progress message.
				wp.updates.progressUpdates.append(
					wp.updates.progressTemplate(
						{
							message: queuedMessage.message,
							noticeClass: _.isUndefined( queuedMessage.messageClass ) ? 'notice-success' : 'notice-error'
						}
					)
				);
				wp.a11y.speak( wp.updates.l10n.updatingMsg, 'notice-error' === queuedMessage.messageClass ? 'assertive' : '' );

				$( document ).trigger( 'wp-progress-updated' );

				// After a brief delay, unlock and call the queue again.
				setTimeout( function() {
					wp.updates.messageLock = false;
					wp.updates.processMessageQueue();
				}, 1000 );
			}
		}
	};

	/**
	 * ===============================================================================
	 * BULK PLUGIN Actions
	 * ===============================================================================
	 */

	/**
	 * Start the bulk update process for a group of plugins.
	 *
	 * @since 4.5.0
	 */
	wp.updates.bulkUpdatePlugins = function( plugins ) {
		var $message;

		// Set up the progress indicaator.
		wp.updates.setupProgressIndicator();

		_.each( plugins, function( plugin ) {
			$message = $( 'tr[data-plugin="' + plugin.plugin + '"]' ).find( '.update-message' );

			$message.addClass( 'updating-message' );
			if ( $message.html() !== wp.updates.l10n.updating ) {
				$message.data( 'originaltext', $message.html() );
			}

			$message.text( wp.updates.l10n.updateQueued );

			wp.updates.updateQueue.push( {
				type: 'bulk-update-plugin',
				data: plugin
			} );
		} );

		// Start the bulk plugin updates. Reset the count for totals, successes and failures.
		wp.updates.pluginsToUpdateCount  = plugins.length;
		wp.updates.pluginUpdateSuccesses = 0;
		wp.updates.pluginUpdateFailures  = 0;
		wp.updates.updateLock            = false;
		wp.updates.updateProgressMessage(
			wp.updates.getPluginUpdateProgress()
		);

		wp.updates.queueChecker();

	};

	/**
	 * Start the bulk activate process for a group of plugins.
	 *
	 * @since 4.5.0
	 */
	wp.updates.bulkActivatePlugins = function( plugins ) {
		var $message;

		// Set up the progress indicaator.
		wp.updates.setupProgressIndicator();

		_.each( plugins, function( plugin ) {
			$message = $( '#the-list' ).find( '.activate a[data-plugin="' + plugin.plugin + '"]' );

			// Start the progress indicator for this row.
			$message.parents( 'tr' ).addClass( 'in-progress' );

			wp.updates.updateQueue.push( {
				type: 'bulk-activate-plugin',
				data: plugin
			} );
		} );

		// Start the bulk plugin updates. Reset the count for totals, successes and failures.
		wp.updates.pluginsToActivateCount  = plugins.length;
		wp.updates.pluginActivateSuccesses = 0;
		wp.updates.pluginActivateFailures  = 0;
		wp.updates.updateLock              = false;
		wp.updates.updateProgressMessage( wp.updates.getPluginActivateProgress() );

		// Start processing the queue
		wp.updates.queueChecker();
	};

	/**
	 * Start the bulk deactivate process for a group of plugins.
	 *
	 * @since 4.5.0
	 */
	wp.updates.bulkDeactivatePlugins = function( plugins ) {
		var $message;

		// Set up the progress indicaator.
		wp.updates.setupProgressIndicator();

		_.each( plugins, function( plugin ) {
			$message = $( '#the-list' ).find( '.deactivate a[data-plugin="' + plugin.plugin + '"]' );

			// Start the progress indicator for this row.
			$message.parents( 'tr' ).addClass( 'in-progress' );

			wp.updates.updateQueue.push( {
				type: 'bulk-deactivate-plugin',
				data: plugin
			} );
		} );

		// Start the bulk plugin updates. Reset the count for totals, successes and failures.
		wp.updates.pluginsToDeactivateCount  = plugins.length;
		wp.updates.pluginDeactivateSuccesses = 0;
		wp.updates.pluginDeactivateFailures  = 0;
		wp.updates.updateLock                = false;
		wp.updates.updateProgressMessage( wp.updates.getPluginDeactivateProgress() );

		// Start processing the queue
		wp.updates.queueChecker();
	};

	wp.updates.getPluginActivateProgress = function() {
		var updateMessage = wp.updates.l10n.activatePluginsQueuedMsg.replace( '%d', wp.updates.pluginsToActivateCount );

		if ( 0 !== wp.updates.pluginActivateSuccesses ) {
		updateMessage += ' ' + wp.updates.l10n.successMsg.replace( '%d', wp.updates.pluginActivateSuccesses );
		}
		if ( 0 !== wp.updates.pluginActivateFailures ) {
		updateMessage += ' ' + wp.updates.l10n.failureMsg.replace( '%d', wp.updates.pluginActivateFailures );
		}

		return updateMessage;
	};

	wp.updates.getPluginDeactivateProgress = function() {
		var updateMessage = wp.updates.l10n.deactivatePluginsQueuedMsg.replace( '%d', wp.updates.pluginsToDeactivateCount );

		if ( 0 !== wp.updates.pluginDeactivateSuccesses ) {
		updateMessage += ' ' + wp.updates.l10n.successMsg.replace( '%d', wp.updates.pluginDeactivateSuccesses );
		}
		if ( 0 !== wp.updates.pluginDeactivateFailures ) {
		updateMessage += ' ' + wp.updates.l10n.failureMsg.replace( '%d', wp.updates.pluginDeactivateFailures );
		}

		return updateMessage;
	};

	/**
	 * Build a string describing the bulk update progress.
	 */
	wp.updates.getPluginUpdateProgress = function() {
		var updateMessage = wp.updates.l10n.updatePluginsQueuedMsg.replace( '%d', wp.updates.pluginsToUpdateCount );

		if ( 0 !== wp.updates.pluginUpdateSuccesses ) {
		updateMessage += ' ' + wp.updates.l10n.successMsg.replace( '%d', wp.updates.pluginUpdateSuccesses );
		}
		if ( 0 !== wp.updates.pluginUpdateFailures ) {
		updateMessage += ' ' + wp.updates.l10n.failureMsg.replace( '%d', wp.updates.pluginUpdateFailures );
		}

		return updateMessage;

	};

	/**
	 * ===============================================================================
	 * INSTALL PLUGIN
	 * ===============================================================================
	 */

	/**
	 * Send an Ajax request to the server to install a plugin.
	 *
	 * @since 4.5.0
	 *
	 * @param {string} slug
	 */
	wp.updates.installPlugin = function( slug ) {
		var $card    = $( '.plugin-card-' + slug ),
			$message = $card.find( '.install-now' ),
			data;

		$message.addClass( 'updating-message' );
		$message.text( wp.updates.l10n.installing );
		wp.a11y.speak( wp.updates.l10n.installingMsg );

		// Remove previous error messages, if any.
		$card.removeClass( 'plugin-card-install-failed' ).find( '.notice.notice-error' ).remove();

		if ( wp.updates.updateLock ) {
			wp.updates.updateQueue.push( {
				type: 'install-plugin',
				data: {
					slug: slug
				}
			} );
			return;
		}

		wp.updates.updateLock = true;

		data = {
			_ajax_nonce:     wp.updates.ajaxNonce,
			slug:            slug,
			username:        wp.updates.filesystemCredentials.ftp.username,
			password:        wp.updates.filesystemCredentials.ftp.password,
			hostname:        wp.updates.filesystemCredentials.ftp.hostname,
			connection_type: wp.updates.filesystemCredentials.ftp.connectionType,
			public_key:      wp.updates.filesystemCredentials.ssh.publicKey,
			private_key:     wp.updates.filesystemCredentials.ssh.privateKey
		};

		wp.ajax.post( 'install-plugin', data )
			.done( wp.updates.installPluginSuccess )
			.fail( wp.updates.installPluginError )
			.always( wp.updates.ajaxAlways );
	};

	/**
	 * On plugin install success, update the UI with the result.
	 *
	 * @since 4.5.0
	 *
	 * @param {object} response
	 */
	wp.updates.installPluginSuccess = function( response ) {
		var $message = $( '.plugin-card-' + response.slug ).find( '.install-now' );

		$message.removeClass( 'updating-message' ).addClass( 'updated-message button-disabled' );
		$message.text( wp.updates.l10n.installed );
		wp.a11y.speak( wp.updates.l10n.installedMsg );

		wp.updates.updateDoneSuccessfully = true;
		$document.trigger( 'wp-plugin-install-success', response );
	};

	/**
	 * On plugin install failure, update the UI appropriately.
	 *
	 * @since 4.5.0
	 *
	 * @param {object} response
	 */
	wp.updates.installPluginError = function( response ) {
		var $card   = $( '.plugin-card-' + response.slug ),
			$button = $card.find( '.install-now' ),
			errorMessage;

		wp.updates.updateDoneSuccessfully = false;

		if ( response.errorCode && 'unable_to_connect_to_filesystem' === response.errorCode ) {
			wp.updates.credentialError( response, 'install-plugin' );
			return;
		}

		errorMessage = wp.updates.l10n.installFailed.replace( '%s', response.error );

		$card
			.addClass( 'plugin-card-update-failed' )
			.append( '<div class="notice notice-error is-dismissible"><p>' + errorMessage + '</p></div>' );

		$card.on( 'click', '.notice.is-dismissible .notice-dismiss', function() {

			// Use same delay as the total duration of the notice fadeTo + slideUp animation.
			setTimeout( function() {
				$card
					.removeClass( 'plugin-card-update-failed' )
					.find( '.column-name a' ).focus();
			}, 200 );
		} );

		$button
			.attr( 'aria-label', wp.updates.l10n.installFailedLabel.replace( '%s', pluginData[ response.plugin ].Name ) )
			.text( wp.updates.l10n.installFailedShort ).removeClass( 'updating-message' );

		wp.a11y.speak( errorMessage, 'assertive' );

		$document.trigger( 'wp-plugin-install-error', response );
	};

	/**
	 * ===============================================================================
	 * ACTIVATE PLUGIN
	 * ===============================================================================
	 */

	/**
	 * Send an Ajax request to the server to activate a plugin.
	 *
	 * @since 4.5.0
	 *
	 * @param {string} plugin
	 * @param {string} slug
	 */
	wp.updates.activatePlugin = function( plugin, slug ) {
		var data,
			$activateLink = $( '.activate a[data-plugin="' + plugin + '"]' );

		// Start the progress indicator for this row.
		$activateLink.parents( 'tr' ).addClass( 'in-progress' );

		wp.a11y.speak( wp.updates.l10n.activatingMsg );

		if ( wp.updates.updateLock ) {
			wp.updates.updateQueue.push( {
				type: 'activate-plugin',
				data: {
					plugin: plugin,
					slug: slug
				}
			} );
			return;
		}

		wp.updates.updateLock = true;

		data = {
			_ajax_nonce:     wp.updates.ajaxNonce,
			plugin:          plugin,
			slug:            slug,
			username:        wp.updates.filesystemCredentials.ftp.username,
			password:        wp.updates.filesystemCredentials.ftp.password,
			hostname:        wp.updates.filesystemCredentials.ftp.hostname,
			connection_type: wp.updates.filesystemCredentials.ftp.connectionType,
			public_key:      wp.updates.filesystemCredentials.ssh.publicKey,
			private_key:     wp.updates.filesystemCredentials.ssh.privateKey
		};

		wp.ajax.post( 'activate-plugin', data )
			.done( wp.updates.activatePluginSuccess )
			.fail( wp.updates.activatePluginError )
			.always( wp.updates.ajaxAlways );
	};

	/**
	 * On plugin activate success, update the UI with the result.
	 *
	 * @since 4.5.0
	 *
	 * @param {object} response
	 */
	wp.updates.activatePluginSuccess = function( response ) {

		var $activateLink = $( '.activate a[data-plugin="' + response.plugin + '"]' );

		$activateLink.parents( 'tr' )
			.removeClass( 'in-progress' )
			.removeClass( 'inactive' )
			.addClass( 'active' );

		wp.a11y.speak( wp.updates.l10n.activatedMsg );

		wp.updates.activateDoneSuccessfully = true;
		$document.trigger( 'wp-plugin-activate-success', response );
	};

	/**
	 * On plugin activate failure, update the UI appropriately.
	 *
	 * @since 4.5.0
	 *
	 * @param {object} response
	 */
	wp.updates.activatePluginError = function( response ) {
		var $activateLink = $( '.activate a[data-plugin="' + response.plugin + '"]' );

		$activateLink.parents( 'tr' )
			.removeClass( 'in-progress' )
			.after( wp.updates.l10n.activateFailedLabel.replace( '%s', pluginData[ response.plugin ].Name ) );

		wp.a11y.speak( wp.updates.l10n.activateFailedShort, 'assertive' );

		$document.trigger( 'wp-plugin-activate-error', response );
	};

	/**
	 * ===============================================================================
	 * DEACTIVATE PLUGIN
	 * ===============================================================================
	 */

	/**
	 * Send an Ajax request to the server to deactivate a plugin.
	 *
	 * @since 4.5.0
	 *
	 * @param {string} plugin
	 * @param {string} slug
	 */
	wp.updates.deactivatePlugin = function( plugin, slug ) {
		var data,
			$deactivateLink = $( '.deactivate a[data-plugin="' + plugin + '"]' );

		// Start the progress indicator for this row.
		$deactivateLink.parents( 'tr' ).addClass( 'in-progress' );

		wp.a11y.speak( wp.updates.l10n.activatingMsg );

		if ( wp.updates.updateLock ) {
			wp.updates.updateQueue.push( {
				type: 'deactivate-plugin',
				data: {
					plugin: plugin,
					slug: slug
				}
			} );
			return;
		}

		wp.updates.updateLock = true;

		data = {
			_ajax_nonce:     wp.updates.ajaxNonce,
			plugin:          plugin,
			slug:            slug,
			username:        wp.updates.filesystemCredentials.ftp.username,
			password:        wp.updates.filesystemCredentials.ftp.password,
			hostname:        wp.updates.filesystemCredentials.ftp.hostname,
			connection_type: wp.updates.filesystemCredentials.ftp.connectionType,
			public_key:      wp.updates.filesystemCredentials.ssh.publicKey,
			private_key:     wp.updates.filesystemCredentials.ssh.privateKey
		};

		wp.ajax.post( 'deactivate-plugin', data )
			.done( wp.updates.deactivatePluginSuccess )
			.fail( wp.updates.deactivatePluginError )
			.always( wp.updates.ajaxAlways );
	};

	/**
	 * On plugin deactivate success, update the UI with the result.
	 *
	 * @since 4.5.0
	 *
	 * @param {object} response
	 */
	wp.updates.deactivatePluginSuccess = function( response ) {

		var $deactivateLink = $( '.deactivate a[data-plugin="' + response.plugin + '"]' );

		$deactivateLink.parents( 'tr' )
			.removeClass( 'in-progress' )
			.removeClass( 'active' )
			.addClass( 'inactive' );

		wp.a11y.speak( wp.updates.l10n.deactivatedMsg );

		wp.updates.deactivateDoneSuccessfully = true;
		$document.trigger( 'wp-plugin-deactivate-success', response );
	};

	/**
	 * On plugin deactivate failure, update the UI appropriately.
	 *
	 * @since 4.5.0
	 *
	 * @param {object} response
	 */
	wp.updates.deactivatePluginError = function( response ) {
		var $deactivateLink = $( '.deactivate a[data-plugin="' + response.plugin + '"]' );

		$deactivateLink
			.removeClass( 'in-progress' )
			.after( wp.updates.l10n.deactivateFailedLabel.replace( '%s', pluginData[ response.plugin ].Name ) );

		wp.a11y.speak( wp.updates.l10n.deactivateFailedShort, 'assertive' );

		$document.trigger( 'wp-plugin-deactivate-error', response );
	};

	/**
	 * ===============================================================================
	 * DELETE PLUGIN
	 * ===============================================================================
	 */

	/**
	 * Send an Ajax request to the server to delete a plugin.
	 *
	 * @since 4.5.0
	 *
	 * @param {string} plugin
	 * @param {string} slug
	 */
	wp.updates.deletePlugin = function( plugin, slug ) {
		var data;

		wp.a11y.speak( wp.updates.l10n.deletinggMsg );

		if ( wp.updates.updateLock ) {
			wp.updates.updateQueue.push( {
				type: 'delete-plugin',
				data: {
					plugin: plugin,
					slug: slug
				}
			} );
			return;
		}

		wp.updates.updateLock = true;

		data = {
			_ajax_nonce:     wp.updates.ajaxNonce,
			plugin:          plugin,
			slug:            slug,
			username:        wp.updates.filesystemCredentials.ftp.username,
			password:        wp.updates.filesystemCredentials.ftp.password,
			hostname:        wp.updates.filesystemCredentials.ftp.hostname,
			connection_type: wp.updates.filesystemCredentials.ftp.connectionType,
			public_key:      wp.updates.filesystemCredentials.ssh.publicKey,
			private_key:     wp.updates.filesystemCredentials.ssh.privateKey
		};

		wp.ajax.post( 'delete-plugin', data )
			.done( wp.updates.deletePluginSuccess )
			.fail( wp.updates.deletePluginError )
			.always( wp.updates.ajaxAlways );
	};

	/**
	 * On plugin delete success, update the UI with the result.
	 *
	 * @since 4.5.0
	 *
	 * @param {object} response
	 */
	wp.updates.deletePluginSuccess = function( response ) {
		wp.a11y.speak( wp.updates.l10n.deletedMsg );
		wp.updates.updateDoneSuccessfully = true;

		// Removes the plugin and updates rows.
		$( '#' + response.slug + '-update, #' + response.id ).css( { backgroundColor:'#faafaa' } ).fadeOut( 350, function() {
			$( this ).remove();
		} );

		$document.trigger( 'wp-plugin-delete-success', response );
	};

	/**
	 * On plugin delete failure, update the UI appropriately.
	 *
	 * @since 4.5.0
	 *
	 * @param {object} response
	 */
	wp.updates.deletePluginError = function( response ) {
		wp.updates.updateDoneSuccessfully = false;

		if ( response.errorCode && 'unable_to_connect_to_filesystem' === response.errorCode ) {
			wp.updates.credentialError( response, 'delete-plugin' );
			return;
		}

		$document.trigger( 'wp-plugin-delete-error', response );
	};

	/**
	 * ===============================================================================
	 * UPDATE THEME
	 * ===============================================================================
	 */

	/**
	 * Send an Ajax request to the server to update a theme.
	 *
	 * @since 4.5.0
	 *
	 * @param {string} slug
	 */
	wp.updates.updateTheme = function( slug ) {
		var $message = $( '#update-theme' ).closest( '.notice' ),
			data;

		$message.addClass( 'updating-message' );
		if ( $message.html() !== wp.updates.l10n.updating ) {
			$message.data( 'originaltext', $message.html() );
		}

		$message.text( wp.updates.l10n.updating );
		wp.a11y.speak( wp.updates.l10n.updatingMsg );

		// Remove previous error messages, if any.
		$( '#' + slug ).removeClass( 'theme-update-failed' ).find( '.notice.notice-error' ).remove();

		if ( wp.updates.updateLock ) {
			wp.updates.updateQueue.push( {
				type: 'update-theme',
					data: {
						slug: slug
					}
			} );
			return;
		}

		wp.updates.updateLock = true;

		data = {
			'_ajax_nonce':   wp.updates.ajaxNonce,
			'slug':          slug,
			username:        wp.updates.filesystemCredentials.ftp.username,
			password:        wp.updates.filesystemCredentials.ftp.password,
			hostname:        wp.updates.filesystemCredentials.ftp.hostname,
			connection_type: wp.updates.filesystemCredentials.ftp.connectionType,
			public_key:      wp.updates.filesystemCredentials.ssh.publicKey,
			private_key:     wp.updates.filesystemCredentials.ssh.privateKey
		};

		wp.ajax.post( 'update-theme', data )
			.done( wp.updates.updateThemeSuccess )
			.fail( wp.updates.updateThemeError )
			.always( wp.updates.ajaxAlways );
	};

	/**
	 * On a successful theme update, update the UI with the result.
	 *
	 * @since 4.5.0
	 *
	 * @param {object} response
	 */
	wp.updates.updateThemeSuccess = function( response ) {
		var $message = $( '.theme-info .notice' );

		$message.removeClass( 'updating-message notice-warning' ).addClass( 'updated-message notice-success' );
		$message.text( wp.updates.l10n.updated );
		$( '#' + response.slug ).find( '.theme-update' ).remove();

		if ( response.newVersion.length ) {
			$( '.theme-version' ).text( response.newVersion );
		}

		wp.a11y.speak( wp.updates.l10n.updatedMsg );

		wp.updates.decrementCount( 'theme' );
		wp.updates.updateDoneSuccessfully = true;

		$document.trigger( 'wp-plugin-update-success', response );
	};

	/**
	 * On a theme update error, update the UI appropriately.
	 *
	 * @since 4.5.0
	 *
	 * @param {object} response
	 */
	wp.updates.updateThemeError = function( response ) {
		var $message = $( '.theme-info .notice' ),
			errorMessage = wp.updates.l10n.updateFailed.replace( '%s', response.error );

		$message.removeClass( 'updating-message notice-warning' ).addClass( 'notice-error is-dismissible' );
		$message.text( errorMessage );
		wp.a11y.speak( errorMessage );

		$document.trigger( 'wp-theme-update-error', response );
	};

	/**
	 * ===============================================================================
	 * INSTALL THEME
	 * ===============================================================================
	 */

	/**
	 * Send an Ajax request to the server to install a theme.
	 *
	 * @since 4.5.0
	 *
	 * @param {string} slug
	 */
	wp.updates.installTheme = function( slug ) {
		var $message = $( '.theme-install[data-slug="' + slug + '"]' ),
			data;

		$message.addClass( 'updating-message' );
		if ( $message.html() !== wp.updates.l10n.installing ) {
			$message.data( 'originaltext', $message.html() );
		}

		$message.text( wp.updates.l10n.installing );
		wp.a11y.speak( wp.updates.l10n.installingMsg );

		// Remove previous error messages, if any.
		$( '.install-theme-info, #' + slug ).removeClass( 'theme-install-failed' ).find( '.notice.notice-error' ).remove();

		if ( wp.updates.updateLock ) {
			wp.updates.updateQueue.push( {
				type: 'install-theme',
				data: {
					slug: slug
				}
			} );
			return;
		}

		wp.updates.updateLock = true;

		data = {
			'_ajax_nonce':   wp.updates.ajaxNonce,
			'slug':          slug,
			username:        wp.updates.filesystemCredentials.ftp.username,
			password:        wp.updates.filesystemCredentials.ftp.password,
			hostname:        wp.updates.filesystemCredentials.ftp.hostname,
			connection_type: wp.updates.filesystemCredentials.ftp.connectionType,
			public_key:      wp.updates.filesystemCredentials.ssh.publicKey,
			private_key:     wp.updates.filesystemCredentials.ssh.privateKey
		};

		wp.ajax.post( 'install-theme', data )
			.done( wp.updates.installThemeSuccess )
			.fail( wp.updates.installThemeError )
			.always( wp.updates.ajaxAlways );
	};

	/**
	 * On theme install success, update the UI with the result.
	 *
	 * @since 4.5.0
	 ** @param {object} response
	 */
	wp.updates.installThemeSuccess = function( response ) {
		var $card = $( '#' + response.slug ),
			$message = $card.find( '.theme-install' );

		$message.removeClass( 'updating-message' ).addClass( 'updated-message disabled' );
		$message.text( wp.updates.l10n.installed );
		wp.a11y.speak( wp.updates.l10n.installedMsg );
		$card.addClass( 'is-installed' ); // Hides the button, should show banner.

		$document.trigger( 'wp-install-theme-success', response );
	};

	/**
	 * On theme install failure, update the UI appropriately.
	 *
	 * @since 4.5.0
	 *
	 * @param {object} response
	 */
	wp.updates.installThemeError = function( response ) {
		var $card, $button,
			errorMessage = wp.updates.l10n.installFailed.replace( '%s', response.error );

		if ( $document.find( 'body' ).hasClass( 'full-overlay-active' ) ) {
			$button = $( '.theme-install[data-slug="' + response.slug + '"]' );
			$card   = $( '.install-theme-info' );
		} else {
			$card   = $( '#' + response.slug );
			$button = $card.find( '.theme-install' );
		}

		$card
			.addClass( 'theme-install-failed' )
			.append( '<div class="notice notice-error"><p>' + errorMessage + '</p></div>' );

		$button
			.attr( 'aria-label', wp.updates.l10n.installFailedLabel.replace( '%s', $card.find( '.theme-name' ).text() ) )
			.text( wp.updates.l10n.installFailedShort ).removeClass( 'updating-message' );

		wp.a11y.speak( errorMessage, 'assertive' );

		$document.trigger( 'wp-theme-install-error', response );
	};

	/**
	 * ===============================================================================
	 * DELETE THEME
	 * ===============================================================================
	 */

	/**
	 * Send an Ajax request to the server to delete a theme.
	 *
	 * @since 4.5.0
	 *
	 * @param {string} slug
	 */
	wp.updates.deleteTheme = function( slug ) {
		var $message = $( '.theme-install[data-slug="' + slug + '"]' ),
			data;

		$message.addClass( 'updating-message' );
		if ( $message.html() !== wp.updates.l10n.installing ) {
			$message.data( 'originaltext', $message.html() );
		}

		$message.text( wp.updates.l10n.installing );
		wp.a11y.speak( wp.updates.l10n.installingMsg );

		// Remove previous error messages, if any.
		$( '.install-theme-info, #' + slug ).removeClass( 'theme-install-failed' ).find( '.notice.notice-error' ).remove();

		if ( wp.updates.updateLock ) {
			wp.updates.updateQueue.push( {
				type: 'delete-theme',
				data: {
					slug: slug
				}
			} );
			return;
		}

		wp.updates.updateLock = true;

		data = {
			'_ajax_nonce':   wp.updates.ajaxNonce,
			'slug':          slug,
			username:        wp.updates.filesystemCredentials.ftp.username,
			password:        wp.updates.filesystemCredentials.ftp.password,
			hostname:        wp.updates.filesystemCredentials.ftp.hostname,
			connection_type: wp.updates.filesystemCredentials.ftp.connectionType,
			public_key:      wp.updates.filesystemCredentials.ssh.publicKey,
			private_key:     wp.updates.filesystemCredentials.ssh.privateKey
		};

		wp.ajax.post( 'delete-theme', data )
			.done( wp.updates.deleteThemeSuccess )
			.fail( wp.updates.deleteThemeError )
			.always( wp.updates.ajaxAlways );
	};

	/**
	 * On theme delete success, update the UI appropriately.
	 *
	 * @since 4.5.0
	 ** @param {object} response
	 */
	wp.updates.deleteThemeSuccess = function( response ) {
		wp.a11y.speak( wp.updates.l10n.deletedMsg );

		$document.trigger( 'wp-delete-theme-success', response );

		// Back to themes overview.
		window.location = location.pathname;
	};

	/**
	 * On theme delete failure, update the UI appropriately.
	 *
	 * @since 4.5.0
	 *
	 * @param {object} response
	 */
	wp.updates.deleteThemeError = function( response ) {

		// @todo fix/test this section
		var $card, $button,
			errorMessage = wp.updates.l10n.deleteFailed.replace( '%s', response.error );

		if ( $document.find( 'body' ).hasClass( 'full-overlay-active' ) ) {
			$button = $( '.theme-install[data-slug="' + response.slug + '"]' );
			$card   = $( '.install-theme-info' );
		} else {
			$card   = $( '#' + response.slug );
			$button = $card.find( '.theme-install' );
		}

		$card
			.addClass( 'theme-install-failed' )
			.append( '<div class="notice notice-error"><p>' + errorMessage + '</p></div>' );

		$button
			.attr( 'aria-label', wp.updates.l10n.installFailedLabel.replace( '%s', $card.find( '.theme-name' ).text() ) )
			.text( wp.updates.l10n.installFailedShort ).removeClass( 'updating-message' );

		wp.a11y.speak( errorMessage, 'assertive' );

		$document.trigger( 'wp-theme-delete-error', response );
	};

	/**
	 * ===============================================================================
	 * BULK PROCESSING QUEUE
	 * ===============================================================================
	 */

	/**
	 * If an install/update job has been placed in the queue, queueChecker pulls it out and runs it.
	 *
	 * @since 4.2.0
	 * @since 4.5.0 Can handle multiple job types.
	 */
	wp.updates.queueChecker = function() {
		var updateMessage, job;

		if ( wp.updates.updateLock || wp.updates.updateQueue.length <= 0 ) {

			// Clear the update lock when the queue is empty.
			if ( wp.updates.updateQueue.length <= 0 ) {
				wp.updates.updateLock = false;

				// Update the status with final progress results.
				switch ( wp.updates.currentJobType ) {
					case 'bulk-update-plugin':
						updateMessage = wp.updates.l10n.updatedPluginsMsg;
						if ( 0 !== wp.updates.pluginUpdateSuccesses ) {
							updateMessage += ' ' + wp.updates.l10n.successMsg.replace( '%d', wp.updates.pluginUpdateSuccesses );
						}
						if ( 0 !== wp.updates.pluginUpdateFailures ) {
							updateMessage += ' ' + wp.updates.l10n.failureMsg.replace( '%d', wp.updates.pluginUpdateFailures );
						}
						wp.updates.updateProgressMessage( updateMessage, 'is-dismissible' );
						break;
				}
			}
			return;
		}

		job = wp.updates.updateQueue.shift();

		wp.updates.currentJobType = job.type;

		// Handle a queue job.
		switch ( job.type ) {
			case 'install-plugin':
				wp.updates.installPlugin( job.data.slug );
				break;

			case 'bulk-activate-plugin':
			case 'activate-plugin':
				wp.updates.activatePlugin( job.data.plugin, job.data.slug );
				break;

			case 'bulk-deactivate-plugin':
			case 'deactivate-plugin':
				wp.updates.deactivatePlugin( job.data.plugin, job.data.slug );
				break;

			case 'bulk-update-plugin':
			case 'update-plugin':
				wp.updates.updatePlugin( job.data.plugin, job.data.slug );
				break;

			case 'delete-plugin':
				wp.updates.deletePlugin( job.data.plugin, job.data.slug );
				break;

			case 'install-theme':
				wp.updates.installTheme( job.data.slug );
				break;

			case 'update-theme':
				wp.updates.updateTheme( job.data.slug );
				break;

			case 'delete-theme':
				wp.updates.deleteTheme( job.data.slug );
				break;

			default:
				window.console.log( 'Failed to execute queued update job.', job );
				break;
		}
	};

	/**
	 * ===============================================================================
	 * FILESYSTEM CREDENTIALS MODAL
	 * ===============================================================================
	 */

	/**
	 * Request the users filesystem credentials if we don't have them already.
	 *
	 * @since 4.5.0
	 */
	wp.updates.requestFilesystemCredentials = function( event ) {
		if ( false === wp.updates.updateDoneSuccessfully ) {

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
	 * The steps that need to happen when the modal is canceled out
	 *
	 * @since 4.2.0
	 * @since 4.5.0 Triggers an event for callbacks to listen to and add their actions.
	 */
	wp.updates.requestForCredentialsModalCancel = function() {

		// No updateLock and no updateQueue means we already have cleared things up.
		if ( false === wp.updates.updateLock && 0 === wp.updates.updateQueue.length ) {
			return;
		}

		// Remove the lock, and clear the queue.
		wp.updates.updateLock  = false;
		wp.updates.updateQueue = [];

		wp.updates.requestForCredentialsModalClose();

		$document.trigger( 'credential-modal-cancel' );
	};

	/**
	 * ===============================================================================
	 * EVENT HANDLERS
	 * ===============================================================================
	 */

	$( function() {
		var $pluginList     = $( '#the-list' ),
			$bulkActionForm = $( '#bulk-action-form' );

		/**
		 * Deactivate a plugin.
		 */
		$pluginList.find( '.deactivate' ).on( 'click', function( event ) {
			var $button = $( event.target );
			event.preventDefault();

			wp.updates.deactivatePlugin( $button.data( 'plugin' ), $button.data( 'slug' ) );
			return false;
		} );

		/**
		 * Activate a plugin.
		 */
		$pluginList.find( '.activate' ).on( 'click', function( event ) {
			var $button = $( event.target );
			event.preventDefault();

			wp.updates.activatePlugin( $button.data( 'plugin' ), $button.data( 'slug' ) );
			return false;
		} );

		/**
		 * Install a plugin.
		 */
		$pluginList.find( '.install-now' ).on( 'click', function( event ) {
			var $button = $( event.target );
			event.preventDefault();

			if ( $button.hasClass( 'button-disabled' ) ) {
				return;
			}

			if ( wp.updates.shouldRequestFilesystemCredentials && ! wp.updates.updateLock ) {
				wp.updates.requestFilesystemCredentials( event );

				$document.on( 'credential-modal-cancel', function() {
					var $message = $( '.install-now.updating-message' );

					$message.removeClass( 'updating-message' );
					$message.text( wp.updates.l10n.installNow );
					wp.a11y.speak( wp.updates.l10n.updateCancel );
				} );
			}

			wp.updates.installPlugin( $button.data( 'slug' ) );
		} );

		/**
		 * Delete a plugin.
		 */
		$pluginList.find( 'a.delete' ).on( 'click', function( event ) {
			var $link = $( event.target );
			event.preventDefault();

			if ( ! window.confirm( wp.updates.l10n.aysDelete ) ) {
				return;
			}

			if ( wp.updates.shouldRequestFilesystemCredentials && ! wp.updates.updateLock ) {
				wp.updates.requestFilesystemCredentials( event );
			}

			wp.updates.deletePlugin( $link.data( 'plugin' ), $link.data( 'slug' ) );
		} );

		/**
		 * Bulk update for plugins.
		 */
		$bulkActionForm.on( 'click', '[type="submit"]', function( event ) {
			var plugins = [];

			event.preventDefault();

			if ( 'update-selected' !== $( event.target ).siblings( 'select' ).val() ) {
				return;
			}

			if ( wp.updates.shouldRequestFilesystemCredentials && ! wp.updates.updateLock ) {
				wp.updates.requestFilesystemCredentials( event );
			}

			// Find all the checkboxes which have been checked.
			$bulkActionForm
				.find( 'input[name="checked[]"]:checked' )
				.each( function( index, element ) {
					var $checkbox = $( element );

					// Only add updatable plugins to the queue.
					if ( $checkbox.parents( 'tr' ).hasClass( 'update' ) ) {

						// Processing checkbox, so uncheck.
						$checkbox .prop( 'checked', false );
						plugins.push( {
							plugin: $checkbox.val(),
							slug:   $checkbox.parents( 'tr' ).prop( 'id' )
						} );
					}
			} );

			// Uncheck the bulk select checkbox.
			$( '.manage-column [type="checkbox"]' ).prop( 'checked', false );

			if ( 0 !== plugins.length ) {
				wp.updates.bulkUpdatePlugins( plugins );
			}
		} );

		/**
		 * Bulk activate for plugins.
		 */
		$bulkActionForm.on( 'click', '[type="submit"]', function( event ) {
			var plugins = [];

			event.preventDefault();

			if ( 'activate-selected' !== $( event.target ).siblings( 'select' ).val() ) {
				return;
			}

			if ( wp.updates.shouldRequestFilesystemCredentials && ! wp.updates.updateLock ) {
				wp.updates.requestFilesystemCredentials( event );
			}

			// Find all the checkboxes which have been checked.
			$bulkActionForm
				.find( 'input[name="checked[]"]:checked' )
				.each( function( index, element ) {
					var $checkbox = $( element );

					// Add plugins that can be activated to the queue.
					if ( $checkbox.parents( 'tr' ).hasClass( 'inactive' ) ) {

						// Processing checkbox, so uncheck.
						$checkbox .prop( 'checked', false );
						plugins.push( {
							plugin: $checkbox.val(),
							slug:   $checkbox.parents( 'tr' ).prop( 'id' )
						} );
					}
			} );

			// Uncheck the bulk select checkbox.
			$( '.manage-column [type="checkbox"]' ).prop( 'checked', false );

			if ( 0 !== plugins.length ) {
				wp.updates.bulkActivatePlugins( plugins );
			}
		} );

		/**
		 * Bulk deactivate for plugins.
		 */
		$bulkActionForm.on( 'click', '[type="submit"]', function( event ) {
			var plugins;

			if ( 'deactivate-selected' !== $( event.target ).siblings( 'select' ).val() ) {
				return;
			}

			if ( wp.updates.shouldRequestFilesystemCredentials && ! wp.updates.updateLock ) {
				wp.updates.requestFilesystemCredentials( event );
			}

			plugins = [];
			event.preventDefault();

			// Find all the checkboxes which have been checked.
			$bulkActionForm
				.find( 'input[name="checked[]"]:checked' )
				.each( function( index, element ) {
					var $checkbox = $( element );

					// Add plugins that can be deactivated to the queue.
					if ( $checkbox.parents( 'tr' ).hasClass( 'active' ) ) {

						// Processing checkbox, so uncheck.
						$checkbox .prop( 'checked', false );
						plugins.push( {
							plugin: $checkbox.val(),
							slug:   $checkbox.parents( 'tr' ).prop( 'id' )
						} );
					}
			} );

			// Uncheck the bulk select checkbox.
			$( '.manage-column [type="checkbox"]' ).prop( 'checked', false );

			if ( 0 !== plugins.length ) {
				wp.updates.bulkDeactivatePlugins( plugins );
			}
		} );

		/**
		 * Handle events after the credential modal was closed.
		 */
		$document.on( 'credential-modal-cancel', function() {
			var slug, $message;

			if ( 'plugins' === pagenow || 'plugins-network' === pagenow ) {
				slug     = wp.updates.updateQueue[0].data.slug;
				$message = $( '#' + slug ).next().find( '.update-message' );
			} else if ( 'plugin-install' === pagenow ) {
				$message = $( '.update-now.updating-message' );
			} else {
				$message = $( '.updating-message' );
			}

			$message.removeClass( 'updating-message' );
			$message.html( $message.data( 'originaltext' ) );
			wp.a11y.speak( wp.updates.l10n.updateCancel );
		} );

		/**
		 * Make notices dismissable.
 		 */
		$( document ) .on( 'wp-progress-updated wp-theme-update-error wp-theme-install-error', function() {
			$( '.notice.is-dismissible' ).each( function() {
				var $el = $( this ),
					$button = $( '<button type="button" class="notice-dismiss"><span class="screen-reader-text"></span></button>' ),
					btnText = commonL10n.dismiss || '';

				// Ensure plain text
				$button.find( '.screen-reader-text' ).text( btnText );
				$button.on( 'click.wp-dismiss-notice', function( event ) {
					event.preventDefault();
					$el.fadeTo( 100, 0, function() {
						$el.slideUp( 100, function() {
							$el.remove();
						} );
					} );
				} );

				$el.append( $button );
			} );
		} );

		$( '#plugin-search-input' ).on( 'keyup search', function() {
			var val  = $( this ).val(),
				data = {
					'_ajax_nonce': wp.updates.ajaxNonce,
					's':           val
				};

			if ( 'undefined' !== typeof wp.updates.searchRequest ) {
				wp.updates.searchRequest.abort();
			}

			wp.updates.searchRequest = wp.ajax.post( 'search-plugins', data ).done( function( response ) {
				$( '#the-list' ).empty().append( response.items );
				delete wp.updates.searchRequest;
			} );
		} );
	} );

} )( jQuery, window.wp );
