'use strict';

/**
 * MoodDrawing: a moodboard card that embeds a gallery image or drawing and stays linked to its source.
 *
 * Unlike MoodImage (a static <img> snapshot rendered inside an HTML foreignObject), a drawing card:
 *   - remembers WHERE it came from (Data.SourceId) so it can be refreshed from the source (a re-saved
 *     drawing, a replaced blob) through the panel's "Update from source" button, and
 *   - renders into the board's OWN SVG rather than a foreignObject -- a native <image> element for a
 *     raster source, or the drawing's actual vector inlined (Data.SvgMarkup) for an SVG source. That is
 *     what "projected into the proper svg" means: the drawing lives in the whiteboard's SVG coordinate
 *     space (crisp at any zoom, part of a serialized/exported board), not bolted on through foreignObject.
 *
 * Data shape:
 *   Data.DrawingUrl - the source's URL (a direct URL or a data URL). Clean base (no cache-bust params).
 *   Data.SourceId   - the gallery item id it is linked to (opaque; the board's ImageSource owns it).
 *   Data.SourceName - a friendly name for the linked source (shown in the panel).
 *   Data.IsSvg      - true when the source is an SVG (drives the inline-vector path).
 *   Data.SvgMarkup  - the sanitized inner SVG markup, inlined so the vector projects into the board SVG.
 *   Data.SvgViewBox - the source SVG's viewBox (so the inlined vector scales to the card box).
 *   Data.Fit        - 'contain' (default; a drawing usually wants to show whole) or 'cover'.
 *   Data.Rev        - a cache-bust revision bumped on refresh so a replaced blob re-loads.
 *
 * The board (PictView-Moodboard) drives all of this: setDrawingSource / refreshDrawing / setDrawingFit.
 *
 * @author Steven Velozo <steven@velozo.com>
 * @license MIT
 */

const libPictFlowCard = require('pict-section-flow').PictFlowCard;

const _SVG_NS = 'http://www.w3.org/2000/svg';
const _XLINK_NS = 'http://www.w3.org/1999/xlink';

// Append the cache-bust revision so a source whose bytes were replaced in place re-loads. Data URLs are
// already self-contained, so they are left alone.
function _revUrl(pUrl, pRev)
{
	if (!pUrl || !pRev) { return pUrl || ''; }
	if (pUrl.indexOf('data:') === 0) { return pUrl; }
	return pUrl + ((pUrl.indexOf('?') >= 0) ? '&' : '?') + '_r=' + pRev;
}

// The SVG body render (see pict-section-flow PictView-Flow-Node._renderBodyContentSVG): builds the
// linked drawing directly into the node's SVG content <g>. Runs on every node render; it only reads
// node Data (the fetch that fills SvgMarkup happens once, in the board, on pick / refresh).
function renderDrawingBody(pContentGroup, pNodeData, pNodeTypeConfig, pBounds)
{
	if (typeof document === 'undefined' || !pContentGroup) { return; }
	let tmpData = (pNodeData && pNodeData.Data) ? pNodeData.Data : {};
	let tmpWidth = Math.max(1, (pBounds && pBounds.width) ? pBounds.width : 1);
	let tmpHeight = Math.max(1, (pBounds && pBounds.height) ? pBounds.height : 1);
	let tmpPAR = (tmpData.Fit === 'cover') ? 'xMidYMid slice' : 'xMidYMid meet';

	// Inlined vector: the drawing's own SVG, projected into the board SVG as true vector.
	if (tmpData.SvgMarkup)
	{
		let tmpInner = document.createElementNS(_SVG_NS, 'svg');
		tmpInner.setAttribute('class', 'mb-drawing mb-drawing-svg');
		tmpInner.setAttribute('x', '0');
		tmpInner.setAttribute('y', '0');
		tmpInner.setAttribute('width', String(tmpWidth));
		tmpInner.setAttribute('height', String(tmpHeight));
		tmpInner.setAttribute('preserveAspectRatio', tmpPAR);
		if (tmpData.SvgViewBox) { tmpInner.setAttribute('viewBox', tmpData.SvgViewBox); }
		tmpInner.innerHTML = tmpData.SvgMarkup;
		pContentGroup.appendChild(tmpInner);
		return;
	}

	// Linked raster (or an SVG we could not inline): a native <image>, still inside the board SVG.
	if (tmpData.DrawingUrl)
	{
		let tmpHref = _revUrl(tmpData.DrawingUrl, tmpData.Rev);
		let tmpImage = document.createElementNS(_SVG_NS, 'image');
		tmpImage.setAttribute('class', 'mb-drawing mb-drawing-image');
		tmpImage.setAttribute('x', '0');
		tmpImage.setAttribute('y', '0');
		tmpImage.setAttribute('width', String(tmpWidth));
		tmpImage.setAttribute('height', String(tmpHeight));
		tmpImage.setAttribute('preserveAspectRatio', tmpPAR);
		tmpImage.setAttribute('href', tmpHref);
		// xlink:href for renderers that predate SVG2 href on <image>.
		tmpImage.setAttributeNS(_XLINK_NS, 'xlink:href', tmpHref);
		pContentGroup.appendChild(tmpImage);
		return;
	}

	// Empty: a dashed placeholder so the card is visible before a source is picked.
	let tmpRect = document.createElementNS(_SVG_NS, 'rect');
	tmpRect.setAttribute('class', 'mb-drawing-empty');
	tmpRect.setAttribute('x', '0.5');
	tmpRect.setAttribute('y', '0.5');
	tmpRect.setAttribute('width', String(Math.max(1, tmpWidth - 1)));
	tmpRect.setAttribute('height', String(Math.max(1, tmpHeight - 1)));
	pContentGroup.appendChild(tmpRect);
	let tmpText = document.createElementNS(_SVG_NS, 'text');
	tmpText.setAttribute('class', 'mb-drawing-empty-label');
	tmpText.setAttribute('x', String(tmpWidth / 2));
	tmpText.setAttribute('y', String(tmpHeight / 2));
	tmpText.setAttribute('text-anchor', 'middle');
	tmpText.setAttribute('dominant-baseline', 'middle');
	tmpText.textContent = 'Pick a drawing';
	pContentGroup.appendChild(tmpText);
}

