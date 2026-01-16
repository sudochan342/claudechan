'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { useSurvivalStore } from '@/store/survival';

// Seeded random for consistent positions
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// VIBRANT COLOR PALETTES - Inspired by Stardew Valley & Terraria
const COLORS = {
  sky: {
    dawn: {
      top: 0x1a0a2e,
      mid: 0xff6b9d,
      bottom: 0xffd93d,
      sun: 0xffe66d,
      clouds: 0xffb8d0,
      ambient: 0xffccaa,
    },
    day: {
      top: 0x1e90ff,
      mid: 0x4fc3f7,
      bottom: 0x87ceeb,
      sun: 0xffeb3b,
      clouds: 0xffffff,
      ambient: 0xffffff,
    },
    dusk: {
      top: 0x2d1b69,
      mid: 0xff6b6b,
      bottom: 0xfeca57,
      sun: 0xff9f43,
      clouds: 0xffa07a,
      ambient: 0xffaa66,
    },
    night: {
      top: 0x0d1b2a,
      mid: 0x1b263b,
      bottom: 0x415a77,
      moon: 0xf0f8ff,
      clouds: 0x3a506b,
      ambient: 0x6699cc,
      stars: 0xffffff,
    },
  },
  forest: {
    back: { base: 0x2d5a27, highlight: 0x4a7c43 },
    mid: { base: 0x3d8b37, highlight: 0x5cb85c },
    front: { base: 0x4caf50, highlight: 0x8bc34a },
  },
  ground: {
    grass: 0x4caf50,
    grassLight: 0x8bc34a,
    dirt: 0x8d6e63,
    path: 0xbcaaa4,
    flowers: [0xff6b6b, 0xffd93d, 0x74b9ff, 0xfd79a8, 0xa29bfe],
  },
  water: {
    deep: 0x0077b6,
    shallow: 0x48cae4,
    foam: 0xffffff,
  },
};

interface TreeData {
  x: number;
  height: number;
  variant: number;
  sway: number;
  trunkColor: number;
  leafColor: number;
}

interface FlowerData {
  x: number;
  y: number;
  color: number;
  size: number;
  swayOffset: number;
}

interface ButterflyData {
  x: number;
  y: number;
  color: number;
  phase: number;
  speed: number;
}

interface CloudData {
  x: number;
  y: number;
  width: number;
  puffs: { dx: number; dy: number; r: number }[];
  speed: number;
}

interface StarData {
  x: number;
  y: number;
  size: number;
  twinkleSpeed: number;
  color: number;
}

interface BirdData {
  x: number;
  y: number;
  speed: number;
  wingPhase: number;
}

