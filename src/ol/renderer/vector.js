/**
 * @module ol/renderer/vector
 */
import {getUid} from '../index.js';
import ImageState from '../ImageState.js';
import GeometryType from '../geom/GeometryType.js';
import ReplayType from '../render/ReplayType.js';


/**
 * Tolerance for geometry simplification in device pixels.
 * @type {number}
 */
const SIMPLIFY_TOLERANCE = 0.5;


/**
 * @const
 * @type {Object.<ol.geom.GeometryType,
 *                function(ol.render.ReplayGroup, ol.geom.Geometry,
 *                         ol.style.Style, Object)>}
 */
const GEOMETRY_RENDERERS = {
  'Point': renderPointGeometry,
  'LineString': renderLineStringGeometry,
  'Polygon': renderPolygonGeometry,
  'MultiPoint': renderMultiPointGeometry,
  'MultiLineString': renderMultiLineStringGeometry,
  'MultiPolygon': renderMultiPolygonGeometry,
  'GeometryCollection': renderGeometryCollectionGeometry,
  'Circle': renderCircleGeometry
};


/**
 * @param {ol.Feature|ol.render.Feature} feature1 Feature 1.
 * @param {ol.Feature|ol.render.Feature} feature2 Feature 2.
 * @return {number} Order.
 */
export function defaultOrder(feature1, feature2) {
  return getUid(feature1) - getUid(feature2);
}


/**
 * @param {number} resolution Resolution.
 * @param {number} pixelRatio Pixel ratio.
 * @return {number} Squared pixel tolerance.
 */
export function getSquaredTolerance(resolution, pixelRatio) {
  const tolerance = getTolerance(resolution, pixelRatio);
  return tolerance * tolerance;
}


/**
 * @param {number} resolution Resolution.
 * @param {number} pixelRatio Pixel ratio.
 * @return {number} Pixel tolerance.
 */
export function getTolerance(resolution, pixelRatio) {
  return SIMPLIFY_TOLERANCE * resolution / pixelRatio;
}


/**
 * @param {ol.render.ReplayGroup} replayGroup Replay group.
 * @param {ol.geom.Circle} geometry Geometry.
 * @param {ol.style.Style} style Style.
 * @param {ol.Feature} feature Feature.
 */
function renderCircleGeometry(replayGroup, geometry, style, feature) {
  const fillStyle = style.getFill();
  const strokeStyle = style.getStroke();
  if (fillStyle || strokeStyle) {
    const circleReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.CIRCLE);
    circleReplay.setFillStrokeStyle(fillStyle, strokeStyle);
    circleReplay.drawCircle(geometry, feature);
  }
  const textStyle = style.getText();
  if (textStyle) {
    const textReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.TEXT);
    textReplay.setTextStyle(textStyle, replayGroup.addDeclutter(false));
    textReplay.drawText(geometry, feature);
  }
}


/**
 * @param {ol.render.ReplayGroup} replayGroup Replay group.
 * @param {ol.Feature|ol.render.Feature} feature Feature.
 * @param {ol.style.Style} style Style.
 * @param {number} squaredTolerance Squared tolerance.
 * @param {function(this: T, ol.events.Event)} listener Listener function.
 * @param {T} thisArg Value to use as `this` when executing `listener`.
 * @return {boolean} `true` if style is loading.
 * @template T
 */
export function renderFeature(replayGroup, feature, style, squaredTolerance, listener, thisArg) {
  let loading = false;
  const imageStyle = style.getImage();
  if (imageStyle) {
    let imageState = imageStyle.getImageState();
    if (imageState == ImageState.LOADED || imageState == ImageState.ERROR) {
      imageStyle.unlistenImageChange(listener, thisArg);
    } else {
      if (imageState == ImageState.IDLE) {
        imageStyle.load();
      }
      imageState = imageStyle.getImageState();
      imageStyle.listenImageChange(listener, thisArg);
      loading = true;
    }
  }
  renderFeatureInternal(replayGroup, feature, style, squaredTolerance);

  return loading;
}


