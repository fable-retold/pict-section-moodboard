const libChai = require('chai');
const libExpect = libChai.expect;

const libMoodboardView = require('../source/views/PictView-Moodboard.js');

// A view-shaped stub whose prototype IS the moodboard view, so a method under test can call its sibling
// prototype methods without a full Pict app.
function makeStub(pProps) { return Object.assign(Object.create(libMoodboardView.prototype), pProps); }

// A minimal flow stub that tracks its read-only flag through setReadOnly / isReadOnly, the way the real
// PictView-Flow does. setEditable and _applyDisplayStyle drive read-only through these.
function makeFlow(pReadOnly)
{
	let tmpReadOnly = !!pReadOnly;
	return {
		_FlowData: { ViewState: {} },
		options: {},
		setReadOnly: function (pReadOnlyFlag) { tmpReadOnly = !!pReadOnlyFlag; },
		isReadOnly: function () { return tmpReadOnly; }
	};
}

// A moodboard view is often a reused singleton (a host mounts one editable + one read-only instance and
// swaps them across many boards). These are harness-free unit tests that the view leaves no stale
// edit / fullscreen state on that shared instance: it re-asserts its configured mode on every board load
// and exits fullscreen / frame-editing on unmount.
suite('Moodboard state hygiene',
function ()
{
	suite('_afterBoardApplied re-asserts the configured mode',
	function ()
	{
		// Stub out the downstream board-applied work so the test isolates the mode re-assertion.
		function makeReassertStub(pProps)
		{
			return makeStub(Object.assign(
				{
					_isPresentationStyle: function () { return false; },
					_applyDisplayStyle: function () {},
					_applyBackgroundSoon: function () {},
					_fitSoon: function () {},
					_fullscreenOnEditSoon: function () {}
				}, pProps));
		}

		test('a read-only instance whose flow was left editable is restored to read-only', function ()
		{
			// The flow starts editable (read-only false) -- stale from a previous board on the reused
			// instance -- while this instance is configured Editable:false.
			let tmpFlow = makeFlow(false);
			let tmpStub = makeReassertStub({ options: { Editable: false }, _FlowView: tmpFlow });
			tmpStub._afterBoardApplied();
			libExpect(tmpFlow.isReadOnly()).to.equal(true);
			libExpect(tmpFlow.options.EnableNodeDragging).to.equal(false);
			libExpect(tmpFlow.options.EnableCardPalette).to.equal(false);
		});

		test('an editable instance whose flow was left read-only is restored to editable', function ()
		{
			let tmpFlow = makeFlow(true);
			let tmpStub = makeReassertStub({ options: { Editable: true }, _FlowView: tmpFlow });
			tmpStub._afterBoardApplied();
			libExpect(tmpFlow.isReadOnly()).to.equal(false);
			libExpect(tmpFlow.options.EnableNodeDragging).to.equal(true);
			libExpect(tmpFlow.options.EnableCardPalette).to.equal(true);
		});
	});

	suite('onBeforeUnload leaves no presentation state on the shared flow',
	function ()
	{
		test('exits fullscreen and turns off the frame-edit handles', function ()
		{
			let tmpCalls = { exit: 0, frameEditing: [] };
			let tmpFlow =
			{
				_teardownFitObserver: function () {},
				exitFullscreen: function () { tmpCalls.exit++; },
				setFrameEditing: function (pOn) { tmpCalls.frameEditing.push(pOn); }
			};
			let tmpStub = makeStub({ _FlowView: tmpFlow, _FrameEditing: true });
			tmpStub.onBeforeUnload();
			libExpect(tmpCalls.exit).to.equal(1);
			libExpect(tmpStub._FrameEditing).to.equal(false);
			libExpect(tmpCalls.frameEditing).to.deep.equal([ false ]);
		});

		test('does not toggle frame editing when it was already off', function ()
		{
			let tmpCalls = { frameEditing: [] };
			let tmpFlow =
			{
				_teardownFitObserver: function () {},
				exitFullscreen: function () {},
				setFrameEditing: function (pOn) { tmpCalls.frameEditing.push(pOn); }
			};
			let tmpStub = makeStub({ _FlowView: tmpFlow, _FrameEditing: false });
			tmpStub.onBeforeUnload();
			libExpect(tmpCalls.frameEditing).to.deep.equal([]);
		});

		test('is safe when the flow sub-view never mounted', function ()
		{
			let tmpStub = makeStub({ _FlowView: null });
			libExpect(function () { tmpStub.onBeforeUnload(); }).to.not.throw();
		});
	});
});
