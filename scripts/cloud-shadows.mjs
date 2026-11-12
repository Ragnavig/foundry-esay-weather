import { SETTINGS, clamp, logError, setting } from "./const.mjs";
import { WEATHER_TYPES } from "./weather-data.mjs";

/**
 * Cloud shadows drawn on the canvas rather than over it.
 *
 * A tiling sprite of soft dark blobs is multiplied onto the scene inside Foundry's own weather layer. That layer
 * already carries the canvas transform and its masks, so the shadows pan and zoom with the ground, a shadow stays
 * over the same hill, and whatever the weather layer hides them behind hides them too.
 *
 * The texture is drawn once at run time — no image ships with the module — and every blob is painted nine times,
 * wrapped around the edges, so the tile repeats without a seam.
 */

/* -------------------------------------------- */

/** Edge length of the generated texture, in pixels. */
const TEXTURE_SIZE = 512;

/** Roughly the diameter of one blob in that texture, used to size a shadow in world units. */
const BLOB_SIZE = 160;

/** How many grid squares across one cloud shadow should be. */
const SHADOW_GRIDS = 8;

/** @type {PIXI.Texture|null} */
let texture = null;

/** @type {PIXI.TilingSprite|null} */
let sprite = null;

/** @type {Function|null} */
let ticker = null;

/** How the shadows are drifting at the moment. */
let drift = { x: 0, y: 0 };

/* -------------------------------------------- */

/**
 * Draw the cloud texture. Cached, because it never changes.
 * @returns {PIXI.Texture|null}
 */
function cloudTexture() {
  if ( texture ) return texture;
  try {
    const size = TEXTURE_SIZE;
    const element = document.createElement("canvas");
    element.width = element.height = size;
    const ctx = element.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    // A fixed sequence, so every client draws the same sky.
    let seed = 1;
    const random = () => (seed = ((seed * 1103515245) + 12345) % 2147483648) / 2147483648;

    for ( let i = 0; i < 26; i++ ) {
      const x = random() * size;
      const y = random() * size;
      const radius = (BLOB_SIZE * 0.38) + (random() * BLOB_SIZE * 0.95);
      const strength = 0.1 + (random() * 0.16);
      for ( const dx of [-size, 0, size] ) for ( const dy of [-size, 0, size] ) {
        const gradient = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, radius);
        gradient.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    return texture = PIXI.Texture.from(element);
  } catch(err) {
    logError("Failed to draw the cloud texture", err);
    return null;
  }
}

/* -------------------------------------------- */

/**
 * Is this client drawing its cloud shadows on the canvas?
 * @returns {boolean}
 */
export function usesCanvasClouds() {
  return setting(SETTINGS.cloudRenderer, "canvas") === "canvas";
}

/* -------------------------------------------- */

/**
 * The sprite, created and attached on first use.
 * @returns {PIXI.TilingSprite|null}
 */
function ensureSprite() {
  if ( sprite && !sprite.destroyed && sprite.parent ) return sprite;
  const layer = canvas?.weather;
  const rect = canvas?.dimensions?.sceneRect;
  const map = cloudTexture();
  if ( !layer || !rect || !map ) return null;

  sprite = new PIXI.TilingSprite(map, rect.width, rect.height);
  sprite.position.set(rect.x, rect.y);
  sprite.blendMode = PIXI.BLEND_MODES.MULTIPLY;
  sprite.alpha = 0;
  layer.addChild(sprite);

  if ( !ticker ) {
    ticker = () => {
      if ( !sprite || sprite.destroyed ) return;
      const seconds = performance.now() / 1000;
      sprite.tilePosition.x = drift.x * seconds;
      sprite.tilePosition.y = drift.y * seconds;
    };
    canvas.app.ticker.add(ticker);
  }

  return sprite;
}

/* -------------------------------------------- */

/**
 * Draw the cloud shadows for a weather state, or take them away.
 * @param {object} weather   Weather state to draw.
 * @param {object} [moment]  The current moment, whose day decides which way the wind blows.
 */
export function applyCloudShadows(weather, moment) {
  try {
    const type = WEATHER_TYPES[weather?.type];
    const cover = type?.cloud ?? 0;
    // The shadows have a switch of their own. They are on the map rather than over the screen, so the overlay's
    // switch has nothing to say about them.
    const on = usesCanvasClouds() && (weather?.enabled !== false) && !weather?.muted?.clouds && (cover > 0);

    if ( !on ) {
      if ( sprite && !sprite.destroyed ) sprite.alpha = 0;
      return;
    }

    const shadows = ensureSprite();
    if ( !shadows ) return;

    // Keep the sprite on the scene even if it changed size underneath us.
    const rect = canvas.dimensions.sceneRect;
    shadows.position.set(rect.x, rect.y);
    shadows.width = rect.width;
    shadows.height = rect.height;

    const grid = canvas.grid?.size || 100;
    shadows.tileScale.set((grid * SHADOW_GRIDS) / BLOB_SIZE);

    // Even a lightly clouded sky needs a visible shadow: the texture itself is gentle, and multiplying a faint
    // sprite onto the ground comes out as almost nothing. Cover decides how much darker it gets from there.
    const strength = clamp(Number(setting(SETTINGS.overlayStrength, 70)) / 100, 0, 1);
    shadows.alpha = clamp((0.45 + (cover * 0.65)) * strength, 0, 1);

    // One direction for the whole table, changing from day to day, and faster the stronger the wind.
    const day = moment?.components?.dayIndex ?? 0;
    const angle = ((day * 47) % 360) * (Math.PI / 180);
    const speed = 3 + ((weather?.wind ?? 0) * 3.5);
    drift = { x: -Math.cos(angle) * speed, y: -Math.sin(angle) * speed };
  } catch(err) {
    logError("Failed to draw the cloud shadows", err);
  }
}

/* -------------------------------------------- */

/**
 * Drop the sprite, for instance when the canvas is torn down. The texture is kept, since it never changes.
 */
export function tearDownCloudShadows() {
  if ( ticker && canvas?.app?.ticker ) canvas.app.ticker.remove(ticker);
  ticker = null;
  if ( sprite && !sprite.destroyed ) {
    sprite.parent?.removeChild(sprite);
    sprite.destroy();
  }
  sprite = null;
}