/**
 * @param {ol.render.ReplayGroup} replayGroup Replay group.
 * @param {ol.Feature|ol.render.Feature} feature Feature.
 * @param {ol.style.Style} style Style.
 * @param {number} squaredTolerance Squared tolerance.
 */
function renderFeatureInternal(replayGroup, feature, style, squaredTolerance) {
  const geometry = style.getGeometryFunction()(feature);
  if (!geometry) {
    return;
  }
  const simplifiedGeometry = geometry.getSimplifiedGeometry(squaredTolerance);
  const renderer = style.getRenderer();
  if (renderer) {
    renderGeometry(replayGroup, simplifiedGeometry, style, feature);
  } else {
    const geometryRenderer = GEOMETRY_RENDERERS[simplifiedGeometry.getType()];
    geometryRenderer(replayGroup, simplifiedGeometry, style, feature);
  }
}


/**
 * @param {ol.render.ReplayGroup} replayGroup Replay group.
 * @param {ol.geom.Geometry} geometry Geometry.
 * @param {ol.style.Style} style Style.
 * @param {ol.Feature|ol.render.Feature} feature Feature.
 */
function renderGeometry(replayGroup, geometry, style, feature) {
  if (geometry.getType() == GeometryType.GEOMETRY_COLLECTION) {
    const geometries = /** @type {ol.geom.GeometryCollection} */ (geometry).getGeometries();
    for (let i = 0, ii = geometries.length; i < ii; ++i) {
      renderGeometry(replayGroup, geometries[i], style, feature);
    }
    return;
  }
  const replay = replayGroup.getReplay(style.getZIndex(), ReplayType.DEFAULT);
  replay.drawCustom(/** @type {ol.geom.SimpleGeometry} */ (geometry), feature, style.getRenderer());
}


/**
 * @param {ol.render.ReplayGroup} replayGroup Replay group.
 * @param {ol.geom.GeometryCollection} geometry Geometry.
 * @param {ol.style.Style} style Style.
 * @param {ol.Feature} feature Feature.
 */
function renderGeometryCollectionGeometry(replayGroup, geometry, style, feature) {
  const geometries = geometry.getGeometriesArray();
  let i, ii;
  for (i = 0, ii = geometries.length; i < ii; ++i) {
    const geometryRenderer =
        GEOMETRY_RENDERERS[geometries[i].getType()];
    geometryRenderer(replayGroup, geometries[i], style, feature);
  }
}


/**
 * @param {ol.render.ReplayGroup} replayGroup Replay group.
 * @param {ol.geom.LineString|ol.render.Feature} geometry Geometry.
 * @param {ol.style.Style} style Style.
 * @param {ol.Feature|ol.render.Feature} feature Feature.
 */
function renderLineStringGeometry(replayGroup, geometry, style, feature) {
  const strokeStyle = style.getStroke();
  if (strokeStyle) {
    const lineStringReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.LINE_STRING);
    lineStringReplay.setFillStrokeStyle(null, strokeStyle);
    lineStringReplay.drawLineString(geometry, feature);
  }
  const textStyle = style.getText();
  if (textStyle) {
    const textReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.TEXT);
    textReplay.setTextStyle(textStyle, replayGroup.addDeclutter(false));
    textReplay.drawText(geometry, feature);
  }
}


/**
 * @param {ol.render.ReplayGroup} replayGroup Replay group.
 * @param {ol.geom.MultiLineString|ol.render.Feature} geometry Geometry.
 * @param {ol.style.Style} style Style.
 * @param {ol.Feature|ol.render.Feature} feature Feature.
 */
function renderMultiLineStringGeometry(replayGroup, geometry, style, feature) {
  const strokeStyle = style.getStroke();
  if (strokeStyle) {
    const lineStringReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.LINE_STRING);
    lineStringReplay.setFillStrokeStyle(null, strokeStyle);
    lineStringReplay.drawMultiLineString(geometry, feature);
  }
  const textStyle = style.getText();
  if (textStyle) {
    const textReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.TEXT);
    textReplay.setTextStyle(textStyle, replayGroup.addDeclutter(false));
    textReplay.drawText(geometry, feature);
  }
}


