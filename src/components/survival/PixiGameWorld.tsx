'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { useSurvivalStore } from '@/store/survival';

// Seeded random for consistent positions
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// VIBRANT COLOR PALETTES
const COLORS = {
  sky: {
    dawn: { top: 0xff6b9d, mid: 0xffd93d, bottom: 0xffe4b5, sun: 0xffe66d, clouds: 0xffb8d0 },
    day: { top: 0x1e90ff, mid: 0x4fc3f7, bottom: 0x87ceeb, sun: 0xffeb3b, clouds: 0xffffff },
    dusk: { top: 0xff6b6b, mid: 0xfeca57, bottom: 0xffb347, sun: 0xff9f43, clouds: 0xffa07a },
    night: { top: 0x0d1b2a, mid: 0x1b263b, bottom: 0x415a77, moon: 0xf0f8ff, clouds: 0x3a506b, stars: 0xffffff },
  },
  ground: {
    grass: 0x4caf50,
    grassLight: 0x8bc34a,
    path: 0xbcaaa4,
    flowers: [0xff6b6b, 0xffd93d, 0x74b9ff, 0xfd79a8, 0xa29bfe],
  },
  water: { deep: 0x0077b6, shallow: 0x48cae4, foam: 0xffffff },
};

// Particle system
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
  type: 'wood' | 'leaf' | 'sparkle' | 'dust' | 'food' | 'water' | 'heart' | 'star' | 'hit';
}

// Floating text popup
interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: number;
  life: number;
  maxLife: number;
}

// Action types for animations
type ActionType = 'idle' | 'walking' | 'chopping' | 'gathering' | 'eating' | 'drinking' | 'fighting' | 'building' | 'resting' | 'fishing';

interface StaticData {
  backTrees: TreeData[];
  midTrees: TreeData[];
  frontTrees: TreeData[];
  stars: StarData[];
  clouds: CloudData[];
  flowers: FlowerData[];
  butterflies: ButterflyData[];
  birds: BirdData[];
  bushes: { x: number; size: number; color: number }[];
  resourceNodes: ResourceNode[];
  initialized: boolean;
}

interface TreeData {
  x: number; height: number; variant: number; sway: number; trunkColor: number; leafColor: number;
}
interface FlowerData {
  x: number; y: number; color: number; size: number; swayOffset: number;
}
interface ButterflyData {
  x: number; y: number; color: number; phase: number; speed: number;
}
interface CloudData {
  x: number; y: number; width: number; puffs: { dx: number; dy: number; r: number }[]; speed: number;
}
interface StarData {
  x: number; y: number; size: number; twinkleSpeed: number; color: number;
}
interface BirdData {
  x: number; y: number; speed: number; wingPhase: number;
}
interface ResourceNode {
  x: number; y: number; type: 'tree' | 'berry' | 'rock' | 'water'; size: number; depleted: boolean;
}

