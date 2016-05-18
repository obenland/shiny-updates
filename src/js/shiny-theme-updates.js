window.wp = window.wp || {};

(function( $, wp ) {

	/**
	 * Add id attribute in theme.js.
	 */
	wp.themes.view.Theme = wp.themes.view.Theme.extend( {
		initialize: function() {
			this.model.on( 'change', this.render, this );
		},

		render: function() {
			var data = this.model.toJSON();

			// Render themes using the html template
			this.$el.html( this.html( data ) )
				.attr( {
					tabindex: 0,
					'aria-describedby': data.id + '-action ' + data.id + '-name',
					'data-slug': data.id
				} );

			// Renders active theme styles
			this.activeTheme();

			if ( this.model.get( 'displayAuthor' ) ) {
				this.$el.addClass( 'display-author' );
			}

			if ( this.model.get( 'installed' ) ) {
				this.$el.addClass( 'is-installed' );
			}
		},

		events: {
			'click': wp.themes.isInstall ? 'preview' : 'expand',
			'keydown': wp.themes.isInstall ? 'preview' : 'expand',
			'touchend': wp.themes.isInstall ? 'preview' : 'expand',
			'keyup': 'addFocus',
			'touchmove': 'preventExpand',
			'click .theme-install': 'installTheme',
			'click .update-message': 'updateTheme'
		},

		installTheme: function( event ) {
			var _this = this;
			event.preventDefault();

			if ( wp.updates.shouldRequestFilesystemCredentials && ! wp.updates.updateLock ) {
				wp.updates.requestFilesystemCredentials( event );
			}

			$( document ).on( 'wp-install-theme-success', function( event, response ) {
				if ( _this.model.get( 'id' ) === response.slug ) {
					_this.model.set( { 'installed': true } );
				}
			} );

			wp.updates.installTheme( {
				slug:    $( event.target ).data( 'slug' ),
				success: wp.updates.installThemeSuccess,
				error:   wp.updates.installThemeError
			} );
		},

		// Single theme overlay screen
		// It's shown when clicking a theme
		expand: function( event ) {
			var self = this;

			event = event || window.event;

			// 'enter' and 'space' keys expand the details view when a theme is :focused
			if ( 'keydown' === event.type && ( 13 !== event.which && 32 !== event.which ) ) {
				return;
			}

			// Bail if the user scrolled on a touch device
			if ( true === this.touchDrag ) {
				return this.touchDrag = false;
			}

			// Prevent the modal from showing when the user clicks
			// one of the direct action buttons
			if ( $( event.target ).is( '.theme-actions a, .update-message, .button-link, .notice-dismiss' ) ) {
				return;
			}

			// Set focused theme to current element
			wp.themes.focusedTheme = this.$el;

			this.trigger( 'theme:expand', self.model.cid );
		},

		updateTheme: function( event ) {
			var _this = this;
			event.preventDefault();
			this.$el.off( 'click', '.update-message' );

			if ( wp.updates.shouldRequestFilesystemCredentials && ! wp.updates.updateLock ) {
				wp.updates.requestFilesystemCredentials( event );
			}

			$( document ).on( 'wp-theme-update-success', function( event, response ) {
				_this.model.off( 'change', _this.render, _this );
				if ( _this.model.get( 'id' ) === response.slug ) {
					_this.model.set( response.theme[1] );
				}
				_this.model.on( 'change', _this.render, _this );
			} );

			wp.updates.updateTheme( {
				slug:    $( event.target ).parents( 'div.theme' ).data( 'slug' ),
				success: wp.updates.updateThemeSuccess,
				error:   wp.updates.updateThemeError
			} );
		}
	} );

	wp.themes.view.Details = wp.themes.view.Details.extend( {
		events: {
			'click': 'collapse',
			'click .delete-theme': 'deleteTheme',
			'click .left': 'previousTheme',
			'click .right': 'nextTheme',
			'click #update-theme': 'updateTheme'
		},

		updateTheme: function( event ) {
			var _this = this;
			event.preventDefault();

			if ( wp.updates.shouldRequestFilesystemCredentials && ! wp.updates.updateLock ) {
				wp.updates.requestFilesystemCredentials( event );
			}

			$( document ).on( 'wp-theme-update-success', function( event, response ) {
				if ( _this.model.get( 'id' ) === response.slug ) {
					_this.model.set( response.theme[1] );
				}
				_this.render();
			} );

			wp.updates.updateTheme( {
				slug:    $( event.target ).data( 'slug' ),
				success: wp.updates.updateThemeSuccess,
				error:   wp.updates.updateThemeError
			} );
		},

		deleteTheme: function( event ) {
			var _this = this,
				_collection = _this.model.collection;
			event.preventDefault();

			// Confirmation dialog for deleting a theme.
			if ( ! window.confirm( wp.themes.data.settings.confirmDelete ) ) {
				return;
			}

			if ( wp.updates.shouldRequestFilesystemCredentials && ! wp.updates.updateLock ) {
				wp.updates.requestFilesystemCredentials( event );
			}

			$( document ).one( 'wp-delete-theme-success', function( event, response ) {
				_this.$el.find( '.close' ).trigger( 'click' );
				$( '[data-slug="' + response.slug + '"' ).css( { backgroundColor:'#faafaa' } ).fadeOut( 350, function() {
					$( this ).remove();
					_collection.remove( _this.model );
					_collection.trigger( 'themes:update' );
				} );
			} );

			wp.updates.deleteTheme( {
				slug:    this.model.get( 'id' ),
				success: wp.updates.deleteThemeSuccess,
				error:   wp.updates.deleteThemeError
			} );
		}
	} );

	wp.themes.view.Preview = wp.themes.view.Preview.extend( {
		html: wp.themes.template( 'shiny-theme-preview' ),

		events: {
			'click .close-full-overlay': 'close',
			'click .collapse-sidebar': 'collapse',
			'click .previous-theme': 'previousTheme',
			'click .next-theme': 'nextTheme',
			'keyup': 'keyEvent',
			'click .theme-install': 'installTheme'
		},

		installTheme: function( event ) {
			var _this   = this,
				$target = $( event.target );
			event.preventDefault();

			if ( $target.hasClass( 'disabled' ) ) {
				return;
			}

			if ( wp.updates.shouldRequestFilesystemCredentials && ! wp.updates.updateLock ) {
				wp.updates.requestFilesystemCredentials( event );
			}

			$( document ).on( 'wp-install-theme-success', function() {
				_this.model.set( { 'installed': true } );
			} );

			wp.updates.installTheme( {
				slug:    $target.data( 'slug' ),
				success: wp.updates.installThemeSuccess,
				error:   wp.updates.installThemeError
			} );
		}
	} );

} )( jQuery, window.wp );
