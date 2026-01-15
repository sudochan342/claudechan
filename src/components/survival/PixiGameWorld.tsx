'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { useSurvivalStore } from '@/store/survival';

// Seeded random for consistent positions
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Pre-calculate static positions
function generateStaticPositions(seed: number, count: number, width: number): number[] {
  const positions: number[] = [];
  for (let i = 0; i < count; i++) {
    positions.push(seededRandom(seed + i) * width);
  }
  return positions;
}

// Color palettes
const COLORS = {
  sky: {
    dawn: { top: 0x1a0533, mid: 0x6b2d5c, bottom: 0xffa07a, sun: 0xffa500, ambient: 0xffccaa },
    day: { top: 0x0a1e3d, mid: 0x1e5c8c, bottom: 0x87ceeb, sun: 0xfffacd, ambient: 0xffffff },
    dusk: { top: 0x2d1b4e, mid: 0x8b3a62, bottom: 0xff6347, sun: 0xff4500, ambient: 0xff9966 },
    night: { top: 0x000011, mid: 0x0a0a2a, bottom: 0x1a1a3a, moon: 0xf0f0ff, ambient: 0x6688cc },
  },
  forest: {
    back: 0x0a150a,
    mid: 0x142814,
    front: 0x1e3d1e,
  },
  ground: 0x1a3d1a,
};

interface TreeData {
  x: number;
  height: number;
  variant: number;
}