export function PixiGameWorld() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const frameRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const lastActionRef = useRef<string>('');

  const staticDataRef = useRef<StaticData>({
    backTrees: [], midTrees: [], frontTrees: [], stars: [], clouds: [],
    flowers: [], butterflies: [], birds: [], bushes: [], resourceNodes: [],
    initialized: false,
  });

  const [isLoaded, setIsLoaded] = useState(false);
  const { worldState, playerStats, currentAction, isPlaying, isPaused, inventory } = useSurvivalStore();

  // Player state
  const playerRef = useRef({
    x: 0.5, targetX: 0.5, direction: 1,
    actionType: 'idle' as ActionType,
    actionProgress: 0,
    tool: null as string | null,
  });

  // Detect action type from currentAction string
  const getActionType = useCallback((action: string): ActionType => {
    const a = action.toLowerCase();
    if (a.includes('chop') || a.includes('cut') || a.includes('wood')) return 'chopping';
    if (a.includes('gather') || a.includes('pick') || a.includes('collect') || a.includes('berr')) return 'gathering';
    if (a.includes('eat') || a.includes('food') || a.includes('consume')) return 'eating';
    if (a.includes('drink') || a.includes('water')) return 'drinking';
    if (a.includes('fight') || a.includes('attack') || a.includes('defend') || a.includes('hunt')) return 'fighting';
    if (a.includes('build') || a.includes('craft') || a.includes('make') || a.includes('shelter')) return 'building';
    if (a.includes('rest') || a.includes('sleep') || a.includes('recover')) return 'resting';
    if (a.includes('fish')) return 'fishing';
    if (a.includes('walk') || a.includes('move') || a.includes('go') || a.includes('travel')) return 'walking';
    return 'idle';
  }, []);

  // Spawn particles
  const spawnParticles = useCallback((x: number, y: number, type: Particle['type'], count: number = 5) => {
    const colors: Record<string, number[]> = {
      wood: [0x8B4513, 0xA0522D, 0xD2691E],
      leaf: [0x228B22, 0x32CD32, 0x90EE90],
      sparkle: [0xFFD700, 0xFFF8DC, 0xFFFFE0],
      dust: [0xD2B48C, 0xDEB887, 0xF5DEB3],
      food: [0xFF6B6B, 0xFFD93D, 0x90EE90],
      water: [0x48CAE4, 0x0077B6, 0x90E0EF],
      heart: [0xFF69B4, 0xFF1493, 0xFF6B6B],
      star: [0xFFD700, 0xFFA500, 0xFFFF00],
      hit: [0xFF4444, 0xFF6666, 0xFFAAAA],
    };

    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x, y,
        vx: (Math.random() - 0.5) * 8,
        vy: -Math.random() * 6 - 2,
        life: 60 + Math.random() * 30,
        maxLife: 60,
        color: colors[type][Math.floor(Math.random() * colors[type].length)],
        size: 3 + Math.random() * 4,
        type,
      });
    }
  }, []);

  // Spawn floating text
  const spawnFloatingText = useCallback((x: number, y: number, text: string, color: number) => {
    floatingTextsRef.current.push({
      x, y, text, color, life: 90, maxLife: 90,
    });
  }, []);

  // Initialize static data
  const initStaticData = useCallback((width: number, height: number) => {
    if (staticDataRef.current.initialized) return;

    const groundY = height * 0.72;
    const data = staticDataRef.current;

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

    // Front trees
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

    // Clouds
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
        width: baseWidth, puffs,
        speed: 0.15 + seededRandom(i * 83 + 400) * 0.2,
      });
    }

    // Flowers
    data.flowers = [];
    for (let i = 0; i < 60; i++) {
      const x = seededRandom(i * 89 + 500) * width;
      if (x > width * 0.35 && x < width * 0.65) continue;
      data.flowers.push({
        x, y: groundY + seededRandom(i * 97 + 500) * 15 - 5,
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
        x, size: 15 + seededRandom(i * 143 + 800) * 20,
        color: leafColors[Math.floor(seededRandom(i * 149 + 800) * leafColors.length)],
      });
    }

    // Resource nodes for interaction
    data.resourceNodes = [];
    // Berry bushes
    for (let i = 0; i < 4; i++) {
      const x = seededRandom(i * 200) * width * 0.3 + (i % 2 === 0 ? 0 : width * 0.7);
      data.resourceNodes.push({
        x, y: groundY, type: 'berry', size: 25, depleted: false,
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
        'treesBack', 'treesMid', 'water', 'ground', 'bushes', 'resources',
        'flowers', 'treesFront', 'butterflies', 'entities', 'birds',
        'particles', 'floatingText', 'weather', 'ui'
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

  // Trigger effects when action changes
  useEffect(() => {
    if (currentAction && currentAction !== lastActionRef.current) {
      lastActionRef.current = currentAction;
      const actionType = getActionType(currentAction);
      playerRef.current.actionType = actionType;
      playerRef.current.actionProgress = 0;

      // Spawn particles and text based on action
      const app = appRef.current;
      if (app) {
        const px = app.screen.width * playerRef.current.x;
        const groundY = app.screen.height * 0.72;

        switch (actionType) {
          case 'chopping':
            playerRef.current.tool = 'axe';
            spawnParticles(px + 30, groundY - 60, 'wood', 8);
            spawnFloatingText(px, groundY - 120, '+1 🪵', 0x8B4513);
            break;
          case 'gathering':
            spawnParticles(px, groundY - 40, 'leaf', 6);
            spawnParticles(px, groundY - 40, 'sparkle', 4);
            spawnFloatingText(px, groundY - 100, '+1 🫐', 0x6B5B95);
            break;
          case 'eating':
            spawnParticles(px, groundY - 70, 'food', 5);
            spawnParticles(px, groundY - 80, 'heart', 3);
            spawnFloatingText(px, groundY - 110, '+10 ❤️', 0xFF6B6B);
            break;
          case 'drinking':
            spawnParticles(px, groundY - 60, 'water', 6);
            spawnFloatingText(px, groundY - 100, '+15 💧', 0x48CAE4);
            break;
          case 'fighting':
            playerRef.current.tool = 'sword';
            spawnParticles(px + 40, groundY - 50, 'hit', 10);
            spawnParticles(px + 40, groundY - 50, 'star', 5);
            spawnFloatingText(px + 40, groundY - 80, 'POW! 💥', 0xFF4444);
            break;
          case 'building':
            playerRef.current.tool = 'hammer';
            spawnParticles(px, groundY - 50, 'wood', 6);
            spawnParticles(px, groundY - 50, 'dust', 8);
            spawnFloatingText(px, groundY - 100, '🔨 Building!', 0xFFAA00);
            break;
          case 'resting':
            spawnParticles(px, groundY - 80, 'sparkle', 3);
            spawnFloatingText(px, groundY - 100, '💤 Zzz...', 0x9999FF);
            break;
          case 'fishing':
            playerRef.current.tool = 'rod';
            spawnParticles(px + 50, groundY + 20, 'water', 4);
            break;
        }
      }
    }
  }, [currentAction, getActionType, spawnParticles, spawnFloatingText]);

  // Render sky gradient
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
    for (let i = 0; i < 100; i++) {
      const t = i / 100;
      const color = t < 0.5 ? lerpColor(top, mid, t * 2) : lerpColor(mid, bottom, (t - 0.5) * 2);
      sky.rect(0, t * height, width, height / 100 + 1);
      sky.fill(color);
    }
    layer.addChild(sky);
  }, [worldState.timeOfDay]);

  // Render sky effects (sun/moon/stars)
  const renderSkyEffects = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('skyEffects') as Container;
    layer.removeChildren();

    const time = worldState.timeOfDay;
    const width = app.screen.width;
    const frame = frameRef.current;

    if (time === 'night') {
      staticDataRef.current.stars.forEach(star => {
        const twinkle = 0.5 + Math.sin(frame * star.twinkleSpeed + star.x) * 0.5;
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

      // Moon
      const moonX = width - 100, moonY = 80;
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
    } else {
      const sunPos: Record<string, { x: number; y: number }> = {
        dawn: { x: 120, y: 180 }, day: { x: width / 2, y: 80 }, dusk: { x: width - 120, y: 180 },
      };
      const pos = sunPos[time];
      if (!pos) return;

      const sunColor = COLORS.sky[time as keyof typeof COLORS.sky];
      const color = 'sun' in sunColor ? sunColor.sun : 0xffeb3b;

      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + frame * 0.003;
        const ray = new Graphics();
        const innerR = 50, outerR = 80 + Math.sin(frame * 0.05 + i) * 15;
        ray.moveTo(pos.x + Math.cos(angle) * innerR, pos.y + Math.sin(angle) * innerR);
        ray.lineTo(pos.x + Math.cos(angle) * outerR, pos.y + Math.sin(angle) * outerR);
        ray.stroke({ width: 4, color, alpha: 0.3 });
        layer.addChild(ray);
      }

      for (let i = 6; i >= 0; i--) {
        const g = new Graphics();
        g.circle(pos.x, pos.y, 35 + i * 15);
        g.fill(color);
        g.alpha = 0.08;
        layer.addChild(g);
      }

      const sun = new Graphics();
      sun.circle(pos.x, pos.y, 35);
      sun.fill(color);
      layer.addChild(sun);
    }
  }, [worldState.timeOfDay]);

  // Render clouds
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
      cloud.puffs.forEach(puff => g.circle(x + puff.dx, cloud.y + puff.dy, puff.r));
      g.fill(cloudColor);
      g.alpha = time === 'night' ? 0.4 : 0.9;
      layer.addChild(g);
    });
  }, [worldState.timeOfDay]);

  // Render mountains
  const renderMountains = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('mountains') as Container;
    if (layer.children.length > 0) return;

    const width = app.screen.width;
    const groundY = app.screen.height * 0.72;

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

  // Render trees with animation
  const renderTrees = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const groundY = app.screen.height * 0.72;
    const frame = frameRef.current;

    const drawTree = (g: Graphics, tree: TreeData, baseY: number, scale: number) => {
      const x = tree.x;
      const h = tree.height * scale;
      const sway = Math.sin(frame * 0.01 + tree.sway) * 3 * scale;

      const tw = 10 * scale, th = h * 0.3;
      g.roundRect(x - tw / 2, baseY - th, tw, th + 5, 3);
      g.fill(tree.trunkColor);

      const layers = [
        { yOff: -th, w: h * 0.6, hh: h * 0.4 },
        { yOff: -th - h * 0.25, w: h * 0.5, hh: h * 0.35 },
        { yOff: -th - h * 0.45, w: h * 0.35, hh: h * 0.3 },
      ];

      layers.forEach((l, i) => {
        const layerSway = sway * (1 + i * 0.2);
        g.moveTo(x + layerSway, baseY + l.yOff - l.hh);
        g.lineTo(x - l.w / 2 + layerSway * 0.8, baseY + l.yOff);
        g.lineTo(x + l.w / 2 + layerSway * 1.2, baseY + l.yOff);
        g.closePath();
        g.fill(tree.leafColor);
      });
    };

    ['treesBack', 'treesMid', 'treesFront'].forEach((layerName, li) => {
      const layer = app.stage.getChildByLabel(layerName) as Container;
      layer.removeChildren();
      const g = new Graphics();
      const trees = [staticDataRef.current.backTrees, staticDataRef.current.midTrees, staticDataRef.current.frontTrees][li];
      const scales = [0.6, 0.8, 1.0];
      const offsets = [-30, -15, 10];
      trees.forEach(t => drawTree(g, t, groundY + offsets[li], scales[li]));
      layer.addChild(g);
    });
  }, []);

  // Render water
  const renderWater = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('water') as Container;
    layer.removeChildren();

    const groundY = app.screen.height * 0.72;
    const width = app.screen.width;
    const frame = frameRef.current;

    const water = new Graphics();
    water.roundRect(width * 0.05, groundY + 20, width * 0.25, 30, 10);
    water.fill(COLORS.water.deep);
    layer.addChild(water);

    const surface = new Graphics();
    surface.roundRect(width * 0.05, groundY + 20, width * 0.25, 8, 5);
    surface.fill(COLORS.water.shallow);
    layer.addChild(surface);

    for (let i = 0; i < 8; i++) {
      const sparkleX = width * 0.05 + 20 + seededRandom(i * 151) * (width * 0.25 - 40);
      const sparkleAlpha = 0.3 + Math.sin(frame * 0.1 + i * 2) * 0.3;
      if (sparkleAlpha > 0.3) {
        const sparkle = new Graphics();
        sparkle.circle(sparkleX, groundY + 24, 2);
        sparkle.fill(0xffffff);
        sparkle.alpha = sparkleAlpha;
        layer.addChild(sparkle);
      }
    }
  }, []);

  // Render ground
  const renderGround = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('ground') as Container;
    layer.removeChildren();

    const groundY = app.screen.height * 0.72;
    const width = app.screen.width;
    const height = app.screen.height;

    const ground = new Graphics();
    ground.rect(0, groundY, width, height - groundY);
    ground.fill(COLORS.ground.grass);
    layer.addChild(ground);

    for (let i = 0; i < 50; i++) {
      const patch = new Graphics();
      const px = seededRandom(i * 157 + 900) * width;
      const py = groundY + seededRandom(i * 163 + 900) * (height - groundY - 20);
      patch.ellipse(px, py, 30 + seededRandom(i * 167 + 900) * 40, 10);
      patch.fill(seededRandom(i * 173 + 900) > 0.5 ? COLORS.ground.grassLight : 0x43a047);
      patch.alpha = 0.5;
      layer.addChild(patch);
    }

    const pathWidth = width * 0.3;
    const pathX = (width - pathWidth) / 2;
    const path = new Graphics();
    path.roundRect(pathX, groundY - 3, pathWidth, 25, 12);
    path.fill(COLORS.ground.path);
    layer.addChild(path);
  }, []);

  // Render bushes
  const renderBushes = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('bushes') as Container;
    layer.removeChildren();

    const groundY = app.screen.height * 0.72;
    const frame = frameRef.current;

    staticDataRef.current.bushes.forEach((bush, i) => {
      const sway = Math.sin(frame * 0.015 + i) * 2;
      const main = new Graphics();
      main.circle(bush.x + sway, groundY - bush.size * 0.5, bush.size);
      main.circle(bush.x - bush.size * 0.4 + sway * 0.8, groundY - bush.size * 0.3, bush.size * 0.7);
      main.circle(bush.x + bush.size * 0.4 + sway * 1.2, groundY - bush.size * 0.3, bush.size * 0.7);
      main.fill(bush.color);
      layer.addChild(main);
    });
  }, []);

  // Render flowers
  const renderFlowers = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('flowers') as Container;
    layer.removeChildren();

    const frame = frameRef.current;

    staticDataRef.current.flowers.forEach(flower => {
      const sway = Math.sin(frame * 0.02 + flower.swayOffset) * 2;

      const stem = new Graphics();
      stem.moveTo(flower.x, flower.y);
      stem.quadraticCurveTo(flower.x + sway * 0.5, flower.y - flower.size * 2, flower.x + sway, flower.y - flower.size * 4);
      stem.stroke({ width: 2, color: 0x4caf50 });
      layer.addChild(stem);

      const petals = new Graphics();
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const px = flower.x + sway + Math.cos(angle) * flower.size;
        const py = flower.y - flower.size * 4 + Math.sin(angle) * flower.size;
        petals.circle(px, py, flower.size * 0.6);
      }
      petals.fill(flower.color);
      layer.addChild(petals);

      const center = new Graphics();
      center.circle(flower.x + sway, flower.y - flower.size * 4, flower.size * 0.4);
      center.fill(0xffd700);
      layer.addChild(center);
    });
  }, []);

  // Render butterflies
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
      g.ellipse(x - 6, y, 8 * (0.5 + wingFlap), 5);
      g.ellipse(x + 6, y, 8 * (0.5 + wingFlap), 5);
      g.fill(bf.color);
      g.ellipse(x, y, 2, 6);
      g.fill(0x333333);
      layer.addChild(g);
    });
  }, []);

  // Render birds
  const renderBirds = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('birds') as Container;
    layer.removeChildren();

    if (worldState.timeOfDay === 'night') return;

    const frame = frameRef.current;
    const width = app.screen.width;

    staticDataRef.current.birds.forEach(bird => {
      const x = (bird.x + frame * bird.speed) % (width + 100) - 50;
      const y = bird.y + Math.sin(frame * 0.03 + bird.wingPhase) * 10;
      const wingUp = Math.sin(frame * 0.2 + bird.wingPhase);

      const g = new Graphics();
      g.ellipse(x, y, 8, 4);
      g.fill(0x333333);
      g.moveTo(x - 3, y);
      g.quadraticCurveTo(x - 10, y - 8 * wingUp, x - 15, y - 5 * wingUp);
      g.moveTo(x + 3, y);
      g.quadraticCurveTo(x + 10, y - 8 * wingUp, x + 15, y - 5 * wingUp);
      g.stroke({ width: 2, color: 0x333333 });
      layer.addChild(g);
    });
  }, [worldState.timeOfDay]);

  // Render awesome player character with actions
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

    const isGameActive = isPlaying && !isPaused;
    const player = playerRef.current;

    // Movement logic
    if (isGameActive) {
      if (frame % 120 === 0) {
        player.targetX = 0.3 + Math.random() * 0.4;
      }
      const dx = player.targetX - player.x;
      if (Math.abs(dx) > 0.01) {
        player.x += dx * 0.02;
        player.direction = dx > 0 ? 1 : -1;
      }
      player.actionProgress = Math.min(1, player.actionProgress + 0.02);
    }

    const px = width * player.x;
    const py = groundY;

    let breath = Math.sin(frame * 0.05) * 2;
    const isWalking = isGameActive && Math.abs(player.targetX - player.x) > 0.01;
    const actionType = player.actionType;

    // Animation variables
    let walk = 0, bobY = 0, armSwing = 0, bodyTilt = 0;

    if (isWalking || actionType === 'walking') {
      walk = Math.sin(frame * 0.2);
      bobY = Math.abs(walk) * 3;
    }

    // Action-specific animations
    if (actionType === 'chopping') {
      armSwing = Math.sin(frame * 0.3) * 45;
      bodyTilt = Math.sin(frame * 0.3) * 5;
    } else if (actionType === 'gathering') {
      armSwing = Math.sin(frame * 0.15) * 20;
      bobY = Math.abs(Math.sin(frame * 0.15)) * 8;
    } else if (actionType === 'eating' || actionType === 'drinking') {
      armSwing = -30 + Math.sin(frame * 0.2) * 5;
    } else if (actionType === 'fighting') {
      armSwing = Math.sin(frame * 0.4) * 60;
      bodyTilt = Math.sin(frame * 0.4) * 8;
    } else if (actionType === 'building') {
      armSwing = Math.sin(frame * 0.25) * 35;
    } else if (actionType === 'resting') {
      bobY = -10;
      breath *= 2;
    }

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

    // Feet
    char.ellipse(-8, -3 - bobY + walk * 2, 7, 5);
    char.fill(0x795548);
    char.ellipse(8, -3 - bobY - walk * 2, 7, 5);
    char.fill(0x795548);

    // Legs
    char.roundRect(-10, -20 - bobY, 8, 20, 3);
    char.fill(0x1976d2);
    char.roundRect(2, -20 - bobY, 8, 20, 3);
    char.fill(0x1976d2);

    // Body
    char.roundRect(-14, -52 + breath - bobY, 28, 35, 6);
    char.fill(0x42a5f5);

    // Body tilt for actions
    container.rotation = (bodyTilt * Math.PI) / 180;

    // Arms with action animation
    const armY = -48 + breath - bobY;

    // Left arm
    char.save?.();
    char.roundRect(-20, armY - walk * 3, 8, 24, 4);
    char.fill(0x42a5f5);

    // Right arm (animated for actions)
    const rightArmX = 12;
    char.roundRect(rightArmX, armY + walk * 3, 8, 24, 4);
    char.fill(0x42a5f5);

    // Hands
    char.circle(-16, -26 + breath - bobY - walk * 3, 5);
    char.fill(0xffcc80);
    char.circle(16, -26 + breath - bobY + walk * 3, 5);
    char.fill(0xffcc80);

    // Head
    char.circle(0, -65 + breath - bobY, 16);
    char.fill(0xffcc80);

    // Hair
    char.ellipse(0, -78 + breath - bobY, 14, 8);
    char.fill(0x5d4037);
    char.ellipse(-8, -72 + breath - bobY, 7, 6);
    char.fill(0x5d4037);
    char.ellipse(8, -72 + breath - bobY, 7, 6);
    char.fill(0x5d4037);

    // Eyes
    const blinkPhase = Math.floor(frame / 90) % 50;
    const eyeH = blinkPhase === 0 ? 1 : 5;

    // Expression based on action/health
    let eyeOffsetY = 0;
    if (actionType === 'fighting') eyeOffsetY = -1;
    if (actionType === 'eating') eyeOffsetY = 1;

    char.ellipse(-6, -66 + breath - bobY + eyeOffsetY, 5, eyeH);
    char.fill(0xffffff);
    char.ellipse(6, -66 + breath - bobY + eyeOffsetY, 5, eyeH);
    char.fill(0xffffff);

    if (blinkPhase !== 0) {
      // Pupils - look in direction of action
      const lookX = actionType === 'fighting' ? 1 : 0;
      char.ellipse(-6 + lookX, -65 + breath - bobY + eyeOffsetY, 3, 4);
      char.fill(0x333333);
      char.ellipse(6 + lookX, -65 + breath - bobY + eyeOffsetY, 3, 4);
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
    char.ellipse(10, -60 + breath - bobY, 4, 2);
    char.fill(0xffab91);

    // Mouth based on action/health
    if (actionType === 'eating') {
      // Open mouth eating
      char.circle(0, -56 + breath - bobY, 4);
      char.fill(0x333333);
    } else if (actionType === 'fighting') {
      // Determined face
      char.moveTo(-4, -57 + breath - bobY);
      char.lineTo(4, -57 + breath - bobY);
      char.stroke({ width: 2, color: 0x333333 });
    } else if (hp > 0.5) {
      char.arc(0, -58 + breath - bobY, 4, 0.1, Math.PI - 0.1);
      char.stroke({ width: 2, color: 0x333333 });
    } else {
      char.arc(0, -55 + breath - bobY, 3, Math.PI + 0.2, -0.2);
      char.stroke({ width: 2, color: 0x333333 });
    }

    container.addChild(char);

    // Draw tool/weapon if holding one
    if (player.tool && isGameActive) {
      const tool = new Graphics();
      const toolX = 20;
      const toolY = -40 - bobY;

      if (player.tool === 'axe') {
        // Axe handle
        tool.roundRect(toolX, toolY, 4, 30, 2);
        tool.fill(0x8B4513);
        // Axe head
        tool.moveTo(toolX + 2, toolY);
        tool.lineTo(toolX + 15, toolY - 5);
        tool.lineTo(toolX + 15, toolY + 10);
        tool.lineTo(toolX + 2, toolY + 8);
        tool.closePath();
        tool.fill(0x888888);
      } else if (player.tool === 'sword') {
        // Sword
        tool.roundRect(toolX, toolY - 10, 4, 35, 2);
        tool.fill(0x888888);
        // Hilt
        tool.roundRect(toolX - 5, toolY + 20, 14, 5, 2);
        tool.fill(0x8B4513);
      } else if (player.tool === 'hammer') {
        // Hammer handle
        tool.roundRect(toolX, toolY, 4, 28, 2);
        tool.fill(0x8B4513);
        // Hammer head
        tool.roundRect(toolX - 5, toolY - 8, 14, 10, 2);
        tool.fill(0x666666);
      }

      tool.rotation = (armSwing * Math.PI) / 180;
      container.addChild(tool);
    }

    container.x = px;
    container.y = py;
    container.scale.x = player.direction;

    // Action bubble
    if (currentAction) {
      for (let i = 0; i < 3; i++) {
        const bubble = new Graphics();
        bubble.circle(-25 * player.direction + i * 6 * player.direction, -90 + i * 8 - bobY, 4 - i);
        bubble.fill(0xffffff);
        container.addChild(bubble);
      }

      const bubbleW = Math.min(currentAction.length * 7 + 24, 180);
      const mainBubble = new Graphics();
      mainBubble.roundRect(-bubbleW / 2, -130 - bobY, bubbleW, 35, 12);
      mainBubble.fill(0xffffff);
      container.addChild(mainBubble);

      const border = new Graphics();
      border.roundRect(-bubbleW / 2, -130 - bobY, bubbleW, 35, 12);
      border.stroke({ width: 2, color: 0x42a5f5 });
      container.addChild(border);

      const txt = new Text({
        text: currentAction.length > 20 ? currentAction.slice(0, 20) + '...' : currentAction,
        style: new TextStyle({ fontFamily: 'system-ui', fontSize: 12, fontWeight: '600', fill: 0x333333 }),
      });
      txt.anchor.set(0.5);
      txt.y = -112 - bobY;
      txt.scale.x = player.direction;
      container.addChild(txt);
    }

    // Progress bar for current action
    if (currentAction && player.actionProgress < 1) {
      const barWidth = 60;
      const barBg = new Graphics();
      barBg.roundRect(-barWidth / 2, -145 - bobY, barWidth, 8, 4);
      barBg.fill(0x333333);
      barBg.alpha = 0.5;
      container.addChild(barBg);

      const bar = new Graphics();
      bar.roundRect(-barWidth / 2 + 1, -144 - bobY, (barWidth - 2) * player.actionProgress, 6, 3);
      bar.fill(0x4caf50);
      container.addChild(bar);
    }

    layer.addChild(container);
  }, [playerStats.health, currentAction, isPlaying, isPaused]);

  // Render threats/enemies
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

      // Danger glow
      const danger = new Graphics();
      danger.circle(0, -20 - bounce, 50);
      danger.fill(0xff5252);
      danger.alpha = 0.1 + Math.sin(frame * 0.1) * 0.05;
      container.addChild(danger);

      const enemy = new Graphics();

      if (threat.toLowerCase().includes('wolf')) {
        enemy.ellipse(0, -18 - bounce, 35, 18);
        enemy.fill(0x78909c);
        enemy.ellipse(-30, -22 - bounce, 18, 15);
        enemy.fill(0x90a4ae);
        enemy.circle(-52, -18 - bounce, 4);
        enemy.fill(0x333333);
        enemy.ellipse(-35, -24 - bounce, 4, 3);
        enemy.fill(0xffeb3b);
      } else if (threat.toLowerCase().includes('bear')) {
        enemy.ellipse(0, -30 - bounce, 45, 30);
        enemy.fill(0x795548);
        enemy.circle(-40, -45 - bounce, 25);
        enemy.fill(0x8d6e63);
        enemy.ellipse(-65, -42 - bounce, 5, 4);
        enemy.fill(0x333333);
      } else {
        const squish = 1 + Math.sin(frame * 0.1) * 0.1;
        enemy.ellipse(0, -15 - bounce, 30 / squish, 25 * squish);
        enemy.fill(0x9c27b0);
        enemy.ellipse(-8, -18 - bounce, 5, 6);
        enemy.fill(0xffffff);
        enemy.ellipse(8, -18 - bounce, 5, 6);
        enemy.fill(0xffffff);
      }

      container.addChild(enemy);
      container.x = x;
      container.y = y;
      layer.addChild(container);
    });
  }, [worldState.threats]);

  // Render particles
  const renderParticles = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('particles') as Container;
    layer.removeChildren();

    // Update and render particles
    particlesRef.current = particlesRef.current.filter(p => {
      p.life--;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravity
      p.vx *= 0.98; // drag

      if (p.life <= 0) return false;

      const alpha = p.life / p.maxLife;
      const g = new Graphics();

      if (p.type === 'sparkle' || p.type === 'star') {
        // Star shape for sparkles
        g.circle(p.x, p.y, p.size * alpha);
        g.fill(p.color);
        g.alpha = alpha;
      } else if (p.type === 'heart') {
        // Simple heart
        g.circle(p.x - 2, p.y, p.size * 0.6 * alpha);
        g.circle(p.x + 2, p.y, p.size * 0.6 * alpha);
        g.moveTo(p.x, p.y + p.size * alpha);
        g.lineTo(p.x - 4, p.y);
        g.lineTo(p.x + 4, p.y);
        g.closePath();
        g.fill(p.color);
        g.alpha = alpha;
      } else {
        g.circle(p.x, p.y, p.size * alpha);
        g.fill(p.color);
        g.alpha = alpha;
      }

      layer.addChild(g);
      return true;
    });
  }, []);

  // Render floating text
  const renderFloatingText = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('floatingText') as Container;
    layer.removeChildren();

    floatingTextsRef.current = floatingTextsRef.current.filter(ft => {
      ft.life--;
      ft.y -= 1.5;

      if (ft.life <= 0) return false;

      const alpha = ft.life / ft.maxLife;
      const scale = 0.8 + (1 - alpha) * 0.4;

      const txt = new Text({
        text: ft.text,
        style: new TextStyle({
          fontFamily: 'system-ui',
          fontSize: 18,
          fontWeight: '800',
          fill: ft.color,
          dropShadow: {
            color: 0x000000,
            distance: 2,
            alpha: 0.3,
          },
        }),
      });
      txt.anchor.set(0.5);
      txt.x = ft.x;
      txt.y = ft.y;
      txt.alpha = alpha;
      txt.scale.set(scale);
      layer.addChild(txt);

      return true;
    });
  }, []);

  // Render weather
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

      if (worldState.weather === 'storm' && Math.sin(frame * 0.1) > 0.98) {
        const flash = new Graphics();
        flash.rect(0, 0, width, height);
        flash.fill(0xffffff);
        flash.alpha = 0.4;
        layer.addChild(flash);
      }
    }
  }, [worldState.weather]);

  // Render UI
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

    const locTxt = new Text({
      text: `📍 ${worldState.currentLocation}`,
      style: new TextStyle({ fontFamily: 'system-ui', fontSize: 14, fontWeight: '700', fill: 0x333333 }),
    });
    locTxt.x = 24;
    locTxt.y = 22;
    layer.addChild(locTxt);

    // Weather/temp badge
    const weatherEmoji: Record<string, string> = { clear: '☀️', cloudy: '⛅', rain: '🌧️', storm: '⛈️' };
    const wBg = new Graphics();
    wBg.roundRect(width - 120, 12, 108, 40, 12);
    wBg.fill(0xffffff);
    wBg.alpha = 0.95;
    layer.addChild(wBg);

    const wTxt = new Text({
      text: `${weatherEmoji[worldState.weather] || '☀️'} ${worldState.temperature}°C`,
      style: new TextStyle({ fontFamily: 'system-ui', fontSize: 14, fontWeight: '700', fill: 0x333333 }),
    });
    wTxt.x = width - 105;
    wTxt.y = 22;
    layer.addChild(wTxt);

    // Day counter
    const dayBg = new Graphics();
    dayBg.roundRect(width - 100, height - 50, 88, 38, 10);
    dayBg.fill(0xffffff);
    dayBg.alpha = 0.95;
    layer.addChild(dayBg);

    const dayTxt = new Text({
      text: `🌅 Day ${worldState.daysSurvived + 1}`,
      style: new TextStyle({ fontFamily: 'system-ui', fontSize: 13, fontWeight: 'bold', fill: 0xff9800 }),
    });
    dayTxt.x = width - 88;
    dayTxt.y = height - 40;
    layer.addChild(dayTxt);

    // Inventory preview (bottom left)
    if (inventory.length > 0) {
      const invBg = new Graphics();
      invBg.roundRect(12, height - 50, Math.min(inventory.length * 35 + 10, 200), 38, 10);
      invBg.fill(0xffffff);
      invBg.alpha = 0.9;
      layer.addChild(invBg);

      inventory.slice(0, 5).forEach((item, i) => {
        const itemTxt = new Text({
          text: item.icon,
          style: new TextStyle({ fontSize: 20 }),
        });
        itemTxt.x = 20 + i * 35;
        itemTxt.y = height - 45;
        layer.addChild(itemTxt);

        if (item.quantity > 1) {
          const qtyTxt = new Text({
            text: `${item.quantity}`,
            style: new TextStyle({ fontSize: 10, fontWeight: 'bold', fill: 0x333333 }),
          });
          qtyTxt.x = 32 + i * 35;
          qtyTxt.y = height - 28;
          layer.addChild(qtyTxt);
        }
      });
    }
  }, [worldState, inventory]);

  // Main render loop
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
        renderParticles();
        renderFloatingText();
        renderWeather();
        renderUI();
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isLoaded, renderSky, renderSkyEffects, renderClouds, renderMountains, renderTrees, renderWater, renderGround, renderBushes, renderFlowers, renderButterflies, renderBirds, renderPlayer, renderThreats, renderParticles, renderFloatingText, renderWeather, renderUI]);

  // Resize handler
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
