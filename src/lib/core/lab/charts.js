// Native Excel charts (DrawingML) for the lab-analysis workbook. Pure string builders, no DOM, no dependencies.
// A chart spec: { type:'scatter'|'line'|'bar'|'bubble', title, x:{title,min,max,reverse,fmt}, y:{...}, legend:true|false, scale,
//   series:[{ name, x:'Sheet!$A$1:$A$9', y:'...', size:'...', cat:'...', color:'RRGGBB', line:true, marker:true, dash:'dash', size:5 }],
//   at:[col1,row1,col2,row2] }  (zero-based cell anchors)
import { xml } from '../xlsx-lite.js';

export const PAL = ['2E75B6', 'C00000', '70AD47', 'FFC000', '7030A0', 'ED7D31', '00B0F0', '7F7F7F', '264478', 'A5A5A5', '9E480E', '43682B'];
const NS = 'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const rich = (t, sz, b) => `<c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}" b="${b}"/></a:pPr><a:r><a:rPr lang="en-US" sz="${sz}" b="${b}"/><a:t>${xml(t)}</a:t></a:r></a:p></c:rich></c:tx>`;
const title = (t, sz = 900, b = 0) => (t ? `<c:title>${rich(t, sz, b)}<c:overlay val="0"/></c:title>` : '');
const numRef = f => `<c:numRef><c:f>${xml(f)}</c:f></c:numRef>`;
const strRef = f => `<c:strRef><c:f>${xml(f)}</c:f></c:strRef>`;
const solid = c => `<a:solidFill><a:srgbClr val="${c}"/></a:solidFill>`;

function ser(s, i, type) {
  const color = s.color || PAL[i % PAL.length];
  const tx = s.name != null ? `<c:tx><c:v>${xml(s.name)}</c:v></c:tx>` : '';
  const ln = s.line ? `<a:ln w="${s.w || 19050}" cap="rnd">${solid(color)}${s.dash ? `<a:prstDash val="${s.dash}"/>` : ''}<a:round/></a:ln>` : '<a:ln w="19050"><a:noFill/></a:ln>';
  const showMarker = s.marker !== undefined ? s.marker : !s.line;
  const marker = showMarker ? `<c:marker><c:symbol val="${s.symbol || 'circle'}"/><c:size val="${s.msize || 5}"/><c:spPr>${solid(color)}<a:ln w="6350">${solid('FFFFFF')}</a:ln></c:spPr></c:marker>` : '<c:marker><c:symbol val="none"/></c:marker>';
  const head = `<c:idx val="${i}"/><c:order val="${i}"/>${tx}`;
  if (type === 'bar') return `<c:ser>${head}<c:spPr>${solid(color)}</c:spPr><c:invertIfNegative val="0"/><c:cat>${strRef(s.cat)}</c:cat><c:val>${numRef(s.y)}</c:val></c:ser>`;
  if (type === 'line') return `<c:ser>${head}<c:spPr>${ln}</c:spPr>${marker}<c:cat>${strRef(s.cat)}</c:cat><c:val>${numRef(s.y)}</c:val><c:smooth val="0"/></c:ser>`;
  if (type === 'bubble') return `<c:ser>${head}<c:spPr><a:solidFill><a:srgbClr val="${color}"><a:alpha val="65000"/></a:srgbClr></a:solidFill><a:ln w="9525">${solid('FFFFFF')}</a:ln></c:spPr><c:invertIfNegative val="0"/><c:xVal>${numRef(s.x)}</c:xVal><c:yVal>${numRef(s.y)}</c:yVal><c:bubbleSize>${numRef(s.size)}</c:bubbleSize><c:bubble3D val="0"/></c:ser>`;
  return `<c:ser>${head}<c:spPr>${ln}</c:spPr>${marker}<c:xVal>${numRef(s.x)}</c:xVal><c:yVal>${numRef(s.y)}</c:yVal><c:smooth val="0"/></c:ser>`;
}
const grid = '<c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="E2E8F0"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>';
function valAx(id, cross, pos, o = {}, between = 'midCat') {
  return `<c:valAx><c:axId val="${id}"/><c:scaling><c:orientation val="${o.reverse ? 'maxMin' : 'minMax'}"/>${o.max != null ? `<c:max val="${o.max}"/>` : ''}${o.min != null ? `<c:min val="${o.min}"/>` : ''}</c:scaling><c:delete val="0"/><c:axPos val="${pos}"/>${o.nogrid ? '' : grid}${title(o.title)}<c:numFmt formatCode="${xml(o.fmt || 'General')}" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="${o.lblPos || 'nextTo'}"/><c:crossAx val="${cross}"/><c:crosses val="autoZero"/><c:crossBetween val="${between}"/></c:valAx>`;
}
const catAx = (id, cross, o = {}) => `<c:catAx><c:axId val="${id}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>${title(o.title)}<c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/><c:txPr><a:bodyPr rot="-2700000"/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="800"/></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr><c:crossAx val="${cross}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`;

export function chartXml(sp) {
  const t = sp.type, S = sp.series.map((s, i) => ser(s, i, t)).join('');
  let plot;
  if (t === 'line') plot = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${S}<c:marker val="1"/><c:axId val="111"/><c:axId val="222"/></c:lineChart>${catAx(111, 222, sp.x)}${valAx(222, 111, 'l', sp.y, 'between')}`;
  else if (t === 'bar') plot = `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${S}<c:gapWidth val="80"/><c:axId val="111"/><c:axId val="222"/></c:barChart>${catAx(111, 222, sp.x)}${valAx(222, 111, 'l', sp.y, 'between')}`;
  else if (t === 'bubble') plot = `<c:bubbleChart><c:varyColors val="0"/>${S}<c:bubbleScale val="${sp.scale || 40}"/><c:showNegBubbles val="0"/><c:axId val="111"/><c:axId val="222"/></c:bubbleChart>${valAx(111, 222, 'b', sp.x)}${valAx(222, 111, 'l', sp.y)}`;
  else plot = `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${S}<c:axId val="111"/><c:axId val="222"/></c:scatterChart>${valAx(111, 222, 'b', sp.x)}${valAx(222, 111, 'l', sp.y)}`;
  const legend = sp.legend === false ? '' : '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace ${NS}><c:roundedCorners val="0"/><c:chart>${title(sp.title, 1100, 1)}<c:autoTitleDeleted val="${sp.title ? 0 : 1}"/><c:plotArea><c:layout/>${plot}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr>${solid('FFFFFF')}<a:ln w="9525">${solid('CBD5E1')}</a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900"/></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr></c:chartSpace>`;
}

export function drawingXml(charts) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">${charts.map((ch, i) => {
    const [c1, r1, c2, r2] = ch.at;
    return `<xdr:twoCellAnchor><xdr:from><xdr:col>${c1}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${c2}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r2}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Chart ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
  }).join('')}</xdr:wsDr>`;
}
