/*global QUnit */

QUnit.module( 'wp.updates' );

QUnit.test( 'Initially, the update lock should be false', function( assert ) {
	assert.strictEqual( wp.updates.updateLock, false );
});

QUnit.test( 'The nonce should be set correctly', function( assert ) {
	assert.equal( wp.updates.ajaxNonce, window._wpUpdatesSettings.ajax_nonce );
});

// QUnit.test( 'decrementCount correctly decreases the update number', function( assert ) {});

QUnit.test( '`beforeunload` should only fire when locked', function( assert ) {
	wp.updates.updateLock = false;
	assert.notOk( wp.updates.beforeunload(), '`beforeunload` should not fire.' );
	wp.updates.updateLock = true;
	assert.equal( wp.updates.beforeunload(), window._wpUpdatesSettings.l10n.beforeunload, '`beforeunload` should equal the localized `beforeunload` string.' );
	wp.updates.updateLock = false;
});

QUnit.module( 'wp.updates.plugins' );
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

	window.pagenow = 'plugins';
	wp.updates.updateLock = true;
	wp.updates.updatePlugin( 'test/test.php', 'test' );

	assert.deepEqual( wp.updates.updateQueue, value );

	delete window.pagenow;
	wp.updates.updateLock = false;
	wp.updates.updateQueue = [];
});

QUnit.module( 'wp.updates.themes' );
QUnit.module( 'wp.updates' );