export function PixiGameWorld() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const frameRef = useRef(0);

  const staticDataRef = useRef<{
    backTrees: TreeData[];
    midTrees: TreeData[];
    frontTrees: TreeData[];
    stars: StarData[];
    clouds: CloudData[];
    flowers: FlowerData[];
    butterflies: ButterflyData[];
    birds: BirdData[];
    bushes: { x: number; size: number; color: number }[];
    initialized: boolean;
  }>({
    backTrees: [],
    midTrees: [],
    frontTrees: [],
    stars: [],
    clouds: [],
    flowers: [],
    butterflies: [],
    birds: [],
    bushes: [],
    initialized: false,
  });

  const [isLoaded, setIsLoaded] = useState(false);
  const { worldState, playerStats, currentAction, isPlaying, isPaused } = useSurvivalStore();

  // Track player position for movement
  const playerPosRef = useRef({ x: 0.5, targetX: 0.5, direction: 1 });

  // Initialize static data
  const initStaticData = useCallback((width: number, height: number) => {
    if (staticDataRef.current.initialized) return;

    const groundY = height * 0.72;
    const data = staticDataRef.current;

    // Tree colors - vibrant greens
    const leafColors = [0x2d5a27, 0x3d8b37, 0x4caf50, 0x66bb6a, 0x81c784];
    const trunkColors = [0x5d4037, 0x6d4c41, 0x795548];

    // Back trees
    data.backTrees = [];
    for (let i = 0; i < 25; i++) {
      data.backTrees.push({
        x: (i / 25) * width + seededRandom(i * 7) * 40 - 20,
        height: 60 + seededRandom(i * 13) * 30,
        variant: Math.floor(seededRandom(i * 17) * 3),
        sway: seededRandom(i * 19) * Math.PI * 2,
        trunkColor: trunkColors[Math.floor(seededRandom(i * 23) * trunkColors.length)],
        leafColor: leafColors[Math.floor(seededRandom(i * 29) * leafColors.length)],
      });
    }

    // Mid trees
    data.midTrees = [];
    for (let i = 0; i < 18; i++) {
      data.midTrees.push({
        x: (i / 18) * width + seededRandom(i * 11 + 100) * 50 - 25,
        height: 80 + seededRandom(i * 19 + 100) * 40,
        variant: Math.floor(seededRandom(i * 23 + 100) * 3),
        sway: seededRandom(i * 29 + 100) * Math.PI * 2,
        trunkColor: trunkColors[Math.floor(seededRandom(i * 31 + 100) * trunkColors.length)],
        leafColor: leafColors[Math.floor(seededRandom(i * 37 + 100) * leafColors.length)],
      });
    }

    // Front trees - larger, more detailed
    data.frontTrees = [];
    for (let i = 0; i < 8; i++) {
      data.frontTrees.push({
        x: (i / 8) * width + seededRandom(i * 29 + 200) * 100 - 50,
        height: 120 + seededRandom(i * 31 + 200) * 50,
        variant: Math.floor(seededRandom(i * 37 + 200) * 3),
        sway: seededRandom(i * 41 + 200) * Math.PI * 2,
        trunkColor: trunkColors[Math.floor(seededRandom(i * 43 + 200) * trunkColors.length)],
        leafColor: leafColors[Math.floor(seededRandom(i * 47 + 200) * leafColors.length)],
      });
    }

    // Stars
    data.stars = [];
    for (let i = 0; i < 150; i++) {
      data.stars.push({
        x: seededRandom(i * 41 + 300) * width,
        y: seededRandom(i * 43 + 300) * groundY * 0.6,
        size: 0.5 + seededRandom(i * 47 + 300) * 2.5,
        twinkleSpeed: 0.02 + seededRandom(i * 53 + 300) * 0.04,
        color: seededRandom(i * 59 + 300) > 0.8 ? 0xffd700 : 0xffffff,
      });
    }

    // Fluffy clouds
    data.clouds = [];
    for (let i = 0; i < 8; i++) {
      const baseWidth = 100 + seededRandom(i * 61 + 400) * 150;
      const puffs = [];
      const puffCount = 4 + Math.floor(seededRandom(i * 63 + 400) * 4);
      for (let j = 0; j < puffCount; j++) {
        puffs.push({
          dx: (j - puffCount / 2) * (baseWidth / puffCount) * 0.7,
          dy: seededRandom(i * 67 + j * 11 + 400) * 15 - 7,
          r: 20 + seededRandom(i * 71 + j * 13 + 400) * 25,
        });
      }
      data.clouds.push({
        x: seededRandom(i * 73 + 400) * width * 1.5 - width * 0.25,
        y: 30 + seededRandom(i * 79 + 400) * 80,
        width: baseWidth,
        puffs,
        speed: 0.15 + seededRandom(i * 83 + 400) * 0.2,
      });
    }

    // Colorful flowers
    data.flowers = [];
    for (let i = 0; i < 60; i++) {
      const x = seededRandom(i * 89 + 500) * width;
      if (x > width * 0.35 && x < width * 0.65) continue;
      data.flowers.push({
        x,
        y: groundY + seededRandom(i * 97 + 500) * 15 - 5,
        color: COLORS.ground.flowers[Math.floor(seededRandom(i * 101 + 500) * COLORS.ground.flowers.length)],
        size: 3 + seededRandom(i * 103 + 500) * 4,
        swayOffset: seededRandom(i * 107 + 500) * Math.PI * 2,
      });
    }

    // Butterflies
    data.butterflies = [];
    for (let i = 0; i < 12; i++) {
      data.butterflies.push({
        x: seededRandom(i * 109 + 600) * width,
        y: groundY - 50 - seededRandom(i * 113 + 600) * 150,
        color: COLORS.ground.flowers[Math.floor(seededRandom(i * 117 + 600) * COLORS.ground.flowers.length)],
        phase: seededRandom(i * 119 + 600) * Math.PI * 2,
        speed: 0.5 + seededRandom(i * 123 + 600) * 0.5,
      });
    }

    // Birds
    data.birds = [];
    for (let i = 0; i < 5; i++) {
      data.birds.push({
        x: seededRandom(i * 127 + 700) * width,
        y: 50 + seededRandom(i * 131 + 700) * 100,
        speed: 1 + seededRandom(i * 137 + 700) * 1.5,
        wingPhase: seededRandom(i * 139 + 700) * Math.PI * 2,
      });
    }

    // Bushes
    data.bushes = [];
    for (let i = 0; i < 15; i++) {
      const x = seededRandom(i * 141 + 800) * width;
      if (x > width * 0.3 && x < width * 0.7) continue;
      data.bushes.push({
        x,
        size: 15 + seededRandom(i * 143 + 800) * 20,
        color: leafColors[Math.floor(seededRandom(i * 149 + 800) * leafColors.length)],
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
        height: 500,
        backgroundColor: 0x87ceeb,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio, 2),
        autoDensity: true,
      });

      containerRef.current!.appendChild(app.canvas);
      appRef.current = app;

      const layers = [
        'sky', 'skyEffects', 'clouds', 'mountains',
        'treesBack', 'treesMid', 'water',
        'ground', 'bushes', 'flowers', 'treesFront',
        'butterflies', 'entities', 'birds', 'particles',
        'weather', 'ui'
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

  // Beautiful gradient sky
  const renderSky = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('sky') as Container;
    layer.removeChildren();

    const time = worldState.timeOfDay;
    const { top, mid, bottom } = COLORS.sky[time];
    const height = app.screen.height * 0.72;
    const width = app.screen.width;

    const sky = new Graphics();

    // Smooth gradient
    for (let i = 0; i < 100; i++) {
      const t = i / 100;
      let color: number;
      if (t < 0.5) {
        color = lerpColor(top, mid, t * 2);
      } else {
        color = lerpColor(mid, bottom, (t - 0.5) * 2);
      }
      sky.rect(0, t * height, width, height / 100 + 1);
      sky.fill(color);
    }
    layer.addChild(sky);
  }, [worldState.timeOfDay]);

  // Sky effects (sun/moon, stars)
  const renderSkyEffects = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('skyEffects') as Container;
    layer.removeChildren();

    const time = worldState.timeOfDay;
    const width = app.screen.width;
    const frame = frameRef.current;

    if (time === 'night') {
      // Twinkling stars
      staticDataRef.current.stars.forEach(star => {
        const twinkle = 0.5 + Math.sin(frame * star.twinkleSpeed + star.x) * 0.5;

        // Star glow
        if (star.size > 1.5) {
          const glow = new Graphics();
          glow.circle(star.x, star.y, star.size * 3);
          glow.fill(star.color);
          glow.alpha = twinkle * 0.2;
          layer.addChild(glow);
        }

        const s = new Graphics();
        s.circle(star.x, star.y, star.size * twinkle);
        s.fill(star.color);
        layer.addChild(s);
      });

      // Beautiful moon
      const moonX = width - 100;
      const moonY = 80;

      // Moon glow
      for (let i = 5; i >= 0; i--) {
        const g = new Graphics();
        g.circle(moonX, moonY, 40 + i * 20);
        g.fill(0xffffff);
        g.alpha = 0.03;
        layer.addChild(g);
      }

      const moon = new Graphics();
      moon.circle(moonX, moonY, 35);
      moon.fill(COLORS.sky.night.moon);
      layer.addChild(moon);

      // Moon details
      [[8, -5, 8], [-12, 10, 6], [5, 15, 5]].forEach(([cx, cy, r]) => {
        const crater = new Graphics();
        crater.circle(moonX + cx, moonY + cy, r);
        crater.fill(0xdde4ea);
        crater.alpha = 0.3;
        layer.addChild(crater);
      });

    } else {
      // Bright sun
      const sunPos: Record<string, { x: number; y: number }> = {
        dawn: { x: 120, y: 180 },
        day: { x: width / 2, y: 80 },
        dusk: { x: width - 120, y: 180 },
      };

      const pos = sunPos[time];
      if (!pos) return;

      const sunColor = COLORS.sky[time as keyof typeof COLORS.sky];
      const color = 'sun' in sunColor ? sunColor.sun : 0xffeb3b;

      // Animated sun rays
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + frame * 0.003;
        const ray = new Graphics();
        const innerR = 50;
        const outerR = 80 + Math.sin(frame * 0.05 + i) * 15;
        ray.moveTo(pos.x + Math.cos(angle) * innerR, pos.y + Math.sin(angle) * innerR);
        ray.lineTo(pos.x + Math.cos(angle) * outerR, pos.y + Math.sin(angle) * outerR);
        ray.stroke({ width: 4, color: color, alpha: 0.3 });
        layer.addChild(ray);
      }

      // Sun glow
      for (let i = 6; i >= 0; i--) {
        const g = new Graphics();
        g.circle(pos.x, pos.y, 35 + i * 15);
        g.fill(color);
        g.alpha = 0.08;
        layer.addChild(g);
      }

      // Sun
      const sun = new Graphics();
      sun.circle(pos.x, pos.y, 35);
      sun.fill(color);
      layer.addChild(sun);

      // Bright center
      const center = new Graphics();
      center.circle(pos.x, pos.y, 25);
      center.fill(0xffffff);
      center.alpha = 0.7;
      layer.addChild(center);
    }
  }, [worldState.timeOfDay]);

  // Fluffy animated clouds
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
      const x = ((cloud.x + frame * cloud.speed) % (width + cloud.width * 2)) - cloud.width;

      const g = new Graphics();
      cloud.puffs.forEach(puff => {
        g.circle(x + puff.dx, cloud.y + puff.dy, puff.r);
      });
      g.fill(cloudColor);
      g.alpha = time === 'night' ? 0.4 : 0.9;
      layer.addChild(g);

      // Cloud highlight
      const highlight = new Graphics();
      cloud.puffs.forEach(puff => {
        highlight.circle(x + puff.dx - puff.r * 0.2, cloud.y + puff.dy - puff.r * 0.2, puff.r * 0.6);
      });
      highlight.fill(0xffffff);
      highlight.alpha = time === 'night' ? 0.1 : 0.3;
      layer.addChild(highlight);
    });
  }, [worldState.timeOfDay]);

  // Colorful mountains
  const renderMountains = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('mountains') as Container;
    if (layer.children.length > 0) return;

    const width = app.screen.width;
    const groundY = app.screen.height * 0.72;

    // Far mountains - purple/blue
    const farMtn = new Graphics();
    farMtn.moveTo(0, groundY);
    for (let x = 0; x <= width; x += 3) {
      const h = Math.sin(x * 0.005) * 70 + Math.sin(x * 0.013) * 40 + Math.sin(x * 0.002) * 50;
      farMtn.lineTo(x, groundY - 100 - h);
    }
    farMtn.lineTo(width, groundY);
    farMtn.closePath();
    farMtn.fill(0x7c9cb5);
    layer.addChild(farMtn);

    // Snow caps
    const snow = new Graphics();
    for (let x = 0; x <= width; x += 3) {
      const h = Math.sin(x * 0.005) * 70 + Math.sin(x * 0.013) * 40 + Math.sin(x * 0.002) * 50;
      const peakY = groundY - 100 - h;
      if (h > 80) {
        snow.circle(x, peakY + 10, 15);
      }
    }
    snow.fill(0xffffff);
    snow.alpha = 0.7;
    layer.addChild(snow);

    // Near hills - green
    const nearHill = new Graphics();
    nearHill.moveTo(0, groundY);
    for (let x = 0; x <= width; x += 2) {
      const h = Math.sin(x * 0.008 + 1) * 40 + Math.sin(x * 0.02) * 25;
      nearHill.lineTo(x, groundY - 50 - h);
    }
    nearHill.lineTo(width, groundY);
    nearHill.closePath();
    nearHill.fill(0x5d9e5a);
    layer.addChild(nearHill);
  }, []);

  // Vibrant trees with animation
  const renderTrees = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const groundY = app.screen.height * 0.72;
    const frame = frameRef.current;

    const drawTree = (g: Graphics, tree: TreeData, baseY: number, scale: number) => {
      const x = tree.x;
      const h = tree.height * scale;
      const sway = Math.sin(frame * 0.01 + tree.sway) * 3 * scale;

      // Trunk
      const tw = 10 * scale;
      const th = h * 0.3;
      g.roundRect(x - tw / 2, baseY - th, tw, th + 5, 3);
      g.fill(tree.trunkColor);

      // Trunk highlight
      g.roundRect(x - tw / 4, baseY - th, tw / 3, th + 5, 2);
      g.fill(lerpColor(tree.trunkColor, 0xffffff, 0.2));

      // Foliage layers
      const layers = [
        { yOff: -th, w: h * 0.6, hh: h * 0.4 },
        { yOff: -th - h * 0.25, w: h * 0.5, hh: h * 0.35 },
        { yOff: -th - h * 0.45, w: h * 0.35, hh: h * 0.3 },
        { yOff: -th - h * 0.6, w: h * 0.2, hh: h * 0.2 },
      ];

      layers.forEach((l, i) => {
        const layerSway = sway * (1 + i * 0.2);

        // Shadow layer
        g.moveTo(x + layerSway, baseY + l.yOff - l.hh);
        g.lineTo(x - l.w / 2 + layerSway * 0.8, baseY + l.yOff);
        g.lineTo(x + l.w / 2 + layerSway * 1.2, baseY + l.yOff);
        g.closePath();
        g.fill(lerpColor(tree.leafColor, 0x000000, 0.2));

        // Main layer
        g.moveTo(x + layerSway, baseY + l.yOff - l.hh + 3);
        g.lineTo(x - l.w / 2 + 3 + layerSway * 0.8, baseY + l.yOff);
        g.lineTo(x + l.w / 2 - 3 + layerSway * 1.2, baseY + l.yOff);
        g.closePath();
        g.fill(tree.leafColor);

        // Highlight
        g.moveTo(x + layerSway - l.w * 0.1, baseY + l.yOff - l.hh + 8);
        g.lineTo(x - l.w / 4 + layerSway * 0.8, baseY + l.yOff - 5);
        g.lineTo(x + layerSway, baseY + l.yOff - 5);
        g.closePath();
        g.fill(lerpColor(tree.leafColor, 0xffffff, 0.3));
      });
    };

    // Back trees
    const backLayer = app.stage.getChildByLabel('treesBack') as Container;
    backLayer.removeChildren();
    const backG = new Graphics();
    staticDataRef.current.backTrees.forEach(t => drawTree(backG, t, groundY - 30, 0.6));
    backLayer.addChild(backG);

    // Mid trees
    const midLayer = app.stage.getChildByLabel('treesMid') as Container;
    midLayer.removeChildren();
    const midG = new Graphics();
    staticDataRef.current.midTrees.forEach(t => drawTree(midG, t, groundY - 15, 0.8));
    midLayer.addChild(midG);

    // Front trees
    const frontLayer = app.stage.getChildByLabel('treesFront') as Container;
    frontLayer.removeChildren();
    const frontG = new Graphics();
    staticDataRef.current.frontTrees.forEach(t => drawTree(frontG, t, groundY + 10, 1.0));
    frontLayer.addChild(frontG);
  }, []);

  // Sparkling water
  const renderWater = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('water') as Container;
    layer.removeChildren();

    const groundY = app.screen.height * 0.72;
    const width = app.screen.width;
    const frame = frameRef.current;

    // Water body
    const water = new Graphics();
    const waterY = groundY + 20;
    const waterH = 30;

    water.roundRect(width * 0.05, waterY, width * 0.25, waterH, 10);
    water.fill(COLORS.water.deep);
    layer.addChild(water);

    // Water surface reflection
    const surface = new Graphics();
    surface.roundRect(width * 0.05, waterY, width * 0.25, 8, 5);
    surface.fill(COLORS.water.shallow);
    layer.addChild(surface);

    // Animated sparkles
    for (let i = 0; i < 8; i++) {
      const sparkleX = width * 0.05 + 20 + seededRandom(i * 151) * (width * 0.25 - 40);
      const sparkleAlpha = 0.3 + Math.sin(frame * 0.1 + i * 2) * 0.3;
      if (sparkleAlpha > 0.3) {
        const sparkle = new Graphics();
        sparkle.circle(sparkleX, waterY + 4, 2);
        sparkle.fill(0xffffff);
        sparkle.alpha = sparkleAlpha;
        layer.addChild(sparkle);
      }
    }
  }, []);

  // Lush ground with grass
  const renderGround = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('ground') as Container;
    layer.removeChildren();

    const groundY = app.screen.height * 0.72;
    const width = app.screen.width;
    const height = app.screen.height;

    // Main grass
    const ground = new Graphics();
    ground.rect(0, groundY, width, height - groundY);
    ground.fill(COLORS.ground.grass);
    layer.addChild(ground);

    // Grass texture variation
    for (let i = 0; i < 50; i++) {
      const patch = new Graphics();
      const px = seededRandom(i * 157 + 900) * width;
      const py = groundY + seededRandom(i * 163 + 900) * (height - groundY - 20);
      patch.ellipse(px, py, 30 + seededRandom(i * 167 + 900) * 40, 10);
      patch.fill(seededRandom(i * 173 + 900) > 0.5 ? COLORS.ground.grassLight : 0x43a047);
      patch.alpha = 0.5;
      layer.addChild(patch);
    }

    // Beautiful dirt path
    const pathWidth = width * 0.3;
    const pathX = (width - pathWidth) / 2;

    const path = new Graphics();
    path.roundRect(pathX, groundY - 3, pathWidth, 25, 12);
    path.fill(COLORS.ground.path);
    layer.addChild(path);

    // Path details
    for (let i = 0; i < 20; i++) {
      const stone = new Graphics();
      const sx = pathX + 15 + seededRandom(i * 179 + 950) * (pathWidth - 30);
      const sy = groundY + seededRandom(i * 181 + 950) * 18;
      stone.ellipse(sx, sy, 3 + seededRandom(i * 191 + 950) * 5, 2 + seededRandom(i * 193 + 950) * 3);
      stone.fill(seededRandom(i * 197 + 950) > 0.5 ? 0x9e9e9e : 0xbdbdbd);
      stone.alpha = 0.6;
      layer.addChild(stone);
    }

    // Path borders (flowers/grass)
    const leftBorder = new Graphics();
    leftBorder.roundRect(pathX - 15, groundY - 2, 18, 22, 8);
    leftBorder.fill(0x66bb6a);
    layer.addChild(leftBorder);

    const rightBorder = new Graphics();
    rightBorder.roundRect(pathX + pathWidth - 3, groundY - 2, 18, 22, 8);
    rightBorder.fill(0x66bb6a);
    layer.addChild(rightBorder);
  }, []);

  // Decorative bushes
  const renderBushes = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('bushes') as Container;
    layer.removeChildren();

    const groundY = app.screen.height * 0.72;
    const frame = frameRef.current;

    staticDataRef.current.bushes.forEach((bush, i) => {
      const sway = Math.sin(frame * 0.015 + i) * 2;
      const g = new Graphics();

      // Bush shadow
      g.ellipse(bush.x + 3, groundY + 5, bush.size, bush.size * 0.4);
      g.fill(0x000000);
      g.alpha = 0.15;
      layer.addChild(g);

      // Main bush
      const main = new Graphics();
      main.circle(bush.x + sway, groundY - bush.size * 0.5, bush.size);
      main.circle(bush.x - bush.size * 0.4 + sway * 0.8, groundY - bush.size * 0.3, bush.size * 0.7);
      main.circle(bush.x + bush.size * 0.4 + sway * 1.2, groundY - bush.size * 0.3, bush.size * 0.7);
      main.fill(bush.color);
      layer.addChild(main);

      // Highlights
      const highlight = new Graphics();
      highlight.circle(bush.x - bush.size * 0.2 + sway, groundY - bush.size * 0.7, bush.size * 0.4);
      highlight.fill(lerpColor(bush.color, 0xffffff, 0.3));
      layer.addChild(highlight);
    });
  }, []);

  // Animated flowers
  const renderFlowers = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('flowers') as Container;
    layer.removeChildren();

    const frame = frameRef.current;

    staticDataRef.current.flowers.forEach(flower => {
      const sway = Math.sin(frame * 0.02 + flower.swayOffset) * 2;

      // Stem
      const stem = new Graphics();
      stem.moveTo(flower.x, flower.y);
      stem.quadraticCurveTo(flower.x + sway * 0.5, flower.y - flower.size * 2, flower.x + sway, flower.y - flower.size * 4);
      stem.stroke({ width: 2, color: 0x4caf50 });
      layer.addChild(stem);

      // Petals
      const petals = new Graphics();
      const petalCount = 5;
      for (let i = 0; i < petalCount; i++) {
        const angle = (i / petalCount) * Math.PI * 2;
        const px = flower.x + sway + Math.cos(angle) * flower.size;
        const py = flower.y - flower.size * 4 + Math.sin(angle) * flower.size;
        petals.circle(px, py, flower.size * 0.6);
      }
      petals.fill(flower.color);
      layer.addChild(petals);

      // Center
      const center = new Graphics();
      center.circle(flower.x + sway, flower.y - flower.size * 4, flower.size * 0.4);
      center.fill(0xffd700);
      layer.addChild(center);
    });
  }, []);

  // Beautiful butterflies
  const renderButterflies = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('butterflies') as Container;
    layer.removeChildren();

    const frame = frameRef.current;
    const width = app.screen.width;

    staticDataRef.current.butterflies.forEach(bf => {
      const t = frame * 0.02 + bf.phase;
      const x = (bf.x + frame * bf.speed) % (width + 100) - 50;
      const y = bf.y + Math.sin(t) * 30;
      const wingFlap = Math.sin(frame * 0.3 + bf.phase) * 0.5;

      const g = new Graphics();

      // Wings
      g.ellipse(x - 6, y, 8 * (0.5 + wingFlap), 5);
      g.ellipse(x + 6, y, 8 * (0.5 + wingFlap), 5);
      g.fill(bf.color);

      // Wing patterns
      g.ellipse(x - 6, y, 4 * (0.5 + wingFlap), 2.5);
      g.ellipse(x + 6, y, 4 * (0.5 + wingFlap), 2.5);
      g.fill(lerpColor(bf.color, 0xffffff, 0.5));

      // Body
      g.ellipse(x, y, 2, 6);
      g.fill(0x333333);

      layer.addChild(g);
    });
  }, []);

  // Flying birds
  const renderBirds = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('birds') as Container;
    layer.removeChildren();

    const frame = frameRef.current;
    const width = app.screen.width;

    if (worldState.timeOfDay === 'night') return;

    staticDataRef.current.birds.forEach(bird => {
      const x = (bird.x + frame * bird.speed) % (width + 100) - 50;
      const y = bird.y + Math.sin(frame * 0.03 + bird.wingPhase) * 10;
      const wingUp = Math.sin(frame * 0.2 + bird.wingPhase);

      const g = new Graphics();

      // Body
      g.ellipse(x, y, 8, 4);
      g.fill(0x333333);

      // Wings
      g.moveTo(x - 3, y);
      g.quadraticCurveTo(x - 10, y - 8 * wingUp, x - 15, y - 5 * wingUp);
      g.moveTo(x + 3, y);
      g.quadraticCurveTo(x + 10, y - 8 * wingUp, x + 15, y - 5 * wingUp);
      g.stroke({ width: 2, color: 0x333333 });

      layer.addChild(g);
    });
  }, [worldState.timeOfDay]);

  // Adorable player character
  const renderPlayer = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('entities') as Container;
    const old = layer.getChildByLabel('player');
    if (old) layer.removeChild(old);

    const container = new Container();
    container.label = 'player';

    const groundY = app.screen.height * 0.72;
    const width = app.screen.width;
    const frame = frameRef.current;

    // Update player movement when game is playing
    const isGameActive = isPlaying && !isPaused;

    if (isGameActive) {
      // Move towards random targets to simulate exploring
      if (frame % 120 === 0) {
        playerPosRef.current.targetX = 0.3 + Math.random() * 0.4; // Stay in middle area
      }

      const dx = playerPosRef.current.targetX - playerPosRef.current.x;
      if (Math.abs(dx) > 0.01) {
        playerPosRef.current.x += dx * 0.02;
        playerPosRef.current.direction = dx > 0 ? 1 : -1;
      }
    }

    const px = width * playerPosRef.current.x;
    const py = groundY;

    const breath = Math.sin(frame * 0.05) * 2;
    const isWalking = isGameActive && Math.abs(playerPosRef.current.targetX - playerPosRef.current.x) > 0.01;
    const isActive = !!currentAction || isWalking;
    const walk = isActive ? Math.sin(frame * 0.2) : 0;
    const bobY = Math.abs(walk) * 3;

    // Shadow
    const shadow = new Graphics();
    shadow.ellipse(0, 5, 22 + Math.abs(walk) * 2, 8);
    shadow.fill(0x000000);
    shadow.alpha = 0.25;
    container.addChild(shadow);

    // Health glow
    const hp = playerStats.health / 100;
    const glowColor = hp > 0.6 ? 0x4caf50 : hp > 0.3 ? 0xffc107 : 0xf44336;
    for (let i = 3; i >= 0; i--) {
      const glow = new Graphics();
      glow.circle(0, -40 - bobY, 40 + i * 10);
      glow.fill(glowColor);
      glow.alpha = (0.1 - i * 0.02) * (0.8 + Math.sin(frame * 0.06) * 0.2);
      container.addChild(glow);
    }

    const char = new Graphics();

    // Feet - cute round shoes
    char.ellipse(-8, -3 - bobY + walk * 2, 7, 5);
    char.fill(0x795548);
    char.ellipse(8, -3 - bobY - walk * 2, 7, 5);
    char.fill(0x795548);

    // Legs
    char.roundRect(-10, -20 - bobY, 8, 20, 3);
    char.fill(0x1976d2);
    char.roundRect(2, -20 - bobY, 8, 20, 3);
    char.fill(0x1976d2);

    // Body - bright shirt
    char.roundRect(-14, -52 + breath - bobY, 28, 35, 6);
    char.fill(0x42a5f5);

    // Shirt stripe
    char.roundRect(-3, -50 + breath - bobY, 6, 30, 2);
    char.fill(0x1976d2);

    // Arms
    char.roundRect(-20, -48 + breath - bobY - walk * 3, 8, 24, 4);
    char.fill(0x42a5f5);
    char.roundRect(12, -48 + breath - bobY + walk * 3, 8, 24, 4);
    char.fill(0x42a5f5);

    // Hands - skin tone
    char.circle(-16, -26 + breath - bobY - walk * 3, 5);
    char.fill(0xffcc80);
    char.circle(16, -26 + breath - bobY + walk * 3, 5);
    char.fill(0xffcc80);

    // Head
    char.circle(0, -65 + breath - bobY, 16);
    char.fill(0xffcc80);

    // Hair - fluffy
    char.ellipse(0, -78 + breath - bobY, 14, 8);
    char.fill(0x5d4037);
    char.ellipse(-8, -72 + breath - bobY, 7, 6);
    char.fill(0x5d4037);
    char.ellipse(8, -72 + breath - bobY, 7, 6);
    char.fill(0x5d4037);
    char.circle(0, -70 + breath - bobY, 5);
    char.fill(0x5d4037);

    // Eyes - big and cute
    const blinkPhase = Math.floor(frame / 90) % 50;
    const eyeH = blinkPhase === 0 ? 1 : 5;

    // Eye whites
    char.ellipse(-6, -66 + breath - bobY, 5, eyeH);
    char.fill(0xffffff);
    char.ellipse(6, -66 + breath - bobY, 5, eyeH);
    char.fill(0xffffff);

    // Pupils
    if (blinkPhase !== 0) {
      char.ellipse(-6, -65 + breath - bobY, 3, 4);
      char.fill(0x333333);
      char.ellipse(6, -65 + breath - bobY, 3, 4);
      char.fill(0x333333);

      // Eye shine
      char.circle(-5, -67 + breath - bobY, 1.5);
      char.fill(0xffffff);
      char.circle(7, -67 + breath - bobY, 1.5);
      char.fill(0xffffff);
    }

    // Rosy cheeks
    char.ellipse(-10, -60 + breath - bobY, 4, 2);
    char.fill(0xffab91);
    char.alpha = 0.6;
    char.ellipse(10, -60 + breath - bobY, 4, 2);
    char.fill(0xffab91);

    // Mouth
    if (hp > 0.5) {
      char.arc(0, -58 + breath - bobY, 4, 0.1, Math.PI - 0.1);
      char.stroke({ width: 2, color: 0x333333 });
    } else if (hp > 0.25) {
      char.moveTo(-3, -57 + breath - bobY);
      char.lineTo(3, -57 + breath - bobY);
      char.stroke({ width: 2, color: 0x333333 });
    } else {
      char.arc(0, -55 + breath - bobY, 3, Math.PI + 0.2, -0.2);
      char.stroke({ width: 2, color: 0x333333 });
    }

    container.addChild(char);
    container.x = px;
    container.y = py;

    // Flip character based on direction
    container.scale.x = playerPosRef.current.direction;

    // Action bubble
    if (currentAction) {
      // Thought bubbles
      for (let i = 0; i < 3; i++) {
        const bubble = new Graphics();
        bubble.circle(-25 + i * 6, -90 + i * 8 - bobY, 4 - i);
        bubble.fill(0xffffff);
        container.addChild(bubble);
      }

      // Main bubble
      const bubbleW = Math.min(currentAction.length * 7 + 24, 180);
      const mainBubble = new Graphics();
      mainBubble.roundRect(-bubbleW / 2, -130 - bobY, bubbleW, 35, 12);
      mainBubble.fill(0xffffff);
      container.addChild(mainBubble);

      // Bubble border
      const border = new Graphics();
      border.roundRect(-bubbleW / 2, -130 - bobY, bubbleW, 35, 12);
      border.stroke({ width: 2, color: 0x42a5f5 });
      container.addChild(border);

      const txt = new Text({
        text: currentAction.length > 20 ? currentAction.slice(0, 20) + '...' : currentAction,
        style: new TextStyle({
          fontFamily: 'system-ui, sans-serif',
          fontSize: 12,
          fontWeight: '600',
          fill: 0x333333,
        }),
      });
      txt.anchor.set(0.5);
      txt.y = -112 - bobY;
      container.addChild(txt);
    }

    layer.addChild(container);
  }, [playerStats.health, currentAction, isPlaying, isPaused]);

  // Cute enemies
  const renderThreats = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('entities') as Container;
    layer.children.filter(c => c.label?.startsWith('enemy_')).forEach(c => layer.removeChild(c));

    const groundY = app.screen.height * 0.72;
    const frame = frameRef.current;

    worldState.threats.forEach((threat, i) => {
      const container = new Container();
      container.label = `enemy_${i}`;

      const x = 120 + i * 180;
      const y = groundY;
      const bounce = Math.sin(frame * 0.08 + i * 2) * 3;

      // Shadow
      const shadow = new Graphics();
      shadow.ellipse(0, 5, 25, 8);
      shadow.fill(0x000000);
      shadow.alpha = 0.2;
      container.addChild(shadow);

      // Danger glow
      const danger = new Graphics();
      danger.circle(0, -20 - bounce, 50);
      danger.fill(0xff5252);
      danger.alpha = 0.1 + Math.sin(frame * 0.1) * 0.05;
      container.addChild(danger);

      const enemy = new Graphics();

      if (threat.toLowerCase().includes('wolf')) {
        // Cute but fierce wolf
        // Body
        enemy.ellipse(0, -18 - bounce, 35, 18);
        enemy.fill(0x78909c);

        // Head
        enemy.ellipse(-30, -22 - bounce, 18, 15);
        enemy.fill(0x90a4ae);

        // Snout
        enemy.ellipse(-45, -18 - bounce, 10, 7);
        enemy.fill(0x607d8b);

        // Nose
        enemy.circle(-52, -18 - bounce, 4);
        enemy.fill(0x333333);

        // Ears
        enemy.moveTo(-38, -35 - bounce);
        enemy.lineTo(-34, -50 - bounce);
        enemy.lineTo(-28, -35 - bounce);
        enemy.fill(0x78909c);
        enemy.moveTo(-24, -35 - bounce);
        enemy.lineTo(-20, -50 - bounce);
        enemy.lineTo(-14, -35 - bounce);
        enemy.fill(0x78909c);

        // Eyes - angry
        enemy.ellipse(-35, -24 - bounce, 4, 3);
        enemy.fill(0xffeb3b);
        enemy.circle(-35, -24 - bounce, 2);
        enemy.fill(0x333333);

        // Angry eyebrows
        enemy.moveTo(-40, -30 - bounce);
        enemy.lineTo(-30, -28 - bounce);
        enemy.stroke({ width: 2, color: 0x333333 });

        // Tail
        enemy.moveTo(30, -18 - bounce);
        enemy.quadraticCurveTo(45, -30 - bounce + Math.sin(frame * 0.1) * 5, 40, -10 - bounce);
        enemy.stroke({ width: 6, color: 0x90a4ae, cap: 'round' });

        // Legs
        [-15, 0, 15, 25].forEach((lx, li) => {
          const legBounce = Math.sin(frame * 0.15 + li * Math.PI / 2) * 2;
          enemy.roundRect(lx - 4, -5 + legBounce, 8, 12, 3);
          enemy.fill(0x607d8b);
        });

      } else if (threat.toLowerCase().includes('bear')) {
        // Chonky bear
        // Body
        enemy.ellipse(0, -30 - bounce, 45, 30);
        enemy.fill(0x795548);

        // Belly
        enemy.ellipse(5, -22 - bounce, 28, 22);
        enemy.fill(0x8d6e63);

        // Head
        enemy.circle(-40, -45 - bounce, 25);
        enemy.fill(0x8d6e63);

        // Snout
        enemy.ellipse(-58, -40 - bounce, 12, 9);
        enemy.fill(0x6d4c41);

        // Nose
        enemy.ellipse(-65, -42 - bounce, 5, 4);
        enemy.fill(0x333333);

        // Ears
        enemy.circle(-55, -68 - bounce, 10);
        enemy.fill(0x795548);
        enemy.circle(-55, -68 - bounce, 5);
        enemy.fill(0x5d4037);
        enemy.circle(-25, -68 - bounce, 10);
        enemy.fill(0x795548);
        enemy.circle(-25, -68 - bounce, 5);
        enemy.fill(0x5d4037);

        // Eyes
        enemy.circle(-48, -48 - bounce, 5);
        enemy.fill(0x333333);
        enemy.circle(-48, -49 - bounce, 2);
        enemy.fill(0xffffff);
        enemy.circle(-32, -48 - bounce, 5);
        enemy.fill(0x333333);
        enemy.circle(-32, -49 - bounce, 2);
        enemy.fill(0xffffff);

        // Legs
        [-25, -10, 10, 25].forEach((lx) => {
          enemy.roundRect(lx - 7, -8, 14, 18, 5);
          enemy.fill(0x5d4037);
        });

      } else {
        // Generic slime enemy
        const squish = 1 + Math.sin(frame * 0.1) * 0.1;
        enemy.ellipse(0, -15 - bounce, 30 / squish, 25 * squish);
        enemy.fill(0x9c27b0);

        // Shine
        enemy.ellipse(-8, -25 - bounce, 8, 6);
        enemy.fill(0xe1bee7);

        // Eyes
        enemy.ellipse(-8, -18 - bounce, 5, 6);
        enemy.fill(0xffffff);
        enemy.ellipse(8, -18 - bounce, 5, 6);
        enemy.fill(0xffffff);
        enemy.circle(-8, -17 - bounce, 3);
        enemy.fill(0x333333);
        enemy.circle(8, -17 - bounce, 3);
        enemy.fill(0x333333);

        // Angry mouth
        enemy.arc(0, -8 - bounce, 8, 0.2, Math.PI - 0.2);
        enemy.stroke({ width: 2, color: 0x333333 });
      }

      container.addChild(enemy);
      container.x = x;
      container.y = y;
      layer.addChild(container);
    });
  }, [worldState.threats]);

  // Weather particles
  const renderWeather = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('weather') as Container;
    layer.removeChildren();

    const width = app.screen.width;
    const height = app.screen.height;
    const frame = frameRef.current;

    if (worldState.weather === 'rain' || worldState.weather === 'storm') {
      const intensity = worldState.weather === 'storm' ? 120 : 60;

      for (let i = 0; i < intensity; i++) {
        const x = ((seededRandom(i * 1000) * width * 1.2) + frame * 3) % (width * 1.2) - width * 0.1;
        const y = ((frame * 12 + seededRandom(i * 1001) * height * 1.5) % (height * 1.5)) - height * 0.2;

        const drop = new Graphics();
        drop.moveTo(x, y);
        drop.lineTo(x + 2, y + 15);
        drop.stroke({ width: 2, color: 0x64b5f6, alpha: 0.6 });
        layer.addChild(drop);
      }

      // Lightning
      if (worldState.weather === 'storm' && Math.sin(frame * 0.1) > 0.98) {
        const flash = new Graphics();
        flash.rect(0, 0, width, height);
        flash.fill(0xffffff);
        flash.alpha = 0.4;
        layer.addChild(flash);
      }
    }
  }, [worldState.weather]);

  // UI overlay
  const renderUI = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('ui') as Container;
    layer.removeChildren();

    const width = app.screen.width;
    const height = app.screen.height;

    // Location badge
    const locBg = new Graphics();
    locBg.roundRect(12, 12, 180, 40, 12);
    locBg.fill(0xffffff);
    locBg.alpha = 0.95;
    layer.addChild(locBg);

    const locBorder = new Graphics();
    locBorder.roundRect(12, 12, 180, 40, 12);
    locBorder.stroke({ width: 2, color: 0x4caf50 });
    layer.addChild(locBorder);

    const locTxt = new Text({
      text: `📍 ${worldState.currentLocation}`,
      style: new TextStyle({ fontFamily: 'system-ui', fontSize: 14, fontWeight: '700', fill: 0x333333 }),
    });
    locTxt.x = 24;
    locTxt.y = 22;
    layer.addChild(locTxt);

    // Weather badge
    const weatherEmoji: Record<string, string> = { clear: '☀️', cloudy: '⛅', rain: '🌧️', storm: '⛈️' };
    const tempColor = worldState.temperature < 10 ? 0x2196f3 : worldState.temperature > 30 ? 0xf44336 : 0x4caf50;

    const wBg = new Graphics();
    wBg.roundRect(width - 120, 12, 108, 40, 12);
    wBg.fill(0xffffff);
    wBg.alpha = 0.95;
    layer.addChild(wBg);

    const wBorder = new Graphics();
    wBorder.roundRect(width - 120, 12, 108, 40, 12);
    wBorder.stroke({ width: 2, color: tempColor });
    layer.addChild(wBorder);

    const wTxt = new Text({
      text: `${weatherEmoji[worldState.weather]} ${worldState.temperature}°C`,
      style: new TextStyle({ fontFamily: 'system-ui', fontSize: 14, fontWeight: '700', fill: tempColor }),
    });
    wTxt.x = width - 105;
    wTxt.y = 22;
    layer.addChild(wTxt);

    // Day badge
    const dayBg = new Graphics();
    dayBg.roundRect(width - 100, height - 50, 88, 38, 10);
    dayBg.fill(0xffffff);
    dayBg.alpha = 0.95;
    layer.addChild(dayBg);

    const dayBorder = new Graphics();
    dayBorder.roundRect(width - 100, height - 50, 88, 38, 10);
    dayBorder.stroke({ width: 2, color: 0xff9800 });
    layer.addChild(dayBorder);

    const dayTxt = new Text({
      text: `🌅 Day ${worldState.daysSurvived + 1}`,
      style: new TextStyle({ fontFamily: 'system-ui', fontSize: 13, fontWeight: 'bold', fill: 0xff9800 }),
    });
    dayTxt.x = width - 88;
    dayTxt.y = height - 40;
    layer.addChild(dayTxt);
  }, [worldState]);

  // Main loop
  useEffect(() => {
    if (!isLoaded || !appRef.current) return;

    let animId: number;
    let lastTime = 0;

    const loop = (time: number) => {
      if (time - lastTime >= 16.67) {
        lastTime = time;
        frameRef.current++;

        renderSky();
        renderSkyEffects();
        renderClouds();
        renderMountains();
        renderTrees();
        renderWater();
        renderGround();
        renderBushes();
        renderFlowers();
        renderButterflies();
        renderBirds();
        renderPlayer();
        renderThreats();
        renderWeather();
        renderUI();
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isLoaded, renderSky, renderSkyEffects, renderClouds, renderMountains, renderTrees, renderWater, renderGround, renderBushes, renderFlowers, renderButterflies, renderBirds, renderPlayer, renderThreats, renderWeather, renderUI]);

  // Resize
  useEffect(() => {
    const onResize = () => {
      if (appRef.current && containerRef.current) {
        appRef.current.renderer.resize(containerRef.current.clientWidth, 500);
        staticDataRef.current.initialized = false;
        initStaticData(containerRef.current.clientWidth, 500);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [initStaticData]);

  return (
    <div className="relative w-full rounded-3xl overflow-hidden shadow-2xl shadow-green-500/20 border-4 border-white/20 bg-gradient-to-b from-sky-400 to-sky-500">
      <div ref={containerRef} className="w-full" style={{ height: 500 }} />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-sky-400 to-green-400">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl animate-bounce">🌲</span>
              </div>
            </div>
            <span className="text-white font-bold text-lg drop-shadow-lg">Loading Adventure...</span>
          </div>
        </div>
      )}
    </div>
  );
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return ((Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t));
}
