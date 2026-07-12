const libChai = require('chai');
const libExpect = libChai.expect;

const libMoodboardView = require('../source/views/PictView-Moodboard.js');
const libMoodboardModule = require('../source/Pict-Section-Moodboard.js');
const libMoodDrawingCard = require('../source/cards/MoodDrawing-Card.js');
const libFable = require('fable');

// A view-shaped stub whose prototype IS the moodboard view, so the pure-logic drawing methods
// (_looksLikeSvg, _stampDrawingFlags) can be exercised without a full Pict app or a DOM. The SVG
// fetch/inline path (_prepareSvg / _loadInlineSvg) is browser-only (DOMParser / fetch) and is
// verified end-to-end in the app, not here.
function makeStub(pProps) { return Object.assign(Object.create(libMoodboardView.prototype), pProps || {}); }

// The drawing card embeds a gallery image or drawing, linked to its source, rendered into the board's
// own SVG (a native <image>, or the inlined vector for an SVG source). These tests cover the source-type
// detection, the panel state stamping, and the card's node-type configuration.
suite('Moodboard drawing card',
function ()
{
	suite('_looksLikeSvg',
	function ()
	{
		let tmpStub = makeStub();

		test('detects an SVG by its mime type', function ()
		{
			libExpect(tmpStub._looksLikeSvg({ Url: '/1.0/Media/7/Blob', Metadata: { MimeType: 'image/svg+xml' } })).to.equal(true);
		});

		test('detects an SVG by the item name extension', function ()
		{
			libExpect(tmpStub._looksLikeSvg({ Name: 'flow-diagram.svg', Url: '/1.0/Media/7/Blob' })).to.equal(true);
		});

		test('detects an SVG by the original file name', function ()
		{
			libExpect(tmpStub._looksLikeSvg({ Name: 'Media 7', Url: '/1.0/Media/7/Blob', Metadata: { OriginalFileName: 'sketch.SVG' } })).to.equal(true);
		});

		test('detects an SVG data URL', function ()
		{
			libExpect(tmpStub._looksLikeSvg({ Url: 'data:image/svg+xml;utf8,<svg></svg>' })).to.equal(true);
		});

		test('detects an SVG by a .svg URL path (ignoring the query string)', function ()
		{
			libExpect(tmpStub._looksLikeSvg({ Url: 'https://cdn.example.com/art/logo.svg?v=3' })).to.equal(true);
		});

		test('treats a raster PNG as not an SVG', function ()
		{
			libExpect(tmpStub._looksLikeSvg({ Name: 'bar-chart.png', Url: '/1.0/Media/2/Blob', Metadata: { MimeType: 'image/png' } })).to.equal(false);
		});

		test('an extensionless by-id blob URL with no mime is not assumed to be an SVG', function ()
		{
			libExpect(tmpStub._looksLikeSvg({ Name: 'Media 2', Url: '/1.0/Media/2/Blob' })).to.equal(false);
		});

		test('is safe with a null item', function ()
		{
			libExpect(tmpStub._looksLikeSvg(null)).to.equal(false);
		});
	});

	suite('_stampDrawingFlags',
	function ()
	{
		let tmpStub = makeStub();

		test('a contain fit selects the contain option', function ()
		{
			let tmpNode = { Data: { Fit: 'contain', SourceId: 3 } };
			tmpStub._stampDrawingFlags(tmpNode);
			libExpect(tmpNode.Data.FitContainSel).to.equal('selected');
			libExpect(tmpNode.Data.FitCoverSel).to.equal('');
		});

		test('a cover fit selects the cover option', function ()
		{
			let tmpNode = { Data: { Fit: 'cover', SourceId: 3 } };
			tmpStub._stampDrawingFlags(tmpNode);
			libExpect(tmpNode.Data.FitCoverSel).to.equal('selected');
			libExpect(tmpNode.Data.FitContainSel).to.equal('');
		});

		test('the linked-source block shows once a source id is set', function ()
		{
			let tmpNode = { Data: { Fit: 'contain', SourceId: 5 } };
			tmpStub._stampDrawingFlags(tmpNode);
			libExpect(tmpNode.Data._SourceShow).to.equal('mbp-show');
		});

		test('the linked-source block shows when only a URL is set (no id)', function ()
		{
			let tmpNode = { Data: { Fit: 'contain', DrawingUrl: 'data:image/png;base64,AAAA' } };
			tmpStub._stampDrawingFlags(tmpNode);
			libExpect(tmpNode.Data._SourceShow).to.equal('mbp-show');
		});

		test('the linked-source block stays hidden with no source', function ()
		{
			let tmpNode = { Data: { Fit: 'contain' } };
			tmpStub._stampDrawingFlags(tmpNode);
			libExpect(tmpNode.Data._SourceShow).to.equal('');
		});
	});

	suite('node-type configuration',
	function ()
	{
		let tmpCard = new libMoodDrawingCard(new libFable(), {}, 'Moodboard-DrawingCard');
		let tmpConfig = tmpCard.getNodeTypeConfiguration();

		test('is registered under the MoodDrawing type in the Moodboard category', function ()
		{
			libExpect(tmpConfig.Hash).to.equal('MoodDrawing');
			libExpect(tmpConfig.Label).to.equal('Drawing');
			libExpect(tmpConfig.CardMetadata.Category).to.equal('Moodboard');
		});

		test('renders its body into the board SVG (ContentType svg, not an HTML foreignObject)', function ()
		{
			libExpect(tmpConfig.BodyContent.ContentType).to.equal('svg');
		});

		test('carries the imperative SVG render callback (preserved through the config clone)', function ()
		{
			libExpect(typeof tmpConfig.BodyContent.RenderCallback).to.equal('function');
		});
	});

	suite('module export',
	function ()
	{
		test('the module entry exports the drawing card', function ()
		{
			libExpect(libMoodboardModule.MoodDrawingCard).to.equal(libMoodDrawingCard);
		});
	});
});
