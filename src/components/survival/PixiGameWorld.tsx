'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Application, Container, Graphics, Text, TextStyle, BlurFilter } from 'pixi.js';
import { useSurvivalStore } from '@/store/survival';

// Seeded random for consistent positions
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Color palettes with richer gradients
const COLORS = {
  sky: {
    dawn: {
      top: 0x0a0020,
      mid: 0x4a1040,
      bottom: 0xff7b4a,
      sun: 0xff6b35,
      ambient: 0xffaa77,
      clouds: 0xff9080,
    },
    day: {
      top: 0x0a1e3d,
      mid: 0x2d6ba8,
      bottom: 0x7dc4e8,
      sun: 0xfffacd,
      ambient: 0xffffff,
      clouds: 0xffffff,
    },
    dusk: {
      top: 0x1a0830,
      mid: 0x8b2050,
      bottom: 0xff5040,
      sun: 0xff4500,
      ambient: 0xff8866,
      clouds: 0xff7060,
    },
    night: {
      top: 0x000008,
      mid: 0x050818,
      bottom: 0x101830,
      moon: 0xeef4ff,
      ambient: 0x3355aa,
      clouds: 0x2a2a4a,
    },
  },
  forest: {
    back: { base: 0x0a180a, highlight: 0x152515 },
    mid: { base: 0x142a14, highlight: 0x1e3d1e },
    front: { base: 0x1e3d1e, highlight: 0x2a5a2a },
  },
  ground: {
    grass: 0x1a4a1a,
    dirt: 0x3d2a15,
    path: 0x5a4025,
    moss: 0x2d5a2d,
  },
};

interface TreeData {
  x: number;
  height: number;
  variant: number;
  sway: number;
}

interface ParticleData {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
}

interface CloudData {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  opacity: number;
}

interface StarData {
  x: number;
  y: number;
  size: number;
  brightness: number;
  twinkleSpeed: number;
  color: number;
}

