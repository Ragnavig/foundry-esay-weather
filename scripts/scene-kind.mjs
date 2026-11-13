import { MODULE_ID, SETTINGS, clamp, logError, setting } from "./const.mjs";

/**
 * What kind of place a scene is, and what that means for the weather.
 *
 * Weather looks different depending on where the viewer stands, and that is a property of the map rather than
 * something to be switched on and off by hand:
 *
 * - **Dungeon** — underground. There is no sky, so there is no weather to show.
 * - **Battlemap** — between the ground and the sky. The cover throws shadows on the floor and the rain comes down
 *   at you.
 * - **Region map** — above the cloud deck. You look down on the clouds, and what falls out of them is hidden
 *   underneath.
 *
 * A scene's kind is worked out from what one grid square covers and can be overridden per scene. Everything the
 * renderers need then follows from one number: how far above the cloud deck the camera is.
 */

/* -------------------------------------------- */

/** The kinds a scene can be set to. `auto` means "work it out". */
export const SCENE_KINDS = ["auto", "dungeon", "battlemap", "region"];

/** The flag a scene's kind is stored under. */
const KIND_FLAG = "sceneKind";

/** A grid square covering more than this many metres makes a map you look down on. */
const LARGE_MAP_METRES = 6;

/* -------------------------------------------- */

/**
 * How many metres one grid square of a scene covers.
 * @param {Scene} [scene]  Scene to measure; defaults to the one on the canvas.
 * @returns {number}
 */
export function gridMetresOf(scene=canvas?.scene) {
  const grid = scene?.grid;
  if ( !grid ) return 1.5;
  const distance = Number(grid.distance) || 5;
  const units = String(grid.units ?? "").toLowerCase().trim();
  const factors = {
    km: 1000, kilometer: 1000, kilometre: 1000, kilometers: 1000, kilometres: 1000,
    mi: 1609.34, mile: 1609.34, miles: 1609.34, meile: 1609.34, meilen: 1609.34,
    league: 4828, leagues: 4828, hex: 1000,
    m: 1, meter: 1, metre: 1, meters: 1, metres: 1,
    ft: 0.3048, foot: 0.3048, feet: 0.3048, fuss: 0.3048, "fuß": 0.3048,
    yd: 0.9144, yard: 0.9144, yards: 0.9144
  };
  // An unlabelled grid is feet in most systems, which is the battlemap case.
  return distance * (factors[units] ?? 0.3048);
}

/* -------------------------------------------- */

/**
 * The kind a scene is when nobody has said otherwise.
 * @param {Scene} [scene]  Scene to judge.
 * @returns {"battlemap"|"region"}
 */
export function detectedKind(scene=canvas?.scene) {
  return (gridMetresOf(scene) > LARGE_MAP_METRES) ? "region" : "battlemap";
}

/**
 * What a scene is set to, which may be `auto`.
 * @param {Scene} [scene]  Scene to read.
 * @returns {string}
 */
export function storedKind(scene=canvas?.scene) {
  const stored = scene?.getFlag?.(MODULE_ID, KIND_FLAG);
  return SCENE_KINDS.includes(stored) ? stored : "auto";
}

/**
 * The kind a scene actually is.
 * @param {Scene} [scene]  Scene to read.
 * @returns {"dungeon"|"battlemap"|"region"}
 */
export function sceneKind(scene=canvas?.scene) {
  const stored = storedKind(scene);
  return (stored === "auto") ? detectedKind(scene) : stored;
}

/**
 * Set the kind of a scene. GM only.
 * @param {string} kind      One of {@link SCENE_KINDS}.
 * @param {Scene} [scene]    Scene to change.
 * @returns {Promise<void>}
 */
export async function setSceneKind(kind, scene=canvas?.scene) {
  if ( !game.user.isGM || !scene || !SCENE_KINDS.includes(kind) ) return;
  try {
    await scene.setFlag(MODULE_ID, KIND_FLAG, kind);
  } catch(err) {
    logError("Failed to store the kind of this scene", err);
  }
}

/* -------------------------------------------- */

/**
 * How far above the cloud deck the camera is: 1 looking down on closed cover, 0 standing under it.
 *
 * On a region map this falls as the camera zooms in, so coming down through the deck turns the picture into the
 * battlemap one without a jump.
 *
 * @param {Scene} [scene]  Scene to judge.
 * @returns {number}       A factor between 0 and 1.
 */
export function viewAbove(scene=canvas?.scene) {
  if ( sceneKind(scene) !== "region" ) return 0;
  const breakthrough = Math.max(0.1, Number(setting(SETTINGS.cloudBreakthrough, 1.6)) || 1.6);
  const softness = Math.max(0.05, breakthrough * 0.35);
  const zoom = canvas?.stage?.scale?.x ?? 1;
  return clamp((breakthrough + softness - zoom) / (softness * 2), 0, 1);
}

/* -------------------------------------------- */

/**
 * Everything the renderers need to know about the scene in front of them.
 * @param {Scene} [scene]  Scene to describe.
 * @returns {object}
 */
export function sceneWeatherView(scene=canvas?.scene) {
  const kind = sceneKind(scene);
  const indoors = kind === "dungeon";
  const above = indoors ? 0 : viewAbove(scene);

  return {
    kind,
    detected: detectedKind(scene),
    stored: storedKind(scene),
    indoors,
    above,
    /** The cloud bodies, seen from above. */
    deck: indoors ? 0 : above,
    /** The shadow that cover throws on the ground. Under a closed deck the ground is evenly shaded instead. */
    shadows: indoors ? 0 : (1 - (above * 0.55)),
    /** Rain and snow are only visible from under the clouds. */
    particles: indoors ? 0 : (1 - clamp(above * 2, 0, 1)),
    /** A wash of colour over the view, which matters less the further above the weather you are. */
    overlay: indoors ? 0 : (1 - (above * 0.6)),
    lightning: indoors ? 0 : 1,
    /** Daylight has nothing to say about a room with no sky. */
    darkness: !indoors
  };
}
