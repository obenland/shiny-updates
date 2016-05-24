/*global QUnit */
jQuery( function( $ ) {

	QUnit.module( 'wp.updates' );

	QUnit.test( 'Initially, the update lock should be false', function( assert ) {
		assert.strictEqual( wp.updates.updateLock, false );
	});

	QUnit.test( 'The nonce should be set correctly', function( assert ) {
		assert.equal( wp.updates.ajaxNonce, window._wpUpdatesSettings.ajax_nonce );
	});

	QUnit.test( 'decrementCount correctly decreases the update number', function( assert ) {
		var menuItemCount  = $( '#menu-plugins' ).find( '.plugin-count' ).eq( 0 ).text();
		var screenReaderItemCount = $( '#wp-admin-bar-updates' ).find( '.screen-reader-text' ).text();
		var adminItemCount = $( '#wp-admin-bar-updates' ).find( '.ab-label' ).text();
		assert.equal( menuItemCount, 2, 'Intial value is correct' );
		assert.equal( screenReaderItemCount, '2 Plugin Updates', 'Intial value is correct' );
		assert.equal( adminItemCount, 2, 'Intial value is correct' );

		wp.updates.decrementCount( 'plugin' );

		// Re-read these values
		menuItemCount  = $( '#menu-plugins' ).find( '.plugin-count' ).eq( 0 ).text();
		screenReaderItemCount = $( '#wp-admin-bar-updates' ).find( '.screen-reader-text' ).text();
		adminItemCount = $( '#wp-admin-bar-updates' ).find( '.ab-label' ).text();
		assert.equal( menuItemCount, 1 );

		// Should the screenReader count change? Is that announced to the user?
		assert.equal( screenReaderItemCount, '1 Plugin Update' );
		assert.equal( adminItemCount, 1 );
	});

	QUnit.test( '`beforeunload` should only fire when locked', function( assert ) {
		wp.updates.updateLock = false;
		assert.notOk( wp.updates.beforeunload(), '`beforeunload` should not fire.' );
		wp.updates.updateLock = true;
		assert.equal( wp.updates.beforeunload(), window._wpUpdatesSettings.l10n.beforeunload, '`beforeunload` should equal the localized `beforeunload` string.' );
		wp.updates.updateLock = false;
	});

	// FTP creds... exist?
	// Admin notice?

	QUnit.module( 'wp.updates.plugins', {
		beforeEach: function() {
			window.pagenow = 'plugins';
			sinon.spy( jQuery, 'ajax' );
		},
		afterEach: function() {
			delete window.pagenow;
			wp.updates.updateLock = false;
			wp.updates.updateQueue = [];
			jQuery.ajax.restore();
		}
	} );

	QUnit.test( 'Update lock is set when plugins are updating', function( assert ) {
		wp.updates.updatePlugin( {
			plugin: 'test/test.php',
			slug: 'test'
		} );
		assert.strictEqual( wp.updates.updateLock, true );
	});

	QUnit.test( 'Plugins are queued when the lock is set', function( assert ) {
		var value = [
			{
				type: 'update-plugin',
				data: {
					plugin: 'test/test.php',
					slug: 'test'
				}
			}
		];

		wp.updates.updateLock = true;
		wp.updates.updatePlugin( {
			plugin: 'test/test.php',
			slug: 'test'
		} );

		assert.deepEqual( wp.updates.updateQueue, value );
	});

	QUnit.test( 'If plugins are installing (lock is set), the beforeUnload function should fire', function( assert ) {
		wp.updates.updatePlugin( {
			plugin: 'test/test.php',
			slug: 'test'
		} );
		assert.equal( wp.updates.beforeunload(), window._wpUpdatesSettings.l10n.beforeunload );
	} );

	QUnit.test( 'Starting a plugin update should call the update API', function( assert ) {
		wp.updates.updatePlugin( {
			plugin: 'test/test.php',
			slug: 'test'
		} );
		assert.ok( jQuery.ajax.calledOnce );
		assert.equal( jQuery.ajax.getCall( 0 ).args[0].url, '/wp-admin/admin-ajax.php' );
		assert.equal( jQuery.ajax.getCall( 0 ).args[0].data.action, 'update-plugin' );
		assert.equal( jQuery.ajax.getCall( 0 ).args[0].data.slug, 'test' );
	} );
	QUnit.test( 'Installing a plugin should call the API', function( assert ) {
		wp.updates.installPlugin( { slug: 'jetpack' } );
		assert.ok( jQuery.ajax.calledOnce );
		assert.equal( jQuery.ajax.getCall( 0 ).args[0].url, '/wp-admin/admin-ajax.php' );
		assert.equal( jQuery.ajax.getCall( 0 ).args[0].data.action, 'install-plugin' );
		assert.equal( jQuery.ajax.getCall( 0 ).args[0].data.slug, 'jetpack' );
	} );
	QUnit.test( 'Deleting a plugin should call the API', function( assert ) {
		wp.updates.deletePlugin( { slug: 'jetpack' } );
		assert.ok( jQuery.ajax.calledOnce );
		assert.equal( jQuery.ajax.getCall( 0 ).args[0].url, '/wp-admin/admin-ajax.php' );
		assert.equal( jQuery.ajax.getCall( 0 ).args[0].data.action, 'delete-plugin' );
		assert.equal( jQuery.ajax.getCall( 0 ).args[0].data.slug, 'jetpack' );
	} );

	// QUnit.test( 'A successful update changes the message?', function( assert ) {} );
	// QUnit.test( 'A failed update changes the message?', function( assert ) {} );

	QUnit.module( 'wp.updates.themes', {
		beforeEach: function() {
			window.pagenow = 'themes';
			sinon.spy( jQuery, 'ajax' );
		},
		afterEach: function() {
			delete window.pagenow;
			wp.updates.updateLock = false;
			wp.updates.updateQueue = [];
			jQuery.ajax.restore();
		}
	} );

	QUnit.test( 'Update lock is set when themes are updating', function( assert ) {
		wp.updates.updateTheme( 'twentyeleven' );
		assert.strictEqual( wp.updates.updateLock, true );
	});

	QUnit.test( 'If themes are installing (lock is set), the beforeUnload function should fire', function( assert ) {
		wp.updates.updateTheme( { slug: 'twentyeleven' } );
		assert.equal( wp.updates.beforeunload(), window._wpUpdatesSettings.l10n.beforeunload );
	} );

	QUnit.test( 'Starting a theme update should call the update API', function( assert ) {
		wp.updates.updateTheme( { slug: 'twentyeleven' } );
		assert.ok( jQuery.ajax.calledOnce );
		assert.equal( jQuery.ajax.getCall( 0 ).args[0].url, '/wp-admin/admin-ajax.php' );
		assert.equal( jQuery.ajax.getCall( 0 ).args[0].data.action, 'update-theme' );
		assert.equal( jQuery.ajax.getCall( 0 ).args[0].data.slug, 'twentyeleven' );
	} );

	QUnit.test( 'Installing a theme should call the API', function( assert ) {
		wp.updates.installTheme( { slug: 'twentyeleven' } );
		assert.ok( jQuery.ajax.calledOnce );
		assert.equal( jQuery.ajax.getCall( 0 ).args[0].url, '/wp-admin/admin-ajax.php' );
		assert.equal( jQuery.ajax.getCall( 0 ).args[0].data.action, 'install-theme' );
		assert.equal( jQuery.ajax.getCall( 0 ).args[0].data.slug, 'twentyeleven' );
	} );

	QUnit.test( 'Deleting a theme should call the API', function( assert ) {
		wp.updates.deleteTheme( { slug: 'twentyeleven' } );
		assert.ok( jQuery.ajax.calledOnce );
		assert.equal( jQuery.ajax.getCall( 0 ).args[0].url, '/wp-admin/admin-ajax.php' );
		assert.equal( jQuery.ajax.getCall( 0 ).args[0].data.action, 'delete-theme' );
		assert.equal( jQuery.ajax.getCall( 0 ).args[0].data.slug, 'twentyeleven' );
	} );

	// QUnit.test( 'A successful update changes the message?', function( assert ) {} );
	// QUnit.test( 'A failed update changes the message?', function( assert ) {} );
});
