/*global QUnit */

QUnit.module( 'wp.updates' );
QUnit.test( 'Update lock', function( assert ) {
	assert.deepEqual( wp.updates.updateLock, false, 'Update lock should be false.' );
});

QUnit.test( 'Ajax nonce', function( assert ) {
	assert.deepEqual( wp.updates.ajaxNonce, window._wpUpdatesSettings.ajax_nonce, 'Ajax nonce should be a string equal to _wpUpdatesSettings value.' );
});

QUnit.test( 'Decrement count', function( assert ) {
	assert.deepEqual( wp.updates.ajaxNonce, window._wpUpdatesSettings.ajax_nonce, 'Ajax nonce should be a string equal to _wpUpdatesSettings value.' );
});

QUnit.test( 'before unload should not fire by default', function( assert ) {
	wp.updates.updateLock = false;
	assert.deepEqual( wp.updates.beforeunload(), undefined );
});
QUnit.test( 'before unload should fire when update lock is active', function( assert ) {
	wp.updates.updateLock = true;
	assert.deepEqual( wp.updates.beforeunload(), window._wpUpdatesSettings.l10n.beforeunload );
	wp.updates.updateLock = false;
});

QUnit.module( 'wp.updates.plugins' );
QUnit.test( 'queue plugin update when locked', function( assert ) {
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
