import { SETTINGS, clamp, logError, setting } from "./const.mjs";
import { WEATHER_TYPES } from "./weather-data.mjs";

/**
 * Clouds drawn on the canvas rather than over it.
 *
 * Two layers share one layout of blobs, so a cloud and the shadow it throws are the same cloud:
 * - the **deck** is the cloud bodies themselves, seen from above. It only makes sense on a map where a grid square
 *   covers real ground, and it fades away as the camera comes down through it.
 * - the **shadow** is what that cover throws onto the ground, offset from the deck by the sun.
 *
 * Both live inside Foundry's own weather layer, which already carries the canvas transform and its masks, so they
 * pan and zoom with the terrain and stay over the same ground.
 *
 * The textures are drawn at run time — no image ships with the module — and every blob is painted nine times,
 * wrapped around the edges, so the tiles repeat without a seam.
 */

/* -------------------------------------------- */

/** Edge length of the generated textures, in pixels. */
const TEXTURE_SIZE = 512;

/** How many texture tiles span the scene's shorter side. Larger clouds on larger maps. */
const TILES_ACROSS = 2.4;

/** A grid square covering more than this many metres makes a map large enough to look down on clouds. */
const LARGE_MAP_METRES = 6;

/** How far the sun throws the shadow off the cloud, as a fraction of a tile. */
const SUN_OFFSET = 0.11;

/** @type {{deck: PIXI.Texture, shadow: PIXI.Texture}|null} */
let textures = null;

/** @type {{deck: PIXI.TilingSprite, shadow: PIXI.TilingSprite}|null} */
let sprites = null;

/** @type {Function|null} */
let ticker = null;

/** What the layers should look like, recalculated whenever the weather or the view changes. */
let target = { drift: { x: 0, y: 0 }, deck: 0, shadow: 0, tile: 1 };

/* -------------------------------------------- */
/*  Textures                                    */
/* -------------------------------------------- */

/**
 * Draw the cloud bodies and their shadows from one layout of blobs. Cached, since they never change.
 * @returns {{deck: PIXI.Texture, shadow: PIXI.Texture}|null}
 */
