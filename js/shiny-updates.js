window.wp = window.wp || {};

(function( $, wp ) {
	var $document = $( document );

	wp.updates.progressMessages = [];

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
	 */
	wp.updates.ajaxAlways = function() {
		$( '#the-list' ).find( '.check-column [type="checkbox"]' ).prop( 'checked', false );

		wp.updates.updateLock = false;
		wp.updates.queueChecker();
	};


	/**
	 * Send an Ajax request to the server to update a plugin.
	 *
	 * @since 4.2.0
	 *
	 * @param {string} plugin
	 * @param {string} slug
	 */
	wp.updates.updatePlugin = function( plugin, slug ) {
		var $message, name, $updateRow, message,
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
		if ( $message.html() !== wp.updates.l10n.updating ){
			$message.data( 'originaltext', $message.html() );
		}

		// Start ptogress for plugin.
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

		var data = {
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
			newText = $pluginRow.find('.plugin-version-author-uri').html().replace( response.oldVersion, response.newVersion );
			$pluginRow.find('.plugin-version-author-uri').html( newText );

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

		// Finish progress for plugin.
		wp.updates.updateProgressMessage( wp.updates.l10n.updatedMsg, 'notice-success', true );

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
		var $card = $( '.plugin-card-' + response.slug ),
			$message,
			$button,
			name,
			error_message;

		wp.updates.updateDoneSuccessfully = false;
		wp.updates.updateLock             = false;
		if ( response.errorCode && response.errorCode == 'unable_to_connect_to_filesystem' && wp.updates.shouldRequestFilesystemCredentials ) {
			wp.updates.credentialError( response, 'update-plugin' );
			wp.updates.queueChecker();
			return;
		}

		error_message = wp.updates.l10n.updateFailed.replace( '%s', response.error );

		if ( 'plugins' === pagenow || 'plugins-network' === pagenow ) {
			$message = $( 'tr[data-plugin="' + response.plugin + '"]' ).find( '.update-message' );
			$message.html( error_message ).removeClass( 'updating-message' );
		} else if ( 'plugin-install' === pagenow ) {
			$button = $card.find( '.update-now' );
			name    = pluginData[ response.plugin ].Name;

			$card
				.addClass( 'plugin-card-update-failed' )
				.append( '<div class="notice notice-error is-dismissible"><p>' + error_message + '</p></div>' );

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
			});
		}

		// Complete the progress for this plugin update with a failure.
		wp.updates.updateProgressMessage( error_message, 'notice-error', true );

		$document.trigger( 'wp-plugin-update-error', response );
		wp.updates.pluginUpdateFailures++;

		wp.updates.queueChecker();
	};

	/**
	 * Set up the progress indicator.
	 */
	wp.updates.setupProgressIndicator = function() {
		/**
		 * Only set uo the progress updater once.
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

		$( document ).on( 'click', 'a.progress-show-details,a.progress-hide-details', function( evnt ) {
			$( evnt.currentTarget ).parents( '#wp-progress-placeholder' ).toggleClass( 'show-details' );
		} );

		/**
		 * Clear any previous messages.
		 */
		wp.updates.progressMessages = [];

	};

	/**
	 * Update the progress indicator with a new message.
	 *
	 * @param {String}  message      A string to display in the prigress indicator.
	 * @param {boolean} isError      Whether the message indicates an error.
	 * @param {boolean} appendToLine Whether to append the message to the current line,
	 *                               Otherwise create a new line. Default false..
	 */
	wp.updates.updateProgressMessage = function( message, messageClass, appendToLine ) {

		// Check to ensure progress updater is set up.
		if ( ! _.isUndefined( wp.updates.progressUpdates ) ) {
			// Add the message to a queue so we can display messages in a throttled manner.
			wp.updates.messageQueue.push( { message: message, messageClass: messageClass, appendToLine: appendToLine } );
			wp.updates.processMessageQueue();
		}
	};

	wp.updates.finishProgressUpdates = function() {

		//Choose a final status color, default to yellow.
		var final_status_class = 'notice-warning';

		// Only success, green.
		if ( wp.updates.pluginUpdateSuccesses > 0 && wp.updates.pluginUpdateFailures === 0 ) {
			final_status_class = 'notice-success';
		} else {
			// Only failures, red.
			if ( wp.updates.pluginUpdateFailures > 0 && wp.updates.pluginUpdateSuccesses === 0 ) {
				final_status_class = 'notice-error';
			}
		}

		// Make the notice dismissable and add the final status class.
		wp.updates.updateProgressMessage( '', 'is-dismissible ' + final_status_class );

		// Remove our show details click handler.
		$( document ).off( 'click', 'a.progress-show-details' );

	}

	/**
	 * Process the message queue, showing messages in a throttled manner.
	 */
	wp.updates.processMessageQueue = function() {
		var currentMessage;

		// If we are already displaying a message, pause briefly and try again.
		if ( wp.updates.messageLock ) {
			setTimeout( wp.updates.processMessageQueue, 500 );
		} else {
			// Anything left in the queue?
			if ( 0 !== wp.updates.messageQueue.length ) {
				// Lock message displaying until our message displays briefly.
				wp.updates.messageLock = true;

				// Get the latest message from the queue.
				currentMessage = wp.updates.messageQueue.shift();
				if ( '' !== currentMessage.message ) {

					// If appendToLine is set, insert message at end of current line.
					if ( currentMessage.appendToLine ) {
						wp.updates.progressMessages[ wp.updates.progressMessages.length - 1 ] =
							wp.updates.progressMessages[ wp.updates.progressMessages.length - 1 ] +=
								' ' + currentMessage.message;
					} else {
						// Create a new progress line.
						wp.updates.progressMessages.push( currentMessage.message );
					}
				}

				// Update the progress message.
				wp.updates.progressUpdates.html(
					wp.updates.progressTemplate(
						{
							header:  wp.updates.getPluginUpdateProgress(),
							messages: wp.updates.progressMessages,
							noticeClass: _.isUndefined( currentMessage.messageClass ) ? 'notice-success' : currentMessage.messageClass
						}
					)
				);
				wp.a11y.speak( currentMessage.message, 'notice-error' === currentMessage.messageClass ? 'assertive' : '' );

				$( document ).trigger( 'wp-progress-updated', currentMessage );

				// After a brief delay, unlock and call the queue again.
				setTimeout( function() {
					wp.updates.messageLock = false;
					wp.updates.processMessageQueue();
				}, 1000 );
			}
		}
	};


	/**
	 * Send an Ajax request to the server to update plugins in bulk.
	 *
	 * @since 4.5.0
	 */
	wp.updates.bulkUpdatePlugins = function( plugins ) {
		var $message, data;

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
		});

		// Start the bulk plugin updates. Reset the count for totals, successes and failures.
		//wp.updates.updateProgressMessage( wp.updates.l10n.updatingMsg );
		wp.updates.pluginsToUpdateCount  = plugins.length;
		wp.updates.pluginUpdateSuccesses = 0;
		wp.updates.pluginUpdateFailures  = 0;
		wp.updates.updateLock            = false;
		// Start the progress updates.
		wp.updates.updateProgressMessage ( '' );

		wp.updates.queueChecker();

	};

	/**
	 * Build a string describing the bulk update progress.
	 */
	wp.updates.getPluginUpdateProgress = function() {
		var updateMessage = wp.updates.l10n.updatePluginsQueuedMsg.replace( '%d', wp.updates.pluginsToUpdateCount );

		if ( 0 !== wp.updates.pluginUpdateSuccesses ) {
		updateMessage += ' ' + wp.updates.l10n.updatedPluginsSuccessMsg.replace( '%d', wp.updates.pluginUpdateSuccesses );
		}
		if ( 0 !== wp.updates.pluginUpdateFailures ) {
		updateMessage += ' ' + wp.updates.l10n.updatedPluginsFailureMsg.replace( '%d', wp.updates.pluginUpdateFailures );
		}

		return updateMessage;

	};

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
		});

		$button
			.attr( 'aria-label', wp.updates.l10n.installFailedLabel.replace( '%s', pluginData[ response.plugin ].Name ) )
			.text( wp.updates.l10n.installFailedShort ).removeClass( 'updating-message' );

		wp.a11y.speak( errorMessage, 'assertive' );

		$document.trigger( 'wp-plugin-install-error', response );
	};

	/**
	 * Send an Ajax request to the server to delete a plugin.
	 *
	 * @since 4.5.0
	 *
	 * @param {string} plugin
	 * @param {string} slug
	 */
	wp.updates.deletePlugin = function( plugin, slug ) {
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

		var data = {
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
		$( '#' + response.slug + '-update, #' + response.id ).css({ backgroundColor:'#faafaa' }).fadeOut( 350, function() {
			$( this ).remove();
		});

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
		if ( $message.html() !== wp.updates.l10n.updating ){
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
		if ( $message.html() !== wp.updates.l10n.installing ){
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
	 * Send an Ajax request to the server to install a theme.
	 *
	 * @since 4.5.0
	 *
	 * @param {string} slug
	 */
	wp.updates.deleteTheme = function( slug ) {
		var $message = $( '.theme-install[data-slug="' + slug + '"]' ),
			data;

		$message.addClass( 'updating-message' );
		if ( $message.html() !== wp.updates.l10n.installing ){
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
	/*
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
	*/
		$document.trigger( 'wp-theme-delete-error', response );
	};

	/**
	 * If an install/update job has been placed in the queue, queueChecker pulls it out and runs it.
	 *
	 * @since 4.2.0
	 * @since 4.5.0 Can handle multiple job types.
	 */
	wp.updates.queueChecker = function() {
		if ( wp.updates.updateLock || wp.updates.updateQueue.length <= 0 ) {
			// Clear the update lock when the queue is empty.
			if ( wp.updates.updateQueue.length <= 0 ) {
				wp.updates.updateLock = false;
				// Update the status with final progress results.
				switch ( wp.updates.currentJobType ) {
					case 'bulk-update-plugin':
						var updateMessage = wp.updates.l10n.updatedPluginsMsg;
						if ( 0 !== wp.updates.pluginUpdateSuccesses ) {
							updateMessage += ' ' + wp.updates.l10n.updatedPluginsSuccessMsg.replace( '%d', wp.updates.pluginUpdateSuccesses );
						}
						if ( 0 !== wp.updates.pluginUpdateFailures ) {
							updateMessage += ' ' + wp.updates.l10n.updatedPluginsFailureMsg.replace( '%d', wp.updates.pluginUpdateFailures );
						}
						// Start the progress for this update.
						wp.updates.updateProgressMessage( updateMessage );
						break;
				}

				// Close out the progress updater.
				wp.updates.finishProgressUpdates();
			}
			return;
		}

		var job = wp.updates.updateQueue.shift();

		wp.updates.currentJobType = job.type;
		switch ( job.type ) {
			case 'install-plugin':
				wp.updates.installPlugin( job.data.slug );
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
	 * Set up plugin install cards by adding flag HTML for Install or Upgrade.
	 *
	 * @todo move this to the actual HTML.
	 */
	wp.updates.addActionLabelsToPluginCards = function() {
		var $installPluginCards = $( 'body.plugin-install-php .plugin-card' );

		_.each( $installPluginCards, function( card ) {
			$( card )
				.find( '.install-now' )
				.parents( '.action-links' )
				.after( '<span class="plugin-bulk-action-label bulk-install">INSTALL</span>' );
			$( card )
				.find( '.update-now' )
				.parents( '.action-links' )
				.after( '<span class="plugin-bulk-action-label bulk-update">UPDATE</span>' );
			$( card )
				.find( '.button-disabled' )
				.parents( '.action-links' )
				.after( '<span class="plugin-bulk-action-label bulk-update">ALREADY INSTALLED</span>' );
		} );
	}


	/**
	 * Document ready plugin setup.
	 */
	$( function() {
		var $pluginList         = $( '#the-list' ),
			$bulkActionForm     = $( '#bulk-action-form' );

		// Set up the plugin cards.
		wp.updates.addActionLabelsToPluginCards();



		/**
		 * Handle the bulk select button.
		 *
		 * Toggles bulk plugin install mode:
		 *  ~ Hide tabs and search
		 *  ~ Shows update action button
		 *  ~ Handle card clicks as selection
		 *  ~ Activate update button
		 */
		$( document ).on( 'click', '.bulk-plugin-actions .button', function( evnt ) {
			var selectedPlugins,
				$body = $( 'body' );

			// Add the bulk selection mode class.
			$body.addClass( 'bulk-plugin-selection-mode' );

		} );

		/**
		 * Handle the new plugin screen bulk action upgrade/install button.
		 */
		$( document ).on( 'click', '.bulk-plugin-action-upgrade-install .button', function() {
			var pluginsToUpdate  = [],
				pluginsToInstall = [],
				$activeCards     = $( 'body.plugin-install-php .plugin-card.plugin-selected' );

			// Get out of bulk selection mode.
			$( 'body' ).removeClass( 'bulk-plugin-selection-mode' );

			// @todo disable interactions, disable bulk select button until complete

			// Go thru cards that are selected, queueing plugins for install and upgrade.
			_.each( $activeCards, function( card ) {
				var $installButton = $( card ).find( '.install-now' ),
					$updateButton  = $( card ).find( '.update-now' );

				// Add to install queue if install button found.
				if ( $installButton.length > 0 ) {
					pluginsToInstall.push( {
						plugin: $installButton.data( 'plugin' ),
						slug:   $installButton.data( 'slug' )
					} );
				}

				// Add to update queue if update button found.
				if ( $updateButton.length > 0 ) {
					pluginsToUpdate.push( {
						plugin: $updateButton.data( 'plugin' ),
						slug:   $updateButton.data( 'slug' )
					} );
				}
			} );

			if ( 0 !== pluginsToUpdate.length ) {
				wp.updates.bulkUpdatePlugins( pluginsToUpdate );
			}


		} );

		/**
		 * Handle card clicks on the plugin install screen by adding a selected class.
		 */
		$( 'body.plugin-install-php' ).on( 'click', '.plugin-card', function( evnt ) {
			var $pluginList    = $( '#the-list' ),
				$currentTarget = $( evnt.currentTarget );

			// Only handle selection in bulk selection mode.
			if ( ! $( 'body' ).hasClass( 'bulk-plugin-selection-mode' ) ) {
				return;
			}

			// Stop other click handling.
			evnt.preventDefault();

			// Toggle selection of actionable plugins.
			if ( $currentTarget.find( '.button-disabled' ).length === 0 ) {
				$currentTarget.toggleClass( 'plugin-selected' );

				// If any cards are selected, enable the bulk action button.
				selectedPlugins = $pluginList.find( '.plugin-card.plugin-selected' );
				if ( selectedPlugins.length > 0 ) {
					$( '.bulk-action-upgrade-install' ).attr( 'disabled', false );
				} else {
					// No cards selected, disable the action button.
					$( '.bulk-action-upgrade-install' ).attr( 'disabled', true );
				}
			}
		} );


		/**
		 * Cancel the bulk selection mode.
		 */
		$( document ).on( 'click', '.bulk-plugin-action-cancel .button', function( evnt ) {
			// Remove the bulk selection mode class.
			$( 'body' ).removeClass( 'bulk-plugin-selection-mode' );

			// When bulk selection is turned off, remove card click handler.
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

			if ( ! confirm( wp.updates.l10n.aysDelete ) ) {
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
		$bulkActionForm.on( 'click', '[type="submit"]', function ( event ) {
			if ( 'update-selected' !== $( event.target ).siblings( 'select' ).val() ) {
				return;
			}

			if ( wp.updates.shouldRequestFilesystemCredentials && ! wp.updates.updateLock ) {
				wp.updates.requestFilesystemCredentials( event );
			}

			var plugins = [];
			event.preventDefault();

			// Uncheck the bulk checkboxes.
			$( '.manage-column [type="checkbox"]' ).prop( 'checked', false );

			//Find all the checkboxes which have been checked.
			$bulkActionForm
				.find( 'input[name="checked[]"]:checked' )
				.each( function ( index, element ) {
					var $checkbox = $( element );

					// Uncheck the box.
					$checkbox.prop( 'checked', false );

					// Only add updatable plugins to the queue.
					if ( $checkbox.parents( 'tr' ).hasClass( 'update' ) ) {
						plugins.push({
							plugin: $checkbox.val(),
							slug:   $checkbox.parents( 'tr' ).prop( 'id' )
						});
					}
			});
			if ( 0 !== plugins.length ) {
				wp.updates.bulkUpdatePlugins( plugins );
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
		$( document ) .on( 'wp-progress-updated wp-theme-update-error wp-theme-install-error', function () {
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
						});
					});
				});

				$el.append( $button );
			});
		} );

		$( '#plugin-search-input' ).on( 'keyup search', function() {
			var val  = $( this ).val(),
				data = {
					'_ajax_nonce': wp.updates.ajaxNonce,
					's':           val
				},
				jqxhr;

			if ( 'undefined' !== typeof wp.updates.searchRequest ) {
				wp.updates.searchRequest.abort();
			}

			wp.updates.searchRequest = wp.ajax.post( 'search-plugins', data ).done( function( response ) {
				$( '#the-list' ).empty().append( response.items );
				delete wp.updates.searchRequest;
			});
		} );
	});

})( jQuery, window.wp );
