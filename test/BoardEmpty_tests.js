const libChai = require('chai');
const libExpect = libChai.expect;

const libMoodboardView = require('../source/views/PictView-Moodboard.js');

// A view-shaped stub whose prototype IS the moodboard view, so an instance method under test can reach
// its sibling prototype methods (and the class static) without a full Pict app.
function makeStub(pProps) { return Object.assign(Object.create(libMoodboardView.prototype), pProps); }

// The board-emptiness accessor lets a host decide whether to mount a board at all: an empty board shown
// read-only is just an empty box. These are harness-free unit tests of the pure static and the thin
// instance wrapper (no DOM / Pict app).
suite('Moodboard board emptiness',
function ()
{
	suite('boardIsEmpty (pure static)',
	function ()
	{
		test('a missing board is empty',
		function ()
		{
			libExpect(libMoodboardView.boardIsEmpty(null)).to.equal(true);
			libExpect(libMoodboardView.boardIsEmpty(undefined)).to.equal(true);
		});

		test('the canonical empty board (no nodes) is empty',
		function ()
		{
			let tmpBoard = { Nodes: [], Connections: [], ViewState: { PanX: 0, PanY: 0, Zoom: 1 } };
			libExpect(libMoodboardView.boardIsEmpty(tmpBoard)).to.equal(true);
		});

		test('a board with no Nodes array is empty',
		function ()
		{
			libExpect(libMoodboardView.boardIsEmpty({})).to.equal(true);
			libExpect(libMoodboardView.boardIsEmpty({ ViewState: { PanX: 40, PanY: 10, Zoom: 2 } })).to.equal(true);
		});

		test('pan / zoom ViewState alone is not content',
		function ()
		{
			// A user who only panned / zoomed an otherwise blank board leaves it empty.
			let tmpBoard = { Nodes: [], Connections: [], ViewState: { PanX: 120, PanY: -40, Zoom: 1.5 } };
			libExpect(libMoodboardView.boardIsEmpty(tmpBoard)).to.equal(true);
		});

		test('a board with at least one card node is not empty',
		function ()
		{
			let tmpBoard = { Nodes: [ { Hash: 'n1', Type: 'Moodboard-NoteCard', X: 10, Y: 10, Width: 200, Height: 160 } ], Connections: [], ViewState: {} };
			libExpect(libMoodboardView.boardIsEmpty(tmpBoard)).to.equal(false);
		});
	});

	suite('isBoardEmpty (instance)',
	function ()
	{
		test('tests an explicitly passed board (a host checking a just-loaded row)',
		function ()
		{
			let tmpView = makeStub({});
			libExpect(tmpView.isBoardEmpty({ Nodes: [], Connections: [], ViewState: {} })).to.equal(true);
			libExpect(tmpView.isBoardEmpty({ Nodes: [ { Hash: 'n1' } ] })).to.equal(false);
		});

		test('with no argument it falls back to the live board via getBoard',
		function ()
		{
			// getBoard is what the instance reads when no board is passed; stub it to prove delegation.
			let tmpEmptyView = makeStub({ getBoard: function () { return { Nodes: [], Connections: [], ViewState: {} }; } });
			libExpect(tmpEmptyView.isBoardEmpty()).to.equal(true);
			let tmpFullView = makeStub({ getBoard: function () { return { Nodes: [ { Hash: 'n1' } ], Connections: [], ViewState: {} }; } });
			libExpect(tmpFullView.isBoardEmpty()).to.equal(false);
		});
	});
});