class MoodDrawingCard extends libPictFlowCard
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, Object.assign(
			{},
			{
				Title: 'Drawing',
				Name: 'Drawing',
				Code: 'MoodDrawing',
				Description: 'A gallery image or drawing, linked to its source. Update it from the source; it renders as SVG.',
				Category: 'Moodboard',
				Width: 260,
				Height: 200,
				CornerRadius: 8,
				ColorRole: 'none',
				BodyStyle: { fill: 'var(--theme-color-background-tertiary, #eef1f4)' },
				Inputs: [],
				Outputs: [],
				ShowTypeLabel: false,
				// Rendered into the board's own SVG (a native <image> or inlined vector), not a foreignObject,
				// so the drawing projects into the whiteboard SVG. renderDrawingBody does the imperative build.
				BodyContent:
				{
					ContentType: 'svg',
					Padding: 0,
					RenderCallback: renderDrawingBody
				},
				PropertiesPanel:
				{
					PanelType: 'Template',
					DefaultWidth: 280,
					DefaultHeight: 380,
					Title: 'Drawing',
					Configuration:
					{
						TemplateHash: 'Moodboard-Drawing-Panel',
						Templates:
						[
							{
								Hash: 'Moodboard-Drawing-Panel',
								Template: /*html*/`
<div class="mbp">
	<label class="mbp-label">Drawing</label>
	<button class="mbp-btn" onclick="_Pict.views['{~D:AppData.Moodboard.ViewID~}'].openPickerForCard('{~D:Record.Hash~}', 'drawing')">Pick from gallery</button>
	<div class="mbp-drawingsource {~D:Record.Data._SourceShow~}">
		<div class="mbp-hint">Linked to <b>{~D:Record.Data.SourceName~}</b></div>
		<button class="mbp-btn" onclick="_Pict.views['{~D:AppData.Moodboard.ViewID~}'].refreshDrawing('{~D:Record.Hash~}')">Update from source</button>
	</div>
	<label class="mbp-label">Fit</label>
	<select class="mbp-input" onchange="_Pict.views['{~D:AppData.Moodboard.ViewID~}'].setDrawingFit('{~D:Record.Hash~}', this.value)">
		<option value="contain" {~D:Record.Data.FitContainSel~}>Contain (show all)</option>
		<option value="cover" {~D:Record.Data.FitCoverSel~}>Cover (fill the tile)</option>
	</select>
	<label class="mbp-label">Rotation</label>
	<input class="mbp-range" type="range" min="-180" max="180" step="1" value="{~D:Record.Rotation~}" oninput="_Pict.views['{~D:AppData.Moodboard.ViewID~}'].setRotation('{~D:Record.Hash~}', this.value)">
	<label class="mbp-label">Connection points</label>
	<select class="mbp-input" onchange="_Pict.views['{~D:AppData.Moodboard.ViewID~}'].setConnectMode('{~D:Record.Hash~}', this.value)">
		<option value="off" {~D:Record.Data.ConnectOffSel~}>Off</option>
		<option value="edit" {~D:Record.Data.ConnectEditSel~}>While editing</option>
		<option value="always" {~D:Record.Data.ConnectAlwaysSel~}>Always (show to viewers)</option>
	</select>
	<div class="mbp-hint">A drawing stays linked to the gallery item you picked. "Update from source" re-pulls the latest.</div>
</div>`
							}
						]
					}
				}
			},
			pOptions),
			pServiceHash);
	}
}

module.exports = MoodDrawingCard;