export function PixiGameWorld() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const frameRef = useRef(0);
  const particlesRef = useRef<ParticleData[]>([]);

  const staticDataRef = useRef<{
    backTrees: TreeData[];
    midTrees: TreeData[];
    frontTrees: TreeData[];
    stars: StarData[];
    clouds: CloudData[];
    grassPatches: { x: number; heights: number[]; colors: number[] }[];
    rocks: { x: number; y: number; size: number; variant: number }[];
    initialized: boolean;
  }>({
    backTrees: [],
    midTrees: [],
    frontTrees: [],
    stars: [],
    clouds: [],
    grassPatches: [],
    rocks: [],
    initialized: false,
  });

  const [isLoaded, setIsLoaded] = useState(false);
  const { worldState, playerStats, currentAction } = useSurvivalStore();

  // Initialize static data once
  const initStaticData = useCallback((width: number, height: number) => {
    if (staticDataRef.current.initialized) return;

    const groundY = height * 0.7;
    const data = staticDataRef.current;

    // Back trees - dense forest silhouette
    data.backTrees = [];
    for (let i = 0; i < 30; i++) {
      data.backTrees.push({
        x: (i / 30) * width + seededRandom(i * 7) * 35 - 17,
        height: 45 + seededRandom(i * 13) * 35,
        variant: Math.floor(seededRandom(i * 17) * 4),
        sway: seededRandom(i * 19) * Math.PI * 2,
      });
    }

    // Mid trees
    data.midTrees = [];
    for (let i = 0; i < 20; i++) {
      data.midTrees.push({
        x: (i / 20) * width + seededRandom(i * 11 + 100) * 45 - 22,
        height: 65 + seededRandom(i * 19 + 100) * 45,
        variant: Math.floor(seededRandom(i * 23 + 100) * 4),
        sway: seededRandom(i * 29 + 100) * Math.PI * 2,
      });
    }

    // Front trees - fewer, larger
    data.frontTrees = [];
    for (let i = 0; i < 8; i++) {
      data.frontTrees.push({
        x: (i / 8) * width + seededRandom(i * 29 + 200) * 80 - 40,
        height: 100 + seededRandom(i * 31 + 200) * 60,
        variant: Math.floor(seededRandom(i * 37 + 200) * 4),
        sway: seededRandom(i * 41 + 200) * Math.PI * 2,
      });
    }

    // Stars - varied brightness and colors
    data.stars = [];
    for (let i = 0; i < 120; i++) {
      const brightness = seededRandom(i * 41 + 300);
      data.stars.push({
        x: seededRandom(i * 43 + 300) * width,
        y: seededRandom(i * 47 + 300) * groundY * 0.7,
        size: 0.3 + brightness * 1.8,
        brightness,
        twinkleSpeed: 0.02 + seededRandom(i * 53 + 300) * 0.03,
        color: brightness > 0.8 ? 0xaaddff : brightness > 0.5 ? 0xffffff : 0xffeeaa,
      });
    }

    // Clouds
    data.clouds = [];
    for (let i = 0; i < 6; i++) {
      data.clouds.push({
        x: seededRandom(i * 61 + 400) * width * 1.5 - width * 0.25,
        y: 20 + seededRandom(i * 67 + 400) * 60,
        width: 80 + seededRandom(i * 71 + 400) * 120,
        height: 25 + seededRandom(i * 73 + 400) * 20,
        speed: 0.1 + seededRandom(i * 79 + 400) * 0.15,
        opacity: 0.3 + seededRandom(i * 83 + 400) * 0.3,
      });
    }

    // Grass patches
    data.grassPatches = [];
    for (let i = 0; i < 40; i++) {
      const x = seededRandom(i * 59 + 500) * width;
      // Skip grass on path
      if (x > width * 0.35 && x < width * 0.65) continue;

      const bladeCount = 5 + Math.floor(seededRandom(i * 61 + 500) * 8);
      const heights = [];
      const colors = [];
      for (let j = 0; j < bladeCount; j++) {
        heights.push(6 + seededRandom(i * 63 + j * 7 + 500) * 12);
        colors.push(seededRandom(i * 67 + j * 11 + 500) > 0.7 ? 0x4a8a4a : 0x3d6b3d);
      }
      data.grassPatches.push({ x, heights, colors });
    }

    // Rocks
    data.rocks = [];
    for (let i = 0; i < 12; i++) {
      const x = seededRandom(i * 89 + 600) * width;
      if (x > width * 0.35 && x < width * 0.65) continue;
      data.rocks.push({
        x,
        y: groundY + seededRandom(i * 97 + 600) * 8 - 2,
        size: 5 + seededRandom(i * 101 + 600) * 12,
        variant: Math.floor(seededRandom(i * 103 + 600) * 3),
      });
    }

    data.initialized = true;
  }, []);

  // Initialize PixiJS
  useEffect(() => {
    if (!containerRef.current || appRef.current) return;

    const init = async () => {
      const app = new Application();
      await app.init({
        width: containerRef.current!.clientWidth,
        height: 450,
        backgroundColor: 0x0a0a15,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio, 2),
        autoDensity: true,
      });

      containerRef.current!.appendChild(app.canvas);
      appRef.current = app;

      // Create layer containers with proper ordering
      const layers = [
        'sky', 'stars', 'celestial', 'clouds', 'mountains', 'fog-back',
        'treesBack', 'fog-mid', 'treesMid', 'treesFront', 'ground',
        'rocks', 'grass', 'particles', 'entities', 'weather', 'overlay', 'ui'
      ];

      layers.forEach(name => {
        const container = new Container();
        container.label = name;
        app.stage.addChild(container);
      });

      initStaticData(app.screen.width, app.screen.height);
      setIsLoaded(true);
    };

    init();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [initStaticData]);

  // Smooth sky gradient with atmosphere
  const renderSky = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('sky') as Container;
    layer.removeChildren();

    const time = worldState.timeOfDay;
    const { top, mid, bottom } = COLORS.sky[time];
    const height = app.screen.height * 0.7;
    const width = app.screen.width;

    const sky = new Graphics();

    // Ultra-smooth gradient with 150 steps
    for (let i = 0; i < 150; i++) {
      const t = i / 150;
      let color: number;
      if (t < 0.4) {
        color = lerpColor(top, mid, t / 0.4);
      } else {
        color = lerpColor(mid, bottom, (t - 0.4) / 0.6);
      }
      sky.rect(0, t * height, width, height / 150 + 1);
      sky.fill(color);
    }
    layer.addChild(sky);

    // Atmospheric glow at horizon
    const horizonGlow = new Graphics();
    horizonGlow.rect(0, height * 0.7, width, height * 0.3);
    horizonGlow.fill(bottom);
    horizonGlow.alpha = 0.4;
    layer.addChild(horizonGlow);
  }, [worldState.timeOfDay]);

  // Stars with realistic twinkling
  const renderStars = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('stars') as Container;
    layer.removeChildren();

    if (worldState.timeOfDay !== 'night') return;

    const frame = frameRef.current;

    staticDataRef.current.stars.forEach(star => {
      const twinkle = 0.3 + star.brightness * 0.5 + Math.sin(frame * star.twinkleSpeed + star.x) * 0.2;

      // Star glow
      if (star.brightness > 0.6) {
        const glow = new Graphics();
        glow.circle(star.x, star.y, star.size * 3);
        glow.fill(star.color);
        glow.alpha = twinkle * 0.15;
        layer.addChild(glow);
      }

      // Star core
      const s = new Graphics();
      s.circle(star.x, star.y, star.size);
      s.fill(star.color);
      s.alpha = twinkle;
      layer.addChild(s);
    });

    // Milky way band
    const milkyWay = new Graphics();
    for (let i = 0; i < 200; i++) {
      const x = seededRandom(i * 111 + 700) * app.screen.width;
      const y = 50 + seededRandom(i * 113 + 700) * 120 + Math.sin(x * 0.01) * 30;
      milkyWay.circle(x, y, 0.3 + seededRandom(i * 117 + 700) * 0.5);
      milkyWay.fill(0xaaaacc);
    }
    milkyWay.alpha = 0.15;
    layer.addChild(milkyWay);
  }, [worldState.timeOfDay]);

  // Celestial bodies with glow effects
  const renderCelestial = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('celestial') as Container;
    layer.removeChildren();

    const time = worldState.timeOfDay;
    const width = app.screen.width;
    const height = app.screen.height * 0.7;
    const frame = frameRef.current;

    if (time === 'night') {
      // Moon with detailed surface
      const moonX = width - 100;
      const moonY = 80;

      // Moon halo
      for (let i = 6; i >= 0; i--) {
        const g = new Graphics();
        g.circle(moonX, moonY, 35 + i * 15);
        g.fill(0xccddff);
        g.alpha = 0.02;
        layer.addChild(g);
      }

      // Moon base
      const moon = new Graphics();
      moon.circle(moonX, moonY, 32);
      moon.fill(COLORS.sky.night.moon);
      layer.addChild(moon);

      // Moon surface details
      const craters = [
        { x: 8, y: -5, r: 7, depth: 0.15 },
        { x: -10, y: 8, r: 5, depth: 0.12 },
        { x: 5, y: 12, r: 4, depth: 0.1 },
        { x: -5, y: -8, r: 3, depth: 0.08 },
        { x: 15, y: 5, r: 3, depth: 0.08 },
      ];
      craters.forEach(c => {
        const crater = new Graphics();
        crater.circle(moonX + c.x, moonY + c.y, c.r);
        crater.fill(0xc0c8d8);
        crater.alpha = c.depth;
        layer.addChild(crater);
      });

      // Moon rim light
      const rim = new Graphics();
      rim.arc(moonX, moonY, 31, -Math.PI * 0.7, Math.PI * 0.3);
      rim.stroke({ width: 2, color: 0xffffff, alpha: 0.4 });
      layer.addChild(rim);

    } else {
      // Sun positions based on time
      const sunPos: Record<string, { x: number; y: number; scale: number }> = {
        dawn: { x: 120, y: height - 20, scale: 1.2 },
        day: { x: width / 2, y: 70, scale: 1.0 },
        dusk: { x: width - 120, y: height - 30, scale: 1.3 },
      };

      const pos = sunPos[time];
      if (!pos) return;

      const skyColors = COLORS.sky[time as keyof typeof COLORS.sky];
      const sunColor = 'sun' in skyColors ? skyColors.sun : 0xffff00;

      // Animated sun rays
      const rayCount = 12;
      for (let i = 0; i < rayCount; i++) {
        const angle = (i / rayCount) * Math.PI * 2 + frame * 0.002;
        const ray = new Graphics();
        const len = 60 + Math.sin(frame * 0.03 + i) * 15;
        ray.moveTo(pos.x, pos.y);
        ray.lineTo(
          pos.x + Math.cos(angle) * len * pos.scale,
          pos.y + Math.sin(angle) * len * pos.scale
        );
        ray.stroke({ width: 8, color: sunColor, alpha: 0.1 });
        layer.addChild(ray);
      }

      // Sun glow layers
      for (let i = 8; i >= 0; i--) {
        const g = new Graphics();
        g.circle(pos.x, pos.y, (30 + i * 12) * pos.scale);
        g.fill(sunColor);
        g.alpha = 0.04;
        layer.addChild(g);
      }

      // Sun core
      const sun = new Graphics();
      sun.circle(pos.x, pos.y, 28 * pos.scale);
      sun.fill(sunColor);
      layer.addChild(sun);

      // Bright center
      const center = new Graphics();
      center.circle(pos.x, pos.y, 20 * pos.scale);
      center.fill(0xffffff);
      center.alpha = 0.6;
      layer.addChild(center);
    }
  }, [worldState.timeOfDay]);

  // Animated clouds
  const renderClouds = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('clouds') as Container;
    layer.removeChildren();

    const time = worldState.timeOfDay;
    const cloudColor = COLORS.sky[time]?.clouds || 0xffffff;
    const frame = frameRef.current;
    const width = app.screen.width;

    staticDataRef.current.clouds.forEach(cloud => {
      const g = new Graphics();

      // Cloud moves slowly
      const x = ((cloud.x + frame * cloud.speed) % (width + cloud.width * 2)) - cloud.width;

      // Draw puffy cloud shape
      const puffs = [
        { dx: 0, dy: 0, r: cloud.height * 0.8 },
        { dx: -cloud.width * 0.25, dy: 5, r: cloud.height * 0.6 },
        { dx: cloud.width * 0.25, dy: 3, r: cloud.height * 0.7 },
        { dx: -cloud.width * 0.15, dy: -5, r: cloud.height * 0.5 },
        { dx: cloud.width * 0.1, dy: -3, r: cloud.height * 0.55 },
      ];

      puffs.forEach(p => {
        g.circle(x + p.dx, cloud.y + p.dy, p.r);
      });
      g.fill(cloudColor);
      g.alpha = cloud.opacity * (time === 'night' ? 0.3 : 1);
      layer.addChild(g);
    });
  }, [worldState.timeOfDay]);

  // Mountains with depth
  const renderMountains = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('mountains') as Container;
    if (layer.children.length > 0) return;

    const width = app.screen.width;
    const groundY = app.screen.height * 0.7;

    // Far mountains
    const farMountains = new Graphics();
    farMountains.moveTo(0, groundY - 20);
    for (let x = 0; x <= width; x += 2) {
      const h = Math.sin(x * 0.004) * 60 + Math.sin(x * 0.012) * 30 + Math.sin(x * 0.002) * 40;
      farMountains.lineTo(x, groundY - 80 - h);
    }
    farMountains.lineTo(width, groundY - 20);
    farMountains.lineTo(width, groundY);
    farMountains.lineTo(0, groundY);
    farMountains.closePath();
    farMountains.fill(0x080f10);
    layer.addChild(farMountains);

    // Near mountains
    const nearMountains = new Graphics();
    nearMountains.moveTo(0, groundY - 10);
    for (let x = 0; x <= width; x += 2) {
      const h = Math.sin(x * 0.008 + 1) * 35 + Math.sin(x * 0.02) * 20;
      nearMountains.lineTo(x, groundY - 40 - h);
    }
    nearMountains.lineTo(width, groundY - 10);
    nearMountains.lineTo(width, groundY);
    nearMountains.lineTo(0, groundY);
    nearMountains.closePath();
    nearMountains.fill(0x0a1512);
    layer.addChild(nearMountains);
  }, []);

  // Atmospheric fog layers
  const renderFog = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const fogBack = app.stage.getChildByLabel('fog-back') as Container;
    const fogMid = app.stage.getChildByLabel('fog-mid') as Container;

    fogBack.removeChildren();
    fogMid.removeChildren();

    const width = app.screen.width;
    const groundY = app.screen.height * 0.7;
    const frame = frameRef.current;

    // Back fog - subtle movement
    const fog1 = new Graphics();
    fog1.rect(0, groundY - 100, width, 70);
    fog1.fill(0x1a2a3a);
    fog1.alpha = 0.2 + Math.sin(frame * 0.01) * 0.05;
    fogBack.addChild(fog1);

    // Mid fog
    const fog2 = new Graphics();
    fog2.rect(0, groundY - 50, width, 40);
    fog2.fill(0x2a3a4a);
    fog2.alpha = 0.12 + Math.sin(frame * 0.015 + 1) * 0.03;
    fogMid.addChild(fog2);
  }, []);

  // Trees with subtle sway
  const renderTrees = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const groundY = app.screen.height * 0.7;
    const frame = frameRef.current;

    // Helper to draw detailed tree
    const drawTree = (g: Graphics, tree: TreeData, y: number, colors: { base: number; highlight: number }, scale: number) => {
      const x = tree.x;
      const h = tree.height * scale;
      const sway = Math.sin(frame * 0.008 + tree.sway) * 2 * scale;

      const tw = 8 * scale;
      const th = h * 0.2;

      // Trunk with texture
      g.roundRect(x - tw / 2, y - th, tw, th + 5, 2);
      g.fill(0x2d1a0a);

      // Trunk highlight
      g.roundRect(x - tw / 4, y - th, tw / 4, th + 5, 1);
      g.fill(0x3d2a1a);
      g.fill({ color: 0x3d2a1a, alpha: 0.5 });

      // Foliage layers with sway
      const layers = [
        { yOff: -th + 5, w: h * 0.5, hh: h * 0.35, color: colors.base },
        { yOff: -th - h * 0.2, w: h * 0.4, hh: h * 0.32, color: colors.base },
        { yOff: -th - h * 0.4, w: h * 0.3, hh: h * 0.28, color: colors.highlight },
        { yOff: -th - h * 0.55, w: h * 0.18, hh: h * 0.2, color: colors.highlight },
      ];

      layers.forEach((l, i) => {
        const layerSway = sway * (1 + i * 0.15);
        g.moveTo(x + layerSway * 0.5, y + l.yOff - l.hh);
        g.lineTo(x - l.w / 2 + layerSway * 0.3, y + l.yOff);
        g.lineTo(x + l.w / 2 + layerSway * 0.7, y + l.yOff);
        g.closePath();
        g.fill(l.color);
      });
    };

    // Back trees
    const backLayer = app.stage.getChildByLabel('treesBack') as Container;
    backLayer.removeChildren();
    const backG = new Graphics();
    staticDataRef.current.backTrees.forEach(t => {
      drawTree(backG, t, groundY - 20, COLORS.forest.back, 0.7);
    });
    backLayer.addChild(backG);

    // Mid trees
    const midLayer = app.stage.getChildByLabel('treesMid') as Container;
    midLayer.removeChildren();
    const midG = new Graphics();
    staticDataRef.current.midTrees.forEach(t => {
      drawTree(midG, t, groundY - 8, COLORS.forest.mid, 0.85);
    });
    midLayer.addChild(midG);

    // Front trees
    const frontLayer = app.stage.getChildByLabel('treesFront') as Container;
    frontLayer.removeChildren();
    const frontG = new Graphics();
    staticDataRef.current.frontTrees.forEach(t => {
      drawTree(frontG, t, groundY + 5, COLORS.forest.front, 1.0);
    });
    frontLayer.addChild(frontG);
  }, []);

  // Ground with path and details
  const renderGround = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('ground') as Container;
    layer.removeChildren();

    const groundY = app.screen.height * 0.7;
    const width = app.screen.width;
    const height = app.screen.height;

    // Base ground gradient
    const ground = new Graphics();
    for (let i = 0; i < 20; i++) {
      const t = i / 20;
      const color = lerpColor(COLORS.ground.grass, 0x0a200a, t);
      ground.rect(0, groundY + t * (height - groundY), width, (height - groundY) / 20 + 1);
      ground.fill(color);
    }
    layer.addChild(ground);

    // Dirt path with texture
    const pathWidth = width * 0.32;
    const pathX = (width - pathWidth) / 2;

    const path = new Graphics();
    path.roundRect(pathX, groundY - 2, pathWidth, 22, 8);
    path.fill(COLORS.ground.path);
    layer.addChild(path);

    // Path texture
    for (let i = 0; i < 30; i++) {
      const px = pathX + 10 + seededRandom(i * 131 + 800) * (pathWidth - 20);
      const py = groundY + seededRandom(i * 137 + 800) * 15;
      const dot = new Graphics();
      dot.circle(px, py, 1 + seededRandom(i * 139 + 800) * 2);
      dot.fill(seededRandom(i * 141 + 800) > 0.5 ? 0x4a3520 : 0x6a5030);
      dot.alpha = 0.4;
      layer.addChild(dot);
    }

    // Path edges
    const leftEdge = new Graphics();
    leftEdge.roundRect(pathX - 8, groundY, 10, 16, 4);
    leftEdge.fill(COLORS.ground.moss);
    layer.addChild(leftEdge);

    const rightEdge = new Graphics();
    rightEdge.roundRect(pathX + pathWidth - 2, groundY, 10, 16, 4);
    rightEdge.fill(COLORS.ground.moss);
    layer.addChild(rightEdge);
  }, []);

  // Rocks
  const renderRocks = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('rocks') as Container;
    if (layer.children.length > 0) return;

    staticDataRef.current.rocks.forEach(rock => {
      const g = new Graphics();
      const s = rock.size;

      // Rock shape (irregular polygon)
      g.moveTo(rock.x - s * 0.8, rock.y);
      g.lineTo(rock.x - s * 0.6, rock.y - s * 0.6);
      g.lineTo(rock.x + s * 0.2, rock.y - s * 0.8);
      g.lineTo(rock.x + s * 0.7, rock.y - s * 0.4);
      g.lineTo(rock.x + s * 0.9, rock.y);
      g.closePath();
      g.fill(rock.variant === 0 ? 0x4a4a4a : rock.variant === 1 ? 0x5a5a5a : 0x3a3a3a);

      // Rock highlight
      g.moveTo(rock.x - s * 0.5, rock.y - s * 0.3);
      g.lineTo(rock.x + s * 0.1, rock.y - s * 0.6);
      g.lineTo(rock.x + s * 0.3, rock.y - s * 0.3);
      g.closePath();
      g.fill(0x6a6a6a);
      g.alpha = 0.3;

      layer.addChild(g);
    });
  }, []);

  // Animated grass
  const renderGrass = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('grass') as Container;
    layer.removeChildren();

    const groundY = app.screen.height * 0.7;
    const frame = frameRef.current;
    const windSway = Math.sin(frame * 0.012) * 2;

    staticDataRef.current.grassPatches.forEach((patch, pi) => {
      const g = new Graphics();

      patch.heights.forEach((h, i) => {
        const offsetX = (i - patch.heights.length / 2) * 3;
        const sway = Math.sin(frame * 0.02 + pi * 0.3 + i * 0.4) * 2 + windSway * 0.5;

        g.moveTo(patch.x + offsetX, groundY);
        g.quadraticCurveTo(
          patch.x + offsetX + sway * 0.5,
          groundY - h / 2,
          patch.x + offsetX + sway,
          groundY - h
        );
        g.stroke({ width: 1.5, color: patch.colors[i] });
      });

      layer.addChild(g);
    });
  }, []);

  // Particle system
  const updateParticles = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('particles') as Container;
    layer.removeChildren();

    const groundY = app.screen.height * 0.7;
    const width = app.screen.width;

    // Add new particles occasionally
    if (worldState.timeOfDay === 'day' && Math.random() < 0.05) {
      // Floating dust motes
      particlesRef.current.push({
        x: Math.random() * width,
        y: groundY - 20 - Math.random() * 100,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -0.2 - Math.random() * 0.3,
        life: 1,
        maxLife: 100 + Math.random() * 100,
        size: 1 + Math.random() * 2,
        color: 0xffffff,
      });
    }

    // Leaves occasionally
    if (Math.random() < 0.02) {
      particlesRef.current.push({
        x: Math.random() * width,
        y: groundY - 150 - Math.random() * 50,
        vx: 0.5 + Math.random() * 0.5,
        vy: 0.3 + Math.random() * 0.2,
        life: 1,
        maxLife: 200 + Math.random() * 100,
        size: 3 + Math.random() * 2,
        color: Math.random() > 0.5 ? 0x2d5a2d : 0x5a3d1a,
      });
    }

    // Update and render particles
    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life++;

      if (p.life > p.maxLife || p.y > groundY + 20 || p.x < -20 || p.x > width + 20) {
        return false;
      }

      const alpha = 1 - (p.life / p.maxLife);
      const g = new Graphics();
      g.circle(p.x, p.y, p.size);
      g.fill(p.color);
      g.alpha = alpha * 0.5;
      layer.addChild(g);

      return true;
    });
  }, [worldState.timeOfDay]);

  // Player character with smooth animation
  const renderPlayer = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('entities') as Container;
    const old = layer.getChildByLabel('player');
    if (old) layer.removeChild(old);

    const container = new Container();
    container.label = 'player';

    const groundY = app.screen.height * 0.7;
    const px = app.screen.width / 2;
    const py = groundY;
    const frame = frameRef.current;

    // Smooth idle animation
    const breath = Math.sin(frame * 0.04) * 2;
    const isActive = !!currentAction;
    const walkCycle = isActive ? Math.sin(frame * 0.15) : 0;
    const armSwing = walkCycle * 4;
    const bobY = Math.abs(walkCycle) * 2;

    // Ground shadow
    const shadow = new Graphics();
    shadow.ellipse(0, 2, 20 + Math.abs(walkCycle) * 2, 6);
    shadow.fill(0x000000);
    shadow.alpha = 0.3;
    container.addChild(shadow);

    // Health-based aura
    const hp = playerStats.health / 100;
    const auraColor = hp > 0.6 ? 0x22c55e : hp > 0.3 ? 0xeab308 : 0xef4444;

    for (let i = 3; i >= 0; i--) {
      const aura = new Graphics();
      aura.circle(0, -35 - bobY, 35 + i * 8);
      aura.fill(auraColor);
      aura.alpha = (0.08 - i * 0.015) * (0.8 + Math.sin(frame * 0.05) * 0.2);
      container.addChild(aura);
    }

    const char = new Graphics();

    // Feet
    char.ellipse(-6, -2 - bobY + Math.abs(armSwing) * 0.2, 5, 3);
    char.fill(0x1a1a1a);
    char.ellipse(6, -2 - bobY - Math.abs(armSwing) * 0.2, 5, 3);
    char.fill(0x1a1a1a);

    // Legs (pants)
    char.roundRect(-9, -18 - bobY, 7, 18, 2);
    char.fill(0x1e3a5f);
    char.roundRect(2, -18 - bobY, 7, 18, 2);
    char.fill(0x1e3a5f);

    // Body (shirt) with slight tilt based on movement
    const bodyTilt = isActive ? walkCycle * 0.02 : 0;
    char.roundRect(-11, -48 + breath - bobY, 22, 32, 4);
    char.fill(0x2563eb);

    // Shirt details
    char.roundRect(-2, -46 + breath - bobY, 4, 28, 1);
    char.fill(0x1d4ed8);
    char.alpha = 0.5;

    // Arms
    char.roundRect(-16, -44 + breath - bobY - armSwing, 6, 22, 3);
    char.fill(0x2563eb);
    char.roundRect(10, -44 + breath - bobY + armSwing, 6, 22, 3);
    char.fill(0x2563eb);

    // Hands
    char.circle(-13, -24 + breath - bobY - armSwing, 4);
    char.fill(0xfcd34d);
    char.circle(13, -24 + breath - bobY + armSwing, 4);
    char.fill(0xfcd34d);

    // Neck
    char.roundRect(-3, -52 + breath - bobY, 6, 6, 2);
    char.fill(0xfcd34d);

    // Head
    char.circle(0, -60 + breath - bobY, 13);
    char.fill(0xfcd34d);

    // Hair
    char.ellipse(0, -70 + breath - bobY, 11, 6);
    char.fill(0x5c3d1a);
    char.ellipse(-6, -66 + breath - bobY, 5, 4);
    char.fill(0x5c3d1a);
    char.ellipse(6, -66 + breath - bobY, 5, 4);
    char.fill(0x5c3d1a);

    // Face
    // Eyes
    const blinkPhase = Math.floor(frame / 80) % 40;
    const eyeHeight = blinkPhase === 0 ? 0.5 : 2.5;
    char.ellipse(-5, -60 + breath - bobY, 2.5, eyeHeight);
    char.fill(0x1a1a1a);
    char.ellipse(5, -60 + breath - bobY, 2.5, eyeHeight);
    char.fill(0x1a1a1a);

    // Eye highlights
    if (blinkPhase !== 0) {
      char.circle(-4, -61 + breath - bobY, 0.8);
      char.fill(0xffffff);
      char.circle(6, -61 + breath - bobY, 0.8);
      char.fill(0xffffff);
    }

    // Mouth (changes based on health)
    if (hp > 0.5) {
      // Happy
      char.arc(0, -56 + breath - bobY, 4, 0, Math.PI);
      char.stroke({ width: 1.5, color: 0x1a1a1a });
    } else if (hp > 0.25) {
      // Neutral
      char.moveTo(-3, -55 + breath - bobY);
      char.lineTo(3, -55 + breath - bobY);
      char.stroke({ width: 1.5, color: 0x1a1a1a });
    } else {
      // Worried
      char.arc(0, -52 + breath - bobY, 4, Math.PI, 0);
      char.stroke({ width: 1.5, color: 0x1a1a1a });
    }

    container.addChild(char);
    container.x = px;
    container.y = py;

    // Action indicator
    if (currentAction) {
      // Thought bubble dots
      for (let i = 0; i < 3; i++) {
        const dot = new Graphics();
        dot.circle(-30 + i * 8, -80 + i * 5 - bobY, 3 - i * 0.5);
        dot.fill(0xffffff);
        dot.alpha = 0.8;
        container.addChild(dot);
      }

      // Action bubble
      const bubblePadding = 12;
      const bubbleWidth = Math.min(currentAction.length * 7 + bubblePadding * 2, 180);

      const bubble = new Graphics();
      bubble.roundRect(-bubbleWidth / 2, -115 - bobY, bubbleWidth, 32, 10);
      bubble.fill(0xffffff);
      container.addChild(bubble);

      // Bubble pointer
      const pointer = new Graphics();
      pointer.moveTo(-15, -83 - bobY);
      pointer.lineTo(-25, -95 - bobY);
      pointer.lineTo(-5, -95 - bobY);
      pointer.closePath();
      pointer.fill(0xffffff);
      container.addChild(pointer);

      const txt = new Text({
        text: currentAction.length > 22 ? currentAction.slice(0, 22) + '...' : currentAction,
        style: new TextStyle({
          fontFamily: 'system-ui, sans-serif',
          fontSize: 11,
          fontWeight: '600',
          fill: 0x1a1a1a,
        }),
      });
      txt.anchor.set(0.5);
      txt.y = -99 - bobY;
      container.addChild(txt);
    }

    layer.addChild(container);
  }, [playerStats.health, currentAction]);

  // Enemies with better designs
  const renderThreats = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('entities') as Container;
    layer.children.filter(c => c.label?.startsWith('enemy_')).forEach(c => layer.removeChild(c));

    const groundY = app.screen.height * 0.7;
    const frame = frameRef.current;

    worldState.threats.forEach((threat, i) => {
      const container = new Container();
      container.label = `enemy_${i}`;

      const x = 100 + i * 160;
      const y = groundY;
      const breathe = Math.sin(frame * 0.06 + i * 2) * 2;
      const prowl = Math.sin(frame * 0.1 + i) * 1.5;

      // Shadow
      const shadow = new Graphics();
      shadow.ellipse(0, 2, 28, 7);
      shadow.fill(0x000000);
      shadow.alpha = 0.25;
      container.addChild(shadow);

      // Danger indicator
      const dangerPulse = 0.5 + Math.sin(frame * 0.1) * 0.5;
      const danger = new Graphics();
      danger.circle(0, -25, 45);
      danger.fill(0xff0000);
      danger.alpha = 0.06 * dangerPulse;
      container.addChild(danger);

      const enemy = new Graphics();

      if (threat.toLowerCase().includes('wolf')) {
        // Animated wolf
        const bodyY = -18 + breathe * 0.5;

        // Body
        enemy.ellipse(0, bodyY, 32, 14);
        enemy.fill(0x4a4a4a);

        // Fur texture
        enemy.ellipse(-5, bodyY - 3, 20, 8);
        enemy.fill(0x5a5a5a);

        // Head
        enemy.ellipse(-28 + prowl, bodyY - 2, 14, 12);
        enemy.fill(0x5a5a5a);

        // Snout
        enemy.ellipse(-40 + prowl, bodyY, 8, 5);
        enemy.fill(0x3a3a3a);

        // Nose
        enemy.circle(-46 + prowl, bodyY - 1, 2);
        enemy.fill(0x1a1a1a);

        // Ears
        enemy.moveTo(-36 + prowl, bodyY - 12);
        enemy.lineTo(-32 + prowl, bodyY - 26);
        enemy.lineTo(-28 + prowl, bodyY - 12);
        enemy.fill(0x4a4a4a);
        enemy.moveTo(-24 + prowl, bodyY - 12);
        enemy.lineTo(-20 + prowl, bodyY - 26);
        enemy.lineTo(-16 + prowl, bodyY - 12);
        enemy.fill(0x4a4a4a);

        // Inner ears
        enemy.moveTo(-33 + prowl, bodyY - 14);
        enemy.lineTo(-32 + prowl, bodyY - 22);
        enemy.lineTo(-30 + prowl, bodyY - 14);
        enemy.fill(0x8a6a6a);

        // Eyes (glowing)
        enemy.circle(-32 + prowl, bodyY - 4, 3);
        enemy.fill(0xff4444);
        enemy.circle(-32 + prowl, bodyY - 4, 1.5);
        enemy.fill(0xffaaaa);

        // Legs with walking animation
        const legOffsets = [
          { x: -18, phase: 0 },
          { x: -6, phase: Math.PI },
          { x: 6, phase: 0 },
          { x: 18, phase: Math.PI },
        ];
        legOffsets.forEach(leg => {
          const legY = Math.sin(frame * 0.1 + leg.phase) * 2;
          enemy.roundRect(leg.x - 3, -5 + legY, 6, 12, 2);
          enemy.fill(0x3a3a3a);
        });

        // Tail
        enemy.moveTo(28, bodyY - 2);
        enemy.quadraticCurveTo(40 + breathe, bodyY - 18, 38, bodyY + 2);
        enemy.stroke({ width: 6, color: 0x5a5a5a, cap: 'round' });

      } else if (threat.toLowerCase().includes('bear')) {
        // Larger, more menacing bear
        const bodyY = -30 + breathe;

        // Body
        enemy.ellipse(0, bodyY, 42, 28);
        enemy.fill(0x5c3d1e);

        // Belly
        enemy.ellipse(5, bodyY + 8, 25, 18);
        enemy.fill(0x6b4c2d);

        // Head
        enemy.circle(-38 + prowl, bodyY - 10, 22);
        enemy.fill(0x6b4c2d);

        // Snout
        enemy.ellipse(-55 + prowl, bodyY - 6, 10, 7);
        enemy.fill(0x5c3d1e);

        // Nose
        enemy.ellipse(-62 + prowl, bodyY - 7, 4, 3);
        enemy.fill(0x1a0a00);

        // Ears
        enemy.circle(-50 + prowl, bodyY - 30, 8);
        enemy.fill(0x5c3d1e);
        enemy.circle(-50 + prowl, bodyY - 30, 4);
        enemy.fill(0x4a3010);
        enemy.circle(-26 + prowl, bodyY - 30, 8);
        enemy.fill(0x5c3d1e);
        enemy.circle(-26 + prowl, bodyY - 30, 4);
        enemy.fill(0x4a3010);

        // Eyes
        enemy.circle(-44 + prowl, bodyY - 12, 4);
        enemy.fill(0x000000);
        enemy.circle(-44 + prowl, bodyY - 13, 1.5);
        enemy.fill(0x444444);
        enemy.circle(-32 + prowl, bodyY - 12, 4);
        enemy.fill(0x000000);
        enemy.circle(-32 + prowl, bodyY - 13, 1.5);
        enemy.fill(0x444444);

        // Mouth (growling)
        enemy.arc(-55 + prowl, bodyY - 2, 5, 0, Math.PI);
        enemy.fill(0x2a0a00);

        // Legs
        [-22, -8, 8, 22].forEach((lx, li) => {
          const legPhase = li % 2 === 0 ? 0 : Math.PI;
          const legY = Math.sin(frame * 0.08 + legPhase) * 1.5;
          enemy.roundRect(lx - 6, -5 + legY, 12, 18, 4);
          enemy.fill(0x4a3010);
        });

      } else {
        // Generic threat (snake)
        const segments = 8;
        for (let s = 0; s < segments; s++) {
          const segX = s * 12 - 40;
          const segY = -10 + Math.sin(frame * 0.1 + s * 0.5) * 5;
          enemy.circle(segX, segY, 8 - s * 0.5);
          enemy.fill(s === 0 ? 0x2d5a2d : 0x3d6b3d);
        }
        // Eyes
        enemy.circle(-42, -14, 2);
        enemy.fill(0xff0000);
        enemy.circle(-38, -14, 2);
        enemy.fill(0xff0000);
      }

      container.addChild(enemy);
      container.x = x;
      container.y = y;
      layer.addChild(container);
    });
  }, [worldState.threats]);

  // Weather effects
  const renderWeather = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('weather') as Container;
    layer.removeChildren();

    const width = app.screen.width;
    const height = app.screen.height;
    const frame = frameRef.current;

    if (worldState.weather === 'rain' || worldState.weather === 'storm') {
      const intensity = worldState.weather === 'storm' ? 150 : 80;

      // Rain drops
      const rain = new Graphics();
      for (let i = 0; i < intensity; i++) {
        const seed = i * 1000;
        const x = ((seededRandom(seed) * width * 1.3) + frame * 2 * (worldState.weather === 'storm' ? 2 : 1)) % (width * 1.3) - width * 0.15;
        const y = ((frame * 10 + seededRandom(seed + 1) * height * 1.5) % (height * 1.5)) - height * 0.25;
        const len = worldState.weather === 'storm' ? 22 : 15;
        const angle = worldState.weather === 'storm' ? 0.3 : 0.1;

        rain.moveTo(x, y);
        rain.lineTo(x + len * angle, y + len);
        rain.stroke({ width: 1.5, color: 0x88aadd, alpha: 0.4 });
      }
      layer.addChild(rain);

      // Splash effects on ground
      const groundY = height * 0.7;
      for (let i = 0; i < 20; i++) {
        if (seededRandom(frame * 0.1 + i * 100) > 0.7) {
          const sx = seededRandom(i * 200 + frame) * width;
          const splash = new Graphics();
          splash.circle(sx, groundY + 5, 2);
          splash.fill(0xaaccee);
          splash.alpha = 0.3;
          layer.addChild(splash);
        }
      }

      // Lightning
      if (worldState.weather === 'storm' && Math.sin(frame * 0.12) > 0.97) {
        const flash = new Graphics();
        flash.rect(0, 0, width, height);
        flash.fill(0xffffff);
        flash.alpha = 0.4;
        layer.addChild(flash);

        // Lightning bolt
        const boltX = 100 + seededRandom(frame * 0.5) * (width - 200);
        const bolt = new Graphics();
        bolt.moveTo(boltX, 0);
        let by = 0;
        while (by < height * 0.6) {
          by += 20 + seededRandom(by + frame) * 30;
          const bx = boltX + (seededRandom(by + frame * 2) - 0.5) * 60;
          bolt.lineTo(bx, by);
        }
        bolt.stroke({ width: 3, color: 0xffffff });
        bolt.stroke({ width: 6, color: 0xaaddff, alpha: 0.5 });
        layer.addChild(bolt);
      }
    }

    // Fireflies at night
    if (worldState.timeOfDay === 'night' || worldState.timeOfDay === 'dusk') {
      const ffCount = worldState.timeOfDay === 'night' ? 25 : 10;
      for (let i = 0; i < ffCount; i++) {
        const t = frame * 0.015 + i * 2;
        const baseX = seededRandom(i + 500) * width;
        const baseY = height * 0.35 + seededRandom(i + 600) * height * 0.35;
        const x = baseX + Math.sin(t) * 40 + Math.cos(t * 0.7) * 20;
        const y = baseY + Math.cos(t * 0.8) * 25 + Math.sin(t * 1.2) * 15;
        const alpha = (Math.sin(t * 2.5) + 1) * 0.4;

        if (alpha > 0.15) {
          // Glow
          const glow = new Graphics();
          glow.circle(x, y, 8);
          glow.fill(0xffff66);
          glow.alpha = alpha * 0.2;
          layer.addChild(glow);

          // Core
          const core = new Graphics();
          core.circle(x, y, 2.5);
          core.fill(0xffffaa);
          core.alpha = alpha;
          layer.addChild(core);
        }
      }
    }
  }, [worldState.weather, worldState.timeOfDay]);

  // Overlay effects
  const renderOverlay = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('overlay') as Container;
    layer.removeChildren();

    const width = app.screen.width;
    const height = app.screen.height;

    // Vignette
    const vRadius = Math.max(width, height) * 0.8;
    const corners = [[0, 0], [width, 0], [0, height], [width, height]];
    corners.forEach(([cx, cy]) => {
      const v = new Graphics();
      v.circle(cx, cy, vRadius);
      v.fill(0x000000);
      v.alpha = 0.25;
      layer.addChild(v);
    });

    // Time-based ambient tint
    const ambient = COLORS.sky[worldState.timeOfDay]?.ambient || 0xffffff;
    const tint = new Graphics();
    tint.rect(0, 0, width, height);
    tint.fill(ambient);
    tint.alpha = worldState.timeOfDay === 'night' ? 0.06 : 0.02;
    layer.addChild(tint);

    // Low health warning
    if (playerStats.health < 30) {
      const danger = new Graphics();
      danger.rect(0, 0, width, height);
      danger.fill(0xff0000);
      danger.alpha = 0.05 + Math.sin(frameRef.current * 0.1) * 0.03;
      layer.addChild(danger);
    }
  }, [worldState.timeOfDay, playerStats.health]);

  // UI elements
  const renderUI = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('ui') as Container;
    layer.removeChildren();

    const width = app.screen.width;
    const height = app.screen.height;

    // Location badge
    const locBg = new Graphics();
    locBg.roundRect(12, 12, 200, 36, 10);
    locBg.fill(0x000000);
    locBg.alpha = 0.6;
    layer.addChild(locBg);

    const locIcon = new Text({
      text: '📍',
      style: new TextStyle({ fontSize: 16 }),
    });
    locIcon.x = 20;
    locIcon.y = 20;
    layer.addChild(locIcon);

    const locTxt = new Text({
      text: worldState.currentLocation,
      style: new TextStyle({
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 14,
        fontWeight: '600',
        fill: 0xffffff,
      }),
    });
    locTxt.x = 44;
    locTxt.y = 21;
    layer.addChild(locTxt);

    // Weather badge
    const weatherEmoji: Record<string, string> = {
      clear: '☀️',
      cloudy: '☁️',
      rain: '🌧️',
      storm: '⛈️',
    };
    const tempColor = worldState.temperature < 10 ? 0x60a5fa :
                      worldState.temperature > 30 ? 0xf87171 : 0x4ade80;

    const wBg = new Graphics();
    wBg.roundRect(width - 115, 12, 103, 36, 10);
    wBg.fill(0x000000);
    wBg.alpha = 0.6;
    layer.addChild(wBg);

    const wTxt = new Text({
      text: `${weatherEmoji[worldState.weather] || '☀️'} ${worldState.temperature}°C`,
      style: new TextStyle({
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 14,
        fontWeight: '600',
        fill: tempColor,
      }),
    });
    wTxt.x = width - 100;
    wTxt.y = 21;
    layer.addChild(wTxt);

    // Day counter
    const dayBg = new Graphics();
    dayBg.roundRect(width - 95, height - 44, 83, 32, 8);
    dayBg.fill(0x000000);
    dayBg.alpha = 0.6;
    layer.addChild(dayBg);

    const dayTxt = new Text({
      text: `Day ${worldState.daysSurvived + 1}`,
      style: new TextStyle({
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 13,
        fontWeight: 'bold',
        fill: 0xffffff,
      }),
    });
    dayTxt.x = width - 78;
    dayTxt.y = height - 36;
    layer.addChild(dayTxt);

    // Time of day indicator
    const timeEmoji: Record<string, string> = {
      dawn: '🌅',
      day: '☀️',
      dusk: '🌆',
      night: '🌙',
    };

    const timeBg = new Graphics();
    timeBg.roundRect(12, height - 44, 80, 32, 8);
    timeBg.fill(0x000000);
    timeBg.alpha = 0.6;
    layer.addChild(timeBg);

    const timeTxt = new Text({
      text: `${timeEmoji[worldState.timeOfDay] || '☀️'} ${worldState.timeOfDay.charAt(0).toUpperCase() + worldState.timeOfDay.slice(1)}`,
      style: new TextStyle({
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 11,
        fontWeight: '600',
        fill: 0xcccccc,
      }),
    });
    timeTxt.x = 22;
    timeTxt.y = height - 36;
    layer.addChild(timeTxt);
  }, [worldState]);

  // Main render loop
  useEffect(() => {
    if (!isLoaded || !appRef.current) return;

    let animId: number;
    let lastTime = 0;

    const loop = (time: number) => {
      // 60fps cap
      if (time - lastTime >= 16.67) {
        lastTime = time;
        frameRef.current++;

        renderSky();
        renderStars();
        renderCelestial();
        renderClouds();
        renderMountains();
        renderFog();
        renderTrees();
        renderGround();
        renderRocks();
        renderGrass();
        updateParticles();
        renderPlayer();
        renderThreats();
        renderWeather();
        renderOverlay();
        renderUI();
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [
    isLoaded, renderSky, renderStars, renderCelestial, renderClouds,
    renderMountains, renderFog, renderTrees, renderGround, renderRocks,
    renderGrass, updateParticles, renderPlayer, renderThreats,
    renderWeather, renderOverlay, renderUI
  ]);

  // Resize handler
  useEffect(() => {
    const onResize = () => {
      if (appRef.current && containerRef.current) {
        appRef.current.renderer.resize(containerRef.current.clientWidth, 450);
        staticDataRef.current.initialized = false;
        initStaticData(containerRef.current.clientWidth, 450);
      }
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [initStaticData]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl shadow-black/70 border border-gray-700/40 bg-gray-900">
      <div ref={containerRef} className="w-full" style={{ height: 450 }} />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg">🌲</span>
              </div>
            </div>
            <span className="text-green-400 font-medium text-sm">Loading The Forest...</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Color interpolation helper
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}