function cloudTextures() {
  if ( textures ) return textures;
  try {
    const size = TEXTURE_SIZE;

    // A fixed sequence, so every client draws the same sky.
    let seed = 7;
    const random = () => (seed = ((seed * 1103515245) + 12345) % 2147483648) / 2147483648;

    // A cloud is a cluster of overlapping puffs, wider than it is tall, rather than one circle — a single blob
    // reads as a cotton ball, a cluster reads as a cloud.
    const blobs = [];
    for ( let cluster = 0; cluster < 9; cluster++ ) {
      const cx = random() * size;
      const cy = random() * size;
      const spread = size * (0.05 + (random() * 0.05));
      for ( let puff = 0; puff < 6; puff++ ) {
        blobs.push({
          x: cx + ((random() - 0.5) * spread * 2.6),
          y: cy + ((random() - 0.5) * spread * 1.2),
          radius: size * (0.035 + (random() * 0.055)),
          strength: 0.34 + (random() * 0.2)
        });
      }
    }

    const paint = dark => {
      const element = document.createElement("canvas");
      element.width = element.height = size;
      const ctx = element.getContext("2d");
      // The shadow is multiplied onto the ground, so it starts from white; the deck is laid on top of it.
      if ( dark ) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
      }
      const channel = dark ? "0, 0, 0" : "255, 255, 255";
      for ( const blob of blobs ) {
        for ( const dx of [-size, 0, size] ) for ( const dy of [-size, 0, size] ) {
          const gradient = ctx.createRadialGradient(blob.x + dx, blob.y + dy, 0, blob.x + dx, blob.y + dy, blob.radius);
          const peak = dark ? (blob.strength * 0.55) : blob.strength;
          gradient.addColorStop(0, `rgba(${channel}, ${peak})`);
          gradient.addColorStop(0.5, `rgba(${channel}, ${peak * 0.55})`);
          gradient.addColorStop(1, `rgba(${channel}, 0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(blob.x + dx, blob.y + dy, blob.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      return PIXI.Texture.from(element);
    };

    return textures = { shadow: paint(true), deck: paint(false) };
  } catch(err) {
    logError("Failed to draw the cloud textures", err);
    return null;
  }
}

/* -------------------------------------------- */
/*  The map the clouds hang over                */
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
    km: 1000, kilometer: 1000, kilometre: 1000, kilometers: 1000,
    mi: 1609.34, mile: 1609.34, miles: 1609.34, meile: 1609.34, meilen: 1609.34,
    league: 4828, leagues: 4828,
    m: 1, meter: 1, metre: 1, meters: 1, metres: 1,
    ft: 0.3048, foot: 0.3048, feet: 0.3048, fuss: 0.3048, "fuß": 0.3048,
    yd: 0.9144, yard: 0.9144, yards: 0.9144
  };
  // An unlabelled grid is feet in most systems, which is the battlemap case.
  return distance * (factors[units] ?? 0.3048);
}

/**
 * Is this a map you look down on clouds from, rather than stand under them on?
 * @returns {boolean}
 */
export function isLargeScaleMap() {
  return gridMetresOf() > LARGE_MAP_METRES;
}

/* -------------------------------------------- */

/**
 * Is this client drawing its clouds on the canvas at all?
 * @returns {boolean}
 */
export function usesCanvasClouds() {
  return setting(SETTINGS.cloudMode, "auto") !== "off";
}

/**
 * How visible the cloud deck should be at the current zoom.
 *
 * Coming down through a cloud deck should clear the view, which is what the breakthrough zoom is: above it the
 * camera is below the clouds and sees none of them, below it the deck is in full.
 *
 * @returns {number}  A factor between 0 and 1.
 */
export function deckVisibility() {
  const mode = setting(SETTINGS.cloudMode, "auto");
  if ( (mode === "off") || (mode === "shadows") ) return 0;
  if ( mode === "deck" ) return 1;
  if ( !isLargeScaleMap() ) return 0;

  const breakthrough = Math.max(0.1, Number(setting(SETTINGS.cloudBreakthrough, 1.6)) || 1.6);
  const softness = Math.max(0.05, breakthrough * 0.35);
  const zoom = canvas?.stage?.scale?.x ?? 1;
  return clamp((breakthrough + softness - zoom) / (softness * 2), 0, 1);
}

/* -------------------------------------------- */
/*  The sprites                                 */
/* -------------------------------------------- */

/**
 * The two sprites, created and attached on first use.
 * @returns {{deck: PIXI.TilingSprite, shadow: PIXI.TilingSprite}|null}
 */
function ensureSprites() {
  if ( sprites && !sprites.deck.destroyed && sprites.deck.parent ) return sprites;

  const layer = canvas?.weather;
  const rect = canvas?.dimensions?.sceneRect;
  const maps = cloudTextures();
  if ( !layer || !rect || !maps ) return null;

  const make = (texture, blend) => {
    const sprite = new PIXI.TilingSprite(texture, rect.width, rect.height);
    sprite.position.set(rect.x, rect.y);
    sprite.blendMode = blend;
    sprite.alpha = 0;
    layer.addChild(sprite);
    return sprite;
  };

  // The shadow is on the ground, so it goes down first and the deck is drawn over it.
  sprites = {
    shadow: make(maps.shadow, PIXI.BLEND_MODES.MULTIPLY),
    deck: make(maps.deck, PIXI.BLEND_MODES.NORMAL)
  };

  if ( !ticker ) {
    ticker = () => {
      if ( !sprites || sprites.deck.destroyed ) return;
      const seconds = performance.now() / 1000;
      const x = target.drift.x * seconds;
      const y = target.drift.y * seconds;
      const offset = target.tile * SUN_OFFSET;
      sprites.deck.tilePosition.set(x, y);
      sprites.shadow.tilePosition.set(x + offset, y + (offset * 0.7));
    };
    canvas.app.ticker.add(ticker);
  }

  return sprites;
}

/* -------------------------------------------- */

/**
 * Draw the clouds for a weather state, or take them away.
 * @param {object} weather   Weather state to draw.
 * @param {object} [moment]  The current moment, whose day decides which way the wind blows.
 */
export function applyCloudShadows(weather, moment) {
  try {
    const cover = WEATHER_TYPES[weather?.type]?.cloud ?? 0;
    const on = usesCanvasClouds() && (weather?.enabled !== false) && !weather?.muted?.clouds && (cover > 0);

    if ( !on ) {
      if ( sprites && !sprites.deck.destroyed ) sprites.deck.alpha = sprites.shadow.alpha = 0;
      return;
    }

    const layers = ensureSprites();
    if ( !layers ) return;

    const rect = canvas.dimensions.sceneRect;
    const tile = Math.min(rect.width, rect.height) / TILES_ACROSS;
    const scale = tile / TEXTURE_SIZE;

    for ( const sprite of [layers.shadow, layers.deck] ) {
      sprite.position.set(rect.x, rect.y);
      sprite.width = rect.width;
      sprite.height = rect.height;
    }
    layers.shadow.tileScale.set(scale);
    // A touch larger, so the deck sits visibly above the ground it shades rather than on it.
    layers.deck.tileScale.set(scale * 1.06);

    const strength = clamp(Number(setting(SETTINGS.overlayStrength, 70)) / 100, 0, 1);
    const mode = setting(SETTINGS.cloudMode, "auto");

    // Even a lightly clouded sky needs a visible shadow: the texture is gentle, and multiplying a faint sprite
    // onto the ground comes out as almost nothing.
    target.shadow = (mode === "deck") ? 0 : clamp((0.45 + (cover * 0.65)) * strength, 0, 1);
    target.deck = clamp(0.55 + (cover * 0.8), 0, 1) * strength;
    target.tile = tile;

    // One direction for the whole table, changing from day to day, and faster the stronger the wind.
    const day = moment?.components?.dayIndex ?? 0;
    const angle = ((day * 47) % 360) * (Math.PI / 180);
    const speed = 3 + ((weather?.wind ?? 0) * 3.5);
    target.drift = { x: -Math.cos(angle) * speed, y: -Math.sin(angle) * speed };

    updateForView();
  } catch(err) {
    logError("Failed to draw the clouds", err);
  }
}

/* -------------------------------------------- */

/**
 * Re-weigh the deck against the current zoom. Cheap enough to run on every pan.
 */
export function updateForView() {
  if ( !sprites || sprites.deck.destroyed ) return;
  const visible = deckVisibility();
  sprites.deck.alpha = target.deck * visible;
  // Under a closed deck the ground is evenly shaded, so the patchy shadow eases off as the deck comes in.
  sprites.shadow.alpha = target.shadow * (1 - (visible * 0.55));
}

/* -------------------------------------------- */

/**
 * Drop the sprites, for instance when the canvas is torn down. The textures are kept, since they never change.
 */
export function tearDownCloudShadows() {
  if ( ticker && canvas?.app?.ticker ) canvas.app.ticker.remove(ticker);
  ticker = null;
  for ( const sprite of Object.values(sprites ?? {}) ) {
    if ( sprite && !sprite.destroyed ) {
      sprite.parent?.removeChild(sprite);
      sprite.destroy();
    }
  }
  sprites = null;
}
