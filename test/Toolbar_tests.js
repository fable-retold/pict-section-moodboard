const libChai = require('chai');
const libExpect = libChai.expect;

const libMoodboardView = require('../source/views/PictView-Moodboard.js');

// A view-shaped stub whose prototype IS the moodboard view, so a method under test can call its sibling
// prototype methods (e.g. _buildToolbarButtons -> _displayStyle) without a full Pict app.
function makeStub(pProps) { return Object.assign(Object.create(libMoodboardView.prototype), pProps); }

// The moodboard contributes its editing controls to pict-section-flow's one toolbar through the flow's
// ToolbarExtraButtons extension: the display-style toggle (canvas / jumbotron / background), Set view
// area, and Connections (editable only), plus whatever Edit / Done button the host supplies via
// options.ToolbarButtons. The board color + backdrop margin live in the flow gear, not the toolbar.
// Clicks route through onToolbarButton -- the style toggles set the display style, everything else either
// handles internally or forwards to the host. Harness-free unit tests of that wiring.
suite('Moodboard flow-toolbar buttons',
function ()
{
	suite('_buildToolbarButtons',
	function ()
	{
		test('an editable board leads with the display-mode button + set-view-area + connections, then the host buttons',
		function ()
		{
			let tmpStub = makeStub({ options: { ToolbarButtons: [ { Hash: 'done', Icon: 'check', Label: 'Done' } ] }, _FlowView: null });
			let tmpButtons = tmpStub._buildToolbarButtons(true);
			libExpect(tmpButtons.map((pButton) => pButton.Hash)).to.deep.equal([ 'mb-display', 'mb-frame', 'mb-connect', 'done' ]);
		});

		test('the single display-mode button icon reflects the stored mode (no per-mode buttons, no toggle LED)',
		function ()
		{
			let tmpCanvas = makeStub({ options: {}, _FlowView: { _FlowData: { ViewState: { DisplayStyle: 'canvas' } } } })._buildToolbarButtons(true);
			let tmpCanvasButton = tmpCanvas.find((b) => b.Hash === 'mb-display');
			libExpect(tmpCanvasButton.Icon).to.equal('display-canvas');
			libExpect(tmpCanvasButton.Toggle).to.equal(undefined);

			let tmpJumbo = makeStub({ options: {}, _FlowView: { _FlowData: { ViewState: { DisplayStyle: 'jumbotron' } } } })._buildToolbarButtons(true);
			libExpect(tmpJumbo.find((b) => b.Hash === 'mb-display').Icon).to.equal('display-jumbotron');
		});

		test('a read-only board has the pan/zoom toggle plus host buttons (no edit-only buttons)',
		function ()
		{
			let tmpStub = makeStub({ options: { ToolbarButtons: [ { Hash: 'edit', Icon: 'edit', Label: 'Edit board' } ] }, _FlowView: null });
			let tmpButtons = tmpStub._buildToolbarButtons(false);
			libExpect(tmpButtons.map((pButton) => pButton.Hash)).to.deep.equal([ 'mb-navigate', 'edit' ]);
			libExpect(tmpButtons[0].Icon).to.equal('pan');
		});

		test('no host buttons + read-only yields just the pan/zoom toggle',
		function ()
		{
			let tmpButtons = makeStub({ options: {}, _FlowView: null })._buildToolbarButtons(false);
			libExpect(tmpButtons.map((pButton) => pButton.Hash)).to.deep.equal([ 'mb-navigate' ]);
		});

		test('no host buttons + editable yields the display-mode button + set-view-area + connections',
		function ()
		{
			let tmpButtons = makeStub({ options: {}, _FlowView: null })._buildToolbarButtons(true);
			libExpect(tmpButtons.map((pButton) => pButton.Hash)).to.deep.equal([ 'mb-display', 'mb-frame', 'mb-connect' ]);
		});
	});

	suite('onToolbarButton routing',
	function ()
	{
		test('the display-mode button opens the dropdown menu (anchored to its element), not the host hook',
		function ()
		{
			let tmpOpened = [];
			let tmpElement = { id: 'display-button' };
			let tmpStub = makeStub({ openDisplayMenu: (pEl) => { tmpOpened.push(pEl); }, options: { onToolbarButton: () => { throw new Error('host hook should not fire for mb-display'); } } });
			tmpStub.onToolbarButton('mb-display', tmpElement);
			libExpect(tmpOpened.length).to.equal(1);
			libExpect(tmpOpened[0]).to.equal(tmpElement);
		});

		test('picking a mode from the dropdown closes it and sets that display style',
		function ()
		{
			let tmpClosed = 0, tmpSet = [];
			let tmpStub = makeStub({ closeDisplayMenu: () => { tmpClosed++; }, setDisplayStyle: (pStyle) => { tmpSet.push(pStyle); } });
			tmpStub.pickDisplayStyle('jumbotron');
			libExpect(tmpClosed).to.equal(1);
			libExpect(tmpSet).to.deep.equal([ 'jumbotron' ]);
		});

		test('the Set-view-area button routes to toggleFrameEditing, not the host hook',
		function ()
		{
			let tmpCalled = 0;
			let tmpStub = makeStub({ toggleFrameEditing: () => { tmpCalled++; }, options: { onToolbarButton: () => { throw new Error('host hook should not fire for mb-frame'); } } });
			tmpStub.onToolbarButton('mb-frame', null);
			libExpect(tmpCalled).to.equal(1);
		});

		test('the Navigate (hand) button routes to toggleNavigate, not the host hook',
		function ()
		{
			let tmpCalled = 0;
			let tmpStub = makeStub({ toggleNavigate: () => { tmpCalled++; }, options: { onToolbarButton: () => { throw new Error('host hook should not fire for mb-navigate'); } } });
			tmpStub.onToolbarButton('mb-navigate', null);
			libExpect(tmpCalled).to.equal(1);
		});

		test('a host button forwards to options.onToolbarButton with (hash, element)',
		function ()
		{
			let tmpForwarded = [];
			let tmpElement = { id: 'edit-button' };
			let tmpStub = makeStub({ options: { onToolbarButton: (pHash, pEl) => { tmpForwarded.push({ Hash: pHash, El: pEl }); } } });
			tmpStub.onToolbarButton('edit', tmpElement);
			libExpect(tmpForwarded.length).to.equal(1);
			libExpect(tmpForwarded[0].Hash).to.equal('edit');
			libExpect(tmpForwarded[0].El).to.equal(tmpElement);
		});

		test('a host button with no hook configured is a no-op (does not throw)',
		function ()
		{
			let tmpStub = makeStub({ options: {} });
			libExpect(function () { tmpStub.onToolbarButton('edit', {}); }).to.not.throw();
		});
	});
});