interface StarData {
  x: number;
  y: number;
  size: number;
  twinkleOffset: number;
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
    grassPositions: number[];
    initialized: boolean;
  }>({
    backTrees: [],
    midTrees: [],
    frontTrees: [],
    stars: [],
    grassPositions: [],
    initialized: false,
  });

  const [isLoaded, setIsLoaded] = useState(false);
  const { worldState, playerStats, currentAction } = useSurvivalStore();

  // Initialize static data once
  const initStaticData = useCallback((width: number, height: number) => {
    if (staticDataRef.current.initialized) return;

    const groundY = height * 0.68;

    // Back trees
    staticDataRef.current.backTrees = [];
    for (let i = 0; i < 25; i++) {
      staticDataRef.current.backTrees.push({
        x: (i / 25) * width + seededRandom(i * 7) * 40 - 20,
        height: 50 + seededRandom(i * 13) * 30,
        variant: Math.floor(seededRandom(i * 17) * 3),
      });
    }

    // Mid trees
    staticDataRef.current.midTrees = [];
    for (let i = 0; i < 18; i++) {
      staticDataRef.current.midTrees.push({
        x: (i / 18) * width + seededRandom(i * 11 + 100) * 50 - 25,
        height: 70 + seededRandom(i * 19 + 100) * 40,
        variant: Math.floor(seededRandom(i * 23 + 100) * 3),
      });
    }

    // Front trees
    staticDataRef.current.frontTrees = [];
    for (let i = 0; i < 10; i++) {
      staticDataRef.current.frontTrees.push({
        x: (i / 10) * width + seededRandom(i * 29 + 200) * 60 - 30,
        height: 90 + seededRandom(i * 31 + 200) * 50,
        variant: Math.floor(seededRandom(i * 37 + 200) * 3),
      });
    }

    // Stars
    staticDataRef.current.stars = [];
    for (let i = 0; i < 80; i++) {
      staticDataRef.current.stars.push({
        x: seededRandom(i * 41 + 300) * width,
        y: seededRandom(i * 43 + 300) * groundY * 0.8,
        size: 0.5 + seededRandom(i * 47 + 300) * 1.5,
        twinkleOffset: seededRandom(i * 53 + 300) * Math.PI * 2,
      });
    }

    // Grass positions
    staticDataRef.current.grassPositions = [];
    for (let i = 0; i < 100; i++) {
      const x = seededRandom(i * 59 + 400) * width;
      // Skip grass on path area
      if (x < width * 0.3 || x > width * 0.7) {
        staticDataRef.current.grassPositions.push(x);
      }
    }

    staticDataRef.current.initialized = true;
  }, []);

  // Initialize PixiJS
  useEffect(() => {
    if (!containerRef.current || appRef.current) return;

    const init = async () => {
      const app = new Application();
      await app.init({
        width: containerRef.current!.clientWidth,
        height: 420,
        backgroundColor: 0x0a0a1a,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio, 2),
        autoDensity: true,
      });

      containerRef.current!.appendChild(app.canvas);
      appRef.current = app;

      // Create layer containers
      ['sky', 'celestial', 'mountains', 'treesBack', 'treesMid', 'treesFront', 'ground', 'entities', 'weather', 'overlay', 'ui'].forEach(name => {
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

  // Draw smooth gradient sky
  const renderSky = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('sky') as Container;
    layer.removeChildren();

    const { top, mid, bottom } = COLORS.sky[worldState.timeOfDay];
    const height = app.screen.height * 0.68;
    const width = app.screen.width;

    const sky = new Graphics();

    // Smooth gradient with many stops
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

    // Horizon glow
    const glow = new Graphics();
    glow.rect(0, height * 0.75, width, height * 0.25);
    glow.fill(bottom);
    glow.alpha = 0.3;
    layer.addChild(glow);
  }, [worldState.timeOfDay]);

  // Celestial bodies
  const renderCelestial = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('celestial') as Container;
    layer.removeChildren();

    const time = worldState.timeOfDay;
    const width = app.screen.width;
    const height = app.screen.height * 0.68;

    if (time === 'night') {
      // Stars with smooth twinkling
      staticDataRef.current.stars.forEach((star, i) => {
        const twinkle = 0.4 + Math.sin(frameRef.current * 0.03 + star.twinkleOffset) * 0.3;
        const s = new Graphics();
        s.circle(star.x, star.y, star.size);
        s.fill(0xffffff);
        s.alpha = twinkle;
        layer.addChild(s);
      });

      // Moon
      const moonX = width - 90;
      const moonY = 70;

      // Moon glow
      for (let i = 4; i >= 0; i--) {
        const g = new Graphics();
        g.circle(moonX, moonY, 30 + i * 12);
        g.fill(COLORS.sky.night.moon);
        g.alpha = 0.03;
        layer.addChild(g);
      }

      const moon = new Graphics();
      moon.circle(moonX, moonY, 28);
      moon.fill(COLORS.sky.night.moon);
      layer.addChild(moon);

      // Craters
      [[6, -4, 5], [-8, 6, 4], [4, 10, 3]].forEach(([cx, cy, r]) => {
        const c = new Graphics();
        c.circle(moonX + cx, moonY + cy, r);
        c.fill(0xd0d0e0);
        c.alpha = 0.4;
        layer.addChild(c);
      });
    } else {
      // Sun positions
      const sunPos: Record<string, { x: number; y: number }> = {
        dawn: { x: 100, y: height - 30 },
        day: { x: width / 2, y: 60 },
        dusk: { x: width - 100, y: height - 40 },
      };

      const pos = sunPos[time];
      if (!pos) return;

      const skyColors = COLORS.sky[time as keyof typeof COLORS.sky] as { sun?: number };
      const sunColor = skyColors?.sun || 0xffff00;

      // Sun glow layers
      for (let i = 5; i >= 0; i--) {
        const g = new Graphics();
        g.circle(pos.x, pos.y, 25 + i * 18);
        g.fill(sunColor);
        g.alpha = 0.06;
        layer.addChild(g);
      }

      // Sun
      const sun = new Graphics();
      sun.circle(pos.x, pos.y, 25);
      sun.fill(sunColor);
      layer.addChild(sun);

      // Corona
      const corona = new Graphics();
      corona.circle(pos.x, pos.y, 28);
      corona.fill(0xffffff);
      corona.alpha = 0.5;
      layer.addChild(corona);
    }
  }, [worldState.timeOfDay]);

  // Mountains
  const renderMountains = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('mountains') as Container;
    if (layer.children.length > 0) return; // Only render once

    const width = app.screen.width;
    const groundY = app.screen.height * 0.68;

    const mountains = new Graphics();
    mountains.moveTo(0, groundY);

    // Smooth mountain silhouette
    for (let x = 0; x <= width; x += 3) {
      const h = Math.sin(x * 0.006) * 50 + Math.sin(x * 0.015) * 30 + Math.sin(x * 0.002) * 60;
      mountains.lineTo(x, groundY - 90 - h);
    }
    mountains.lineTo(width, groundY);
    mountains.closePath();
    mountains.fill(0x0a120a);
    layer.addChild(mountains);

    // Distance fog
    const fog = new Graphics();
    fog.rect(0, groundY - 100, width, 60);
    fog.fill(0x2a3a4a);
    fog.alpha = 0.25;
    layer.addChild(fog);
  }, []);

  // Static tree rendering
  const renderTrees = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const groundY = app.screen.height * 0.68;

    // Helper to draw a tree
    const drawTree = (g: Graphics, x: number, y: number, h: number, color: number) => {
      const tw = 6;
      const th = h * 0.25;

      // Trunk
      g.rect(x - tw / 2, y - th, tw, th);
      g.fill(0x2d1a0a);

      // Foliage layers
      const layers = [
        { yOff: -th + 5, w: h * 0.45, hh: h * 0.35 },
        { yOff: -th - h * 0.2, w: h * 0.35, hh: h * 0.3 },
        { yOff: -th - h * 0.4, w: h * 0.25, hh: h * 0.25 },
      ];

      layers.forEach(l => {
        g.moveTo(x, y + l.yOff - l.hh);
        g.lineTo(x - l.w / 2, y + l.yOff);
        g.lineTo(x + l.w / 2, y + l.yOff);
        g.closePath();
        g.fill(color);
      });
    };

    // Back trees (only render once)
    const backLayer = app.stage.getChildByLabel('treesBack') as Container;
    if (backLayer.children.length === 0) {
      const g = new Graphics();
      staticDataRef.current.backTrees.forEach(t => {
        drawTree(g, t.x, groundY - 15, t.height, COLORS.forest.back);
      });
      backLayer.addChild(g);

      // Add fog
      const fog = new Graphics();
      fog.rect(0, groundY - 80, app.screen.width, 50);
      fog.fill(0x2a3a4a);
      fog.alpha = 0.15;
      backLayer.addChild(fog);
    }

    // Mid trees
    const midLayer = app.stage.getChildByLabel('treesMid') as Container;
    if (midLayer.children.length === 0) {
      const g = new Graphics();
      staticDataRef.current.midTrees.forEach(t => {
        drawTree(g, t.x, groundY - 5, t.height, COLORS.forest.mid);
      });
      midLayer.addChild(g);
    }

    // Front trees
    const frontLayer = app.stage.getChildByLabel('treesFront') as Container;
    if (frontLayer.children.length === 0) {
      const g = new Graphics();
      staticDataRef.current.frontTrees.forEach(t => {
        drawTree(g, t.x, groundY + 5, t.height, COLORS.forest.front);
      });
      frontLayer.addChild(g);
    }
  }, []);

  // Ground with animated grass
  const renderGround = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('ground') as Container;
    layer.removeChildren();

    const groundY = app.screen.height * 0.68;
    const width = app.screen.width;
    const height = app.screen.height;

    // Base ground
    const ground = new Graphics();
    ground.rect(0, groundY, width, height - groundY);
    ground.fill(COLORS.ground);
    layer.addChild(ground);

    // Dirt path
    const path = new Graphics();
    path.roundRect(width * 0.3, groundY - 2, width * 0.4, 18, 6);
    path.fill(0x4a3520);
    layer.addChild(path);

    // Animated grass
    const grass = new Graphics();
    const sway = Math.sin(frameRef.current * 0.015) * 2;

    staticDataRef.current.grassPositions.forEach((x, i) => {
      const h = 8 + (i % 5) * 2;
      const s = Math.sin(frameRef.current * 0.02 + i * 0.5) * 1.5;
      grass.moveTo(x, groundY);
      grass.quadraticCurveTo(x + s, groundY - h / 2, x + s + sway * 0.3, groundY - h);
      grass.stroke({ width: 1.5, color: 0x3d6b3d });
    });
    layer.addChild(grass);
  }, []);

  // Player character
  const renderPlayer = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('entities') as Container;

    // Remove old player
    const old = layer.getChildByLabel('player');
    if (old) layer.removeChild(old);

    const container = new Container();
    container.label = 'player';

    const groundY = app.screen.height * 0.68;
    const px = app.screen.width / 2;
    const py = groundY;

    // Smooth breathing
    const breath = Math.sin(frameRef.current * 0.04) * 1.5;
    const isActive = !!currentAction;
    const walk = isActive ? Math.sin(frameRef.current * 0.12) * 3 : 0;

    // Shadow
    const shadow = new Graphics();
    shadow.ellipse(0, 0, 18, 5);
    shadow.fill(0x000000);
    shadow.alpha = 0.25;
    container.addChild(shadow);

    // Health aura
    const hp = playerStats.health / 100;
    const auraColor = hp > 0.5 ? 0x22c55e : hp > 0.25 ? 0xeab308 : 0xef4444;
    const aura = new Graphics();
    aura.circle(0, -32, 40);
    aura.fill(auraColor);
    aura.alpha = 0.12 + Math.sin(frameRef.current * 0.06) * 0.04;
    container.addChild(aura);

    const char = new Graphics();

    // Legs
    char.roundRect(-7, -12 + Math.abs(walk) * 0.2, 5, 16, 2);
    char.fill(0x1e3a5f);
    char.roundRect(2, -12 - Math.abs(walk) * 0.2, 5, 16, 2);
    char.fill(0x1e3a5f);

    // Body
    char.roundRect(-9, -40 + breath, 18, 30, 3);
    char.fill(0x2563eb);

    // Arms
    const armY = isActive ? walk : 0;
    char.roundRect(-14, -38 + breath - armY, 5, 18, 2);
    char.fill(0xfbbf24);
    char.roundRect(9, -38 + breath + armY, 5, 18, 2);
    char.fill(0xfbbf24);

    // Hands
    char.circle(-11, -22 + breath - armY, 3);
    char.fill(0xfcd34d);
    char.circle(11, -22 + breath + armY, 3);
    char.fill(0xfcd34d);

    // Head
    char.circle(0, -50 + breath, 11);
    char.fill(0xfcd34d);

    // Hair
    char.ellipse(0, -58 + breath, 9, 5);
    char.fill(0x78350f);

    // Eyes
    char.circle(-4, -51 + breath, 2);
    char.fill(0x1a1a1a);
    char.circle(4, -51 + breath, 2);
    char.fill(0x1a1a1a);

    container.addChild(char);
    container.x = px;
    container.y = py;

    // Action label
    if (currentAction) {
      const bg = new Graphics();
      bg.roundRect(-55, -85, 110, 24, 6);
      bg.fill(0x16a34a);
      container.addChild(bg);

      const txt = new Text({
        text: currentAction,
        style: new TextStyle({
          fontFamily: 'system-ui, sans-serif',
          fontSize: 11,
          fontWeight: 'bold',
          fill: 0xffffff,
        }),
      });
      txt.anchor.set(0.5);
      txt.y = -73;
      container.addChild(txt);
    }

    layer.addChild(container);
  }, [playerStats.health, currentAction]);

  // Enemies
  const renderThreats = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('entities') as Container;

    // Remove old threats
    layer.children.filter(c => c.label?.startsWith('enemy_')).forEach(c => layer.removeChild(c));

    const groundY = app.screen.height * 0.68;

    worldState.threats.forEach((threat, i) => {
      const container = new Container();
      container.label = `enemy_${i}`;

      const x = 130 + i * 140;
      const y = groundY;
      const breathe = Math.sin(frameRef.current * 0.05 + i) * 1.5;

      // Shadow
      const shadow = new Graphics();
      shadow.ellipse(0, 0, 25, 6);
      shadow.fill(0x000000);
      shadow.alpha = 0.25;
      container.addChild(shadow);

      // Danger glow
      const glow = new Graphics();
      glow.circle(0, -20, 40);
      glow.fill(0xff0000);
      glow.alpha = 0.08 + Math.sin(frameRef.current * 0.08) * 0.03;
      container.addChild(glow);

      const enemy = new Graphics();

      if (threat.toLowerCase().includes('wolf')) {
        // Body
        enemy.ellipse(0, -15, 30, 12);
        enemy.fill(0x4a4a4a);
        // Head
        enemy.ellipse(-25, -18, 12, 10);
        enemy.fill(0x5a5a5a);
        // Snout
        enemy.ellipse(-35, -16, 7, 4);
        enemy.fill(0x3a3a3a);
        // Ears
        enemy.moveTo(-32, -28);
        enemy.lineTo(-28, -38);
        enemy.lineTo(-24, -28);
        enemy.fill(0x4a4a4a);
        enemy.moveTo(-20, -28);
        enemy.lineTo(-16, -38);
        enemy.lineTo(-12, -28);
        enemy.fill(0x4a4a4a);
        // Eye
        enemy.circle(-27, -20, 2.5);
        enemy.fill(0xff4444);
        // Legs
        [-15, -3, 8, 20].forEach((lx, j) => {
          const off = j % 2 === 0 ? breathe : -breathe;
          enemy.roundRect(lx - 2, -4 + off * 0.5, 4, 10, 1);
          enemy.fill(0x3a3a3a);
        });
        // Tail
        enemy.moveTo(25, -16);
        enemy.quadraticCurveTo(38, -24 + breathe, 35, -12);
        enemy.stroke({ width: 5, color: 0x5a5a5a, cap: 'round' });
      } else if (threat.toLowerCase().includes('bear')) {
        // Body
        enemy.ellipse(0, -25 + breathe, 38, 25);
        enemy.fill(0x5c3d1e);
        // Head
        enemy.circle(-35, -38 + breathe, 18);
        enemy.fill(0x6b4c2d);
        // Snout
        enemy.ellipse(-48, -35 + breathe, 8, 5);
        enemy.fill(0x4a3010);
        // Nose
        enemy.circle(-52, -35 + breathe, 3);
        enemy.fill(0x1a0a00);
        // Ears
        enemy.circle(-45, -55 + breathe, 6);
        enemy.fill(0x4a3010);
        enemy.circle(-25, -55 + breathe, 6);
        enemy.fill(0x4a3010);
        // Eyes
        enemy.circle(-40, -40 + breathe, 3);
        enemy.fill(0x000000);
        enemy.circle(-30, -40 + breathe, 3);
        enemy.fill(0x000000);
        // Legs
        [-20, -5, 10, 25].forEach(lx => {
          enemy.roundRect(lx - 5, -5, 10, 15, 3);
          enemy.fill(0x4a3010);
        });
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

    if (worldState.weather === 'rain' || worldState.weather === 'storm') {
      const intensity = worldState.weather === 'storm' ? 120 : 60;
      const rain = new Graphics();

      for (let i = 0; i < intensity; i++) {
        const x = (seededRandom(i + frameRef.current * 0.1) * width * 1.2) - width * 0.1;
        const y = ((frameRef.current * 8 + i * 15) % (height + 50)) - 25;
        const len = worldState.weather === 'storm' ? 18 : 12;
        const angle = worldState.weather === 'storm' ? -0.2 : -0.05;

        rain.moveTo(x, y);
        rain.lineTo(x + len * angle, y + len);
        rain.stroke({ width: 1.5, color: 0x88aacc, alpha: 0.4 });
      }
      layer.addChild(rain);

      // Lightning
      if (worldState.weather === 'storm' && Math.sin(frameRef.current * 0.15) > 0.98) {
        const flash = new Graphics();
        flash.rect(0, 0, width, height);
        flash.fill(0xffffff);
        flash.alpha = 0.35;
        layer.addChild(flash);
      }
    }

    // Fireflies at night
    if (worldState.timeOfDay === 'night') {
      for (let i = 0; i < 15; i++) {
        const t = frameRef.current * 0.02 + i * 1.5;
        const x = seededRandom(i + 500) * width + Math.sin(t) * 30;
        const y = height * 0.4 + seededRandom(i + 600) * height * 0.3 + Math.cos(t * 0.7) * 20;
        const alpha = (Math.sin(t * 2) + 1) * 0.3;

        if (alpha > 0.1) {
          const ff = new Graphics();
          ff.circle(x, y, 4);
          ff.fill(0xffff88);
          ff.alpha = alpha * 0.3;
          layer.addChild(ff);

          const core = new Graphics();
          core.circle(x, y, 2);
          core.fill(0xffffff);
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
    const vignette = new Graphics();
    [[0, 0], [width, 0], [0, height], [width, height]].forEach(([x, y]) => {
      const v = new Graphics();
      v.circle(x, y, Math.max(width, height) * 0.6);
      v.fill(0x000000);
      v.alpha = 0.2;
      layer.addChild(v);
    });

    // Time-based tint
    const ambient = COLORS.sky[worldState.timeOfDay]?.ambient || 0xffffff;
    const tint = new Graphics();
    tint.rect(0, 0, width, height);
    tint.fill(ambient);
    tint.alpha = 0.03;
    layer.addChild(tint);
  }, [worldState.timeOfDay]);

  // UI
  const renderUI = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('ui') as Container;
    layer.removeChildren();

    const width = app.screen.width;
    const height = app.screen.height;

    // Location
    const locBg = new Graphics();
    locBg.roundRect(10, 10, 190, 32, 8);
    locBg.fill(0x000000);
    locBg.alpha = 0.5;
    layer.addChild(locBg);

    const locTxt = new Text({
      text: `📍 ${worldState.currentLocation}`,
      style: new TextStyle({ fontFamily: 'system-ui', fontSize: 13, fontWeight: '600', fill: 0xffffff }),
    });
    locTxt.x = 20;
    locTxt.y = 18;
    layer.addChild(locTxt);

    // Weather
    const emoji: Record<string, string> = { clear: '☀️', cloudy: '☁️', rain: '🌧️', storm: '⛈️' };
    const tempColor = worldState.temperature < 10 ? 0x60a5fa : worldState.temperature > 30 ? 0xf87171 : 0x4ade80;

    const wBg = new Graphics();
    wBg.roundRect(width - 110, 10, 100, 32, 8);
    wBg.fill(0x000000);
    wBg.alpha = 0.5;
    layer.addChild(wBg);

    const wTxt = new Text({
      text: `${emoji[worldState.weather] || '☀️'} ${worldState.temperature}°C`,
      style: new TextStyle({ fontFamily: 'system-ui', fontSize: 13, fontWeight: '600', fill: tempColor }),
    });
    wTxt.x = width - 95;
    wTxt.y = 18;
    layer.addChild(wTxt);

    // Day
    const dBg = new Graphics();
    dBg.roundRect(width - 90, height - 40, 80, 28, 6);
    dBg.fill(0x000000);
    dBg.alpha = 0.5;
    layer.addChild(dBg);

    const dTxt = new Text({
      text: `Day ${worldState.daysSurvived + 1}`,
      style: new TextStyle({ fontFamily: 'system-ui', fontSize: 12, fontWeight: 'bold', fill: 0xffffff }),
    });
    dTxt.x = width - 75;
    dTxt.y = height - 33;
    layer.addChild(dTxt);
  }, [worldState]);

  // Main loop
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
        renderCelestial();
        renderMountains();
        renderTrees();
        renderGround();
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
  }, [isLoaded, renderSky, renderCelestial, renderMountains, renderTrees, renderGround, renderPlayer, renderThreats, renderWeather, renderOverlay, renderUI]);

  // Resize handler
  useEffect(() => {
    const onResize = () => {
      if (appRef.current && containerRef.current) {
        appRef.current.renderer.resize(containerRef.current.clientWidth, 420);
        staticDataRef.current.initialized = false;
        initStaticData(containerRef.current.clientWidth, 420);
      }
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [initStaticData]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden shadow-2xl shadow-black/60 border border-gray-700/30">
      <div ref={containerRef} className="w-full" style={{ height: 420 }} />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
            <span className="text-green-400 font-medium text-sm">Loading game...</span>
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