/**
 * @param {ol.render.ReplayGroup} replayGroup Replay group.
 * @param {ol.geom.MultiPolygon} geometry Geometry.
 * @param {ol.style.Style} style Style.
 * @param {ol.Feature} feature Feature.
 */
function renderMultiPolygonGeometry(replayGroup, geometry, style, feature) {
  const fillStyle = style.getFill();
  const strokeStyle = style.getStroke();
  if (strokeStyle || fillStyle) {
    const polygonReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.POLYGON);
    polygonReplay.setFillStrokeStyle(fillStyle, strokeStyle);
    polygonReplay.drawMultiPolygon(geometry, feature);
  }
  const textStyle = style.getText();
  if (textStyle) {
    const textReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.TEXT);
    textReplay.setTextStyle(textStyle, replayGroup.addDeclutter(false));
    textReplay.drawText(geometry, feature);
  }
}


/**
 * @param {ol.render.ReplayGroup} replayGroup Replay group.
 * @param {ol.geom.Point|ol.render.Feature} geometry Geometry.
 * @param {ol.style.Style} style Style.
 * @param {ol.Feature|ol.render.Feature} feature Feature.
 */
function renderPointGeometry(replayGroup, geometry, style, feature) {
  const imageStyle = style.getImage();
  if (imageStyle) {
    if (imageStyle.getImageState() != ImageState.LOADED) {
      return;
    }
    const imageReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.IMAGE);
    imageReplay.setImageStyle(imageStyle, replayGroup.addDeclutter(false));
    imageReplay.drawPoint(geometry, feature);
  }
  const textStyle = style.getText();
  if (textStyle) {
    const textReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.TEXT);
    textReplay.setTextStyle(textStyle, replayGroup.addDeclutter(!!imageStyle));
    textReplay.drawText(geometry, feature);
  }
}


/**
 * @param {ol.render.ReplayGroup} replayGroup Replay group.
 * @param {ol.geom.MultiPoint|ol.render.Feature} geometry Geometry.
 * @param {ol.style.Style} style Style.
 * @param {ol.Feature|ol.render.Feature} feature Feature.
 */
function renderMultiPointGeometry(replayGroup, geometry, style, feature) {
  const imageStyle = style.getImage();
  if (imageStyle) {
    if (imageStyle.getImageState() != ImageState.LOADED) {
      return;
    }
    const imageReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.IMAGE);
    imageReplay.setImageStyle(imageStyle, replayGroup.addDeclutter(false));
    imageReplay.drawMultiPoint(geometry, feature);
  }
  const textStyle = style.getText();
  if (textStyle) {
    const textReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.TEXT);
    textReplay.setTextStyle(textStyle, replayGroup.addDeclutter(!!imageStyle));
    textReplay.drawText(geometry, feature);
  }
}


/**
 * @param {ol.render.ReplayGroup} replayGroup Replay group.
 * @param {ol.geom.Polygon|ol.render.Feature} geometry Geometry.
 * @param {ol.style.Style} style Style.
 * @param {ol.Feature|ol.render.Feature} feature Feature.
 */
function renderPolygonGeometry(replayGroup, geometry, style, feature) {
  const fillStyle = style.getFill();
  const strokeStyle = style.getStroke();
  if (fillStyle || strokeStyle) {
    const polygonReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.POLYGON);
    polygonReplay.setFillStrokeStyle(fillStyle, strokeStyle);
    polygonReplay.drawPolygon(geometry, feature);
  }
  const textStyle = style.getText();
  if (textStyle) {
    const textReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.TEXT);
    textReplay.setTextStyle(textStyle, replayGroup.addDeclutter(false));
    textReplay.drawText(geometry, feature);
  }
}
