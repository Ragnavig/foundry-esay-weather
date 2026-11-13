import { SETTINGS, clamp, logError, setting } from "./const.mjs";
import { WEATHER_TYPES } from "./weather-data.mjs";
import { sceneWeatherView } from "./scene-kind.mjs";

/**
 * The clouds themselves, drawn on the canvas rather than over it.
 *
 * Two layers share one layout of puffs, so a cloud and the shadow it throws are the same cloud:
 * - the **deck** is the cloud bodies seen from above, which is what a region map shows,
 * - the **shadow** is what that cover throws onto the ground, offset from the deck by the sun.
 *
 * Which of the two you see, and how much, comes from {@link sceneWeatherView}: the kind of place the scene is and
 * how far above the cloud deck the camera has climbed. Both sprites live inside Foundry's own weather layer, so
 * they carry the canvas transform and its masks and stay over the same ground.
 *
 * The textures are drawn at run time — no image ships with the module — and every puff is painted nine times,
 * wrapped around the edges, so the tiles repeat without a seam.
 */

/* -------------------------------------------- */

/** Edge length of the generated textures, in pixels. */
const TEXTURE_SIZE = 512;

/** How many texture tiles span the scene's shorter side. */
const TILES_ACROSS = 2.4;

/** How far the sun throws the shadow off the cloud, as a fraction of a tile. */
const SUN_OFFSET = 0.11;

/** Generated textures, kept per density so a change of dial does not redraw on every frame. */
const textureCache = new Map();

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
 * Draw the cloud bodies and their shadows from one layout of puffs.
 *
 * A cloud is a cluster of overlapping puffs, wider than it is tall, rather than one circle — a single blob reads
 * as a cotton ball, a cluster reads as a cloud. Density decides how many clusters there are and how large, which
 * is what leaves gaps of open sky between them.
 *
 * @param {number} density  How much sky the clouds take up, from 0 to 1.
 * @returns {{deck: PIXI.Texture, shadow: PIXI.Texture}|null}
 */
function cloudTextures(density) {
  const key = Math.round(clamp(density, 0, 1) * 20) / 20;
  if ( textureCache.has(key) ) return textureCache.get(key);

  try {
    const size = TEXTURE_SIZE;

    // A fixed sequence, so every client draws the same sky.
    let seed = 7;
    const random = () => (seed = ((seed * 1103515245) + 12345) % 2147483648) / 2147483648;

    const clusters = Math.max(2, Math.round(3 + (key * 11)));
    const puffScale = 0.85 + (key * 0.3);
    const blobs = [];
    for ( let cluster = 0; cluster < clusters; cluster++ ) {
      const cx = random() * size;
      const cy = random() * size;
      const spread = size * (0.05 + (random() * 0.05)) * puffScale;
      for ( let puff = 0; puff < 6; puff++ ) {
        blobs.push({
          x: cx + ((random() - 0.5) * spread * 2.6),
          y: cy + ((random() - 0.5) * spread * 1.2),
          radius: size * (0.035 + (random() * 0.055)) * puffScale,
          strength: 0.34 + (random() * 0.2)
        });
      }
    }

    const paint = dark => {
      const element = document.createElement("canvas");
      element.width = element.height = size;
      const ctx = element.getContext("2d");
      // The shadow is multiplied onto the ground, so it starts from white; the deck is laid over it.
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

    const built = { shadow: paint(true), deck: paint(false) };
    textureCache.set(key, built);
    return built;
  } catch(err) {
    logError("Failed to draw the cloud textures", err);
    return null;
  }
}

/* -------------------------------------------- */
/*  The sprites                                 */
/* -------------------------------------------- */

/**
 * The two sprites, created and attached on first use.
 * @param {{deck: PIXI.Texture, shadow: PIXI.Texture}} maps  Textures to draw with.
 * @returns {{deck: PIXI.TilingSprite, shadow: PIXI.TilingSprite}|null}
 */
function ensureSprites(maps) {
  const layer = canvas?.weather;
  const rect = canvas?.dimensions?.sceneRect;
  if ( !layer || !rect || !maps ) return null;

  if ( sprites && !sprites.deck.destroyed && sprites.deck.parent ) {
    // A change of density hands over new textures for the same sprites.
    if ( sprites.deck.texture !== maps.deck ) {
      sprites.deck.texture = maps.deck;
      sprites.shadow.texture = maps.shadow;
    }
    return sprites;
  }

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
export function applyClouds(weather, moment) {
  try {
    const view = sceneWeatherView();
    const cover = WEATHER_TYPES[weather?.type]?.cloud ?? 0;
    const on = !view.indoors && (weather?.enabled !== false) && !weather?.muted?.clouds && (cover > 0);

    if ( !on ) {
      if ( sprites && !sprites.deck.destroyed ) sprites.deck.alpha = sprites.shadow.alpha = 0;
      return;
    }

    const density = clamp(Number(setting(SETTINGS.cloudDensity, 55)) / 100, 0, 1);
    const layers = ensureSprites(cloudTextures(density));
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

    // Even a lightly clouded sky needs a visible shadow: the texture is gentle, and multiplying a faint sprite
    // onto the ground comes out as almost nothing.
    const opacity = clamp(Number(setting(SETTINGS.cloudOpacity, 70)) / 100, 0, 1);
    target.deck = clamp(0.55 + (cover * 0.8), 0, 1) * opacity;
    target.shadow = clamp(0.45 + (cover * 0.65), 0, 1) * opacity;
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
 * Re-weigh both layers against the current view. Cheap enough to run on every pan.
 */
export function updateForView() {
  if ( !sprites || sprites.deck.destroyed ) return;
  const view = sceneWeatherView();
  sprites.deck.alpha = target.deck * view.deck;
  sprites.shadow.alpha = target.shadow * view.shadows;
}

/* -------------------------------------------- */

/**
 * Drop the sprites, for instance when the canvas is torn down. The textures are kept, since they never change.
 */
export function tearDownClouds() {
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
