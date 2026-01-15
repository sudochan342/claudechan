'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Application, Container, Graphics, Text, TextStyle, BlurFilter, ColorMatrixFilter } from 'pixi.js';
import { useSurvivalStore } from '@/store/survival';

// AAA Color Palettes
const COLORS = {
  sky: {
    dawn: { top: 0x1a0533, mid: 0x4a1259, bottom: 0xff6b35, sun: 0xffa500 },
    day: { top: 0x0a1628, mid: 0x1e4976, bottom: 0x87ceeb, sun: 0xfff8dc },
    dusk: { top: 0x1a0533, mid: 0x6b2d5c, bottom: 0xff4500, sun: 0xff6347 },
    night: { top: 0x000008, mid: 0x0a0a1a, bottom: 0x141428, moon: 0xe8e8f0 },
  },
  forest: {
    far: [0x0a1a0a, 0x0d1f0d, 0x101f10],
    mid: [0x142814, 0x1a351a, 0x1f3d1f],
    near: [0x1f3d1f, 0x284828, 0x325532],
    highlight: 0x4a7c4a,
  },
  ground: {
    grass: 0x1a3d1a,
    dirt: 0x3d2817,
    path: 0x4a3520,
  },
  fog: 0x2a3a4a,
  ambient: {
    dawn: 0xffaa77,
    day: 0xffffff,
    dusk: 0xff7755,
    night: 0x4466aa,
  },
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  alpha: number;
  type: 'rain' | 'spark' | 'dust' | 'firefly' | 'fog';
}

export function PixiGameWorld() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const lastTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const { worldState, playerStats, currentAction, isPlaying } = useSurvivalStore();

  // Initialize PixiJS with proper settings
  useEffect(() => {
    if (!containerRef.current || appRef.current) return;

    const initPixi = async () => {
      const app = new Application();

      await app.init({
        width: containerRef.current!.clientWidth,
        height: 400,
        backgroundColor: 0x0a0a1a,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      });

      containerRef.current!.appendChild(app.canvas);
      appRef.current = app;

      // Create layers with proper order
      const layers = ['sky', 'celestial', 'farBg', 'midBg', 'nearBg', 'ground', 'entities', 'fx', 'fog', 'vignette', 'ui'];
      layers.forEach(name => {
        const container = new Container();
        container.label = name;
        app.stage.addChild(container);
      });

      setIsLoaded(true);
    };

    initPixi();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, []);

  // Smooth gradient sky with atmospheric scattering
  const drawSky = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const skyLayer = app.stage.getChildByLabel('sky') as Container;
    skyLayer.removeChildren();

    const colors = COLORS.sky[worldState.timeOfDay];
    const height = app.screen.height * 0.65;
    const width = app.screen.width;

    // Multi-stop gradient for realistic sky
    const sky = new Graphics();
    const stops = 80;

    for (let i = 0; i < stops; i++) {
      const t = i / stops;
      let color: number;

      if (t < 0.4) {
        color = lerpColor(colors.top, colors.mid, t / 0.4);
      } else {
        color = lerpColor(colors.mid, colors.bottom, (t - 0.4) / 0.6);
      }

      sky.rect(0, (i / stops) * height, width, height / stops + 1);
      sky.fill(color);
    }

    skyLayer.addChild(sky);

    // Atmospheric haze near horizon
    const haze = new Graphics();
    haze.rect(0, height * 0.7, width, height * 0.3);
    haze.fill(COLORS.fog);
    haze.alpha = 0.15;
    skyLayer.addChild(haze);
  }, [worldState.timeOfDay]);

  // Celestial bodies with glow effects
  const drawCelestial = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('celestial') as Container;
    layer.removeChildren();

    const time = worldState.timeOfDay;
    const width = app.screen.width;
    const height = app.screen.height * 0.65;

    if (time === 'night') {
      // Stars with twinkling
      for (let i = 0; i < 100; i++) {
        const star = new Graphics();
        const x = Math.random() * width;
        const y = Math.random() * height * 0.7;
        const size = Math.random() * 1.5 + 0.5;
        const twinkle = Math.sin(frameCountRef.current * 0.05 + i) * 0.3 + 0.7;

        star.circle(x, y, size);
        star.fill(0xffffff);
        star.alpha = twinkle * (0.3 + Math.random() * 0.4);
        layer.addChild(star);
      }

      // Moon with glow
      const moonX = width - 100;
      const moonY = 60;

      // Outer glow
      for (let g = 3; g >= 0; g--) {
        const glow = new Graphics();
        glow.circle(moonX, moonY, 35 + g * 15);
        glow.fill(COLORS.sky.night.moon);
        glow.alpha = 0.05;
        layer.addChild(glow);
      }

      // Moon body
      const moon = new Graphics();
      moon.circle(moonX, moonY, 30);
      moon.fill(COLORS.sky.night.moon);
      layer.addChild(moon);

      // Moon craters
      const craters = [[8, -5, 6], [-10, 8, 4], [5, 12, 3], [-8, -10, 5]];
      craters.forEach(([cx, cy, r]) => {
        const crater = new Graphics();
        crater.circle(moonX + cx, moonY + cy, r);
        crater.fill(0xccccdd);
        crater.alpha = 0.3;
        layer.addChild(crater);
      });
    } else {
      // Sun with realistic glow
      const positions = {
        dawn: { x: 80, y: height - 40 },
        day: { x: width / 2, y: 50 },
        dusk: { x: width - 80, y: height - 50 },
      };

      const pos = positions[time as 'dawn' | 'day' | 'dusk'];
      if (!pos) return;

      const sunColor = COLORS.sky[time as 'dawn' | 'day' | 'dusk'].sun;

      // Multiple glow layers
      for (let g = 5; g >= 0; g--) {
        const glow = new Graphics();
        glow.circle(pos.x, pos.y, 25 + g * 20);
        glow.fill(sunColor);
        glow.alpha = 0.08 - g * 0.01;
        layer.addChild(glow);
      }

      // Sun body
      const sun = new Graphics();
      sun.circle(pos.x, pos.y, 25);
      sun.fill(sunColor);
      layer.addChild(sun);

      // Sun corona
      const corona = new Graphics();
      corona.circle(pos.x, pos.y, 30);
      corona.fill(0xffffff);
      corona.alpha = 0.4;
      layer.addChild(corona);
    }
  }, [worldState.timeOfDay]);

  // Parallax forest layers with depth
  const drawForest = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const width = app.screen.width;
    const groundY = app.screen.height * 0.65;

    // Far mountains/hills
    const farLayer = app.stage.getChildByLabel('farBg') as Container;
    farLayer.removeChildren();

    const mountains = new Graphics();
    mountains.moveTo(0, groundY);

    for (let x = 0; x <= width; x += 2) {
      const noise = Math.sin(x * 0.008) * 60 + Math.sin(x * 0.015) * 30 + Math.sin(x * 0.003) * 40;
      mountains.lineTo(x, groundY - 100 - noise);
    }
    mountains.lineTo(width, groundY);
    mountains.closePath();
    mountains.fill(COLORS.forest.far[0]);
    farLayer.addChild(mountains);

    // Fog between layers
    const farFog = new Graphics();
    farFog.rect(0, groundY - 120, width, 80);
    farFog.fill(COLORS.fog);
    farFog.alpha = 0.2;
    farLayer.addChild(farFog);

    // Mid forest layer
    const midLayer = app.stage.getChildByLabel('midBg') as Container;
    midLayer.removeChildren();

    for (let i = 0; i < 20; i++) {
      const x = (i / 20) * width + Math.sin(i) * 30;
      const treeHeight = 80 + Math.random() * 50;
      drawTree(midLayer, x, groundY - 15, treeHeight, COLORS.forest.mid, 0.7);
    }

    // Near forest layer
    const nearLayer = app.stage.getChildByLabel('nearBg') as Container;
    nearLayer.removeChildren();

    for (let i = 0; i < 12; i++) {
      const x = (i / 12) * width + Math.cos(i * 2) * 40;
      const treeHeight = 100 + Math.random() * 60;
      drawTree(nearLayer, x, groundY, treeHeight, COLORS.forest.near, 1);
    }
  }, []);

  // Draw a detailed tree
  const drawTree = (container: Container, x: number, y: number, height: number, colors: number[], scale: number) => {
    const tree = new Graphics();
    const trunkWidth = 8 * scale;
    const trunkHeight = height * 0.25;

    // Trunk with bark texture
    tree.roundRect(x - trunkWidth / 2, y - trunkHeight, trunkWidth, trunkHeight, 2);
    tree.fill(0x2d1a0a);

    // Trunk highlights
    tree.rect(x - trunkWidth / 4, y - trunkHeight, trunkWidth / 4, trunkHeight);
    tree.fill(0x3d2a1a);
    tree.alpha = 0.3;

    // Foliage layers (bottom to top, larger to smaller)
    const layers = [
      { y: y - trunkHeight + 10, w: height * 0.5, h: height * 0.35 },
      { y: y - trunkHeight - height * 0.15, w: height * 0.4, h: height * 0.35 },
      { y: y - trunkHeight - height * 0.35, w: height * 0.28, h: height * 0.3 },
    ];

    layers.forEach((layer, i) => {
      const foliage = new Graphics();

      // Main foliage shape
      foliage.moveTo(x, layer.y - layer.h);
      foliage.lineTo(x - layer.w / 2, layer.y);
      foliage.lineTo(x + layer.w / 2, layer.y);
      foliage.closePath();
      foliage.fill(colors[Math.min(i, colors.length - 1)]);

      container.addChild(foliage);

      // Highlight on right side
      const highlight = new Graphics();
      highlight.moveTo(x, layer.y - layer.h);
      highlight.lineTo(x + layer.w / 2, layer.y);
      highlight.lineTo(x + layer.w / 4, layer.y);
      highlight.closePath();
      highlight.fill(COLORS.forest.highlight);
      highlight.alpha = 0.15;
      container.addChild(highlight);
    });

    container.addChild(tree);
  };

  // Ground with grass detail
  const drawGround = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('ground') as Container;
    layer.removeChildren();

    const groundY = app.screen.height * 0.65;
    const width = app.screen.width;
    const height = app.screen.height - groundY;

    // Base ground
    const ground = new Graphics();
    ground.rect(0, groundY, width, height);
    ground.fill(COLORS.ground.grass);
    layer.addChild(ground);

    // Dirt path
    const path = new Graphics();
    path.roundRect(width * 0.25, groundY, width * 0.5, 20, 5);
    path.fill(COLORS.ground.path);
    layer.addChild(path);

    // Path dirt texture
    for (let i = 0; i < 30; i++) {
      const dot = new Graphics();
      dot.circle(width * 0.25 + Math.random() * width * 0.5, groundY + 5 + Math.random() * 10, Math.random() * 2 + 1);
      dot.fill(COLORS.ground.dirt);
      dot.alpha = 0.5;
      layer.addChild(dot);
    }

    // Grass blades
    for (let i = 0; i < 150; i++) {
      const grassX = Math.random() * width;
      // Skip grass on path
      if (grassX > width * 0.28 && grassX < width * 0.72) continue;

      const grass = new Graphics();
      const grassHeight = 8 + Math.random() * 12;
      const sway = Math.sin(frameCountRef.current * 0.02 + i) * 2;

      grass.moveTo(grassX, groundY);
      grass.quadraticCurveTo(grassX + sway, groundY - grassHeight / 2, grassX + sway * 1.5, groundY - grassHeight);
      grass.stroke({ width: 1.5, color: 0x3d6b3d });
      layer.addChild(grass);
    }
  }, []);

  // Player character with smooth animations
  const drawPlayer = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('entities') as Container;

    // Remove old player
    const oldPlayer = layer.getChildByLabel('player');
    if (oldPlayer) layer.removeChild(oldPlayer);

    const playerContainer = new Container();
    playerContainer.label = 'player';

    const groundY = app.screen.height * 0.65;
    const playerX = app.screen.width / 2;
    const playerY = groundY;

    // Breathing/idle animation
    const breathe = Math.sin(frameCountRef.current * 0.05) * 2;
    const isMoving = !!currentAction;
    const walkCycle = isMoving ? Math.sin(frameCountRef.current * 0.15) * 4 : 0;

    // Shadow
    const shadow = new Graphics();
    shadow.ellipse(0, 0, 20, 6);
    shadow.fill(0x000000);
    shadow.alpha = 0.3;
    shadow.y = -2;
    playerContainer.addChild(shadow);

    // Health-based aura
    const healthPercent = playerStats.health / 100;
    const auraColor = healthPercent > 0.5 ? 0x22c55e : healthPercent > 0.25 ? 0xeab308 : 0xef4444;

    const aura = new Graphics();
    aura.circle(0, -35, 45);
    aura.fill(auraColor);
    aura.alpha = 0.15 + Math.sin(frameCountRef.current * 0.08) * 0.05;
    playerContainer.addChild(aura);

    const player = new Graphics();

    // Legs with walk animation
    const legSpread = 4 + (isMoving ? Math.abs(walkCycle) : 0);
    player.roundRect(-legSpread - 4, -15 + Math.abs(walkCycle) * 0.3, 6, 18, 2);
    player.fill(0x1e3a5f);
    player.roundRect(legSpread - 2, -15 - Math.abs(walkCycle) * 0.3, 6, 18, 2);
    player.fill(0x1e3a5f);

    // Body
    player.roundRect(-10, -45 + breathe, 20, 32, 4);
    player.fill(0x2563eb);

    // Shirt detail
    player.roundRect(-8, -43 + breathe, 16, 8, 2);
    player.fill(0x3b82f6);

    // Arms with swing
    const armSwing = isMoving ? walkCycle * 1.5 : 0;
    player.roundRect(-16, -42 + breathe - armSwing, 6, 20, 3);
    player.fill(0xfbbf24);
    player.roundRect(10, -42 + breathe + armSwing, 6, 20, 3);
    player.fill(0xfbbf24);

    // Hands
    player.circle(-13, -24 + breathe - armSwing, 4);
    player.fill(0xfcd34d);
    player.circle(13, -24 + breathe + armSwing, 4);
    player.fill(0xfcd34d);

    // Head
    player.circle(0, -55 + breathe, 12);
    player.fill(0xfcd34d);

    // Hair
    player.ellipse(0, -64 + breathe, 10, 6);
    player.fill(0x78350f);
    player.rect(-8, -62 + breathe, 16, 4);
    player.fill(0x78350f);

    // Face
    player.circle(-4, -56 + breathe, 2);
    player.fill(0x1e1e1e);
    player.circle(4, -56 + breathe, 2);
    player.fill(0x1e1e1e);

    // Smile
    player.arc(0, -52 + breathe, 4, 0.1, Math.PI - 0.1);
    player.stroke({ width: 1.5, color: 0x92400e });

    playerContainer.addChild(player);
    playerContainer.x = playerX;
    playerContainer.y = playerY;

    // Action indicator
    if (currentAction) {
      const actionBg = new Graphics();
      actionBg.roundRect(-60, -95, 120, 28, 8);
      actionBg.fill(0x16a34a);
      actionBg.alpha = 0.95;
      playerContainer.addChild(actionBg);

      const actionText = new Text({
        text: currentAction,
        style: new TextStyle({
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: 12,
          fontWeight: 'bold',
          fill: 0xffffff,
        }),
      });
      actionText.anchor.set(0.5);
      actionText.y = -81;
      playerContainer.addChild(actionText);
    }

    layer.addChild(playerContainer);
  }, [playerStats.health, currentAction]);

  // Draw threats with better designs
  const drawThreats = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('entities') as Container;

    // Remove old threats
    layer.children
      .filter(c => c.label?.startsWith('threat_'))
      .forEach(c => layer.removeChild(c));

    const groundY = app.screen.height * 0.65;

    worldState.threats.forEach((threat, index) => {
      const container = new Container();
      container.label = `threat_${index}`;

      const x = 120 + index * 150;
      const y = groundY;
      const breathe = Math.sin(frameCountRef.current * 0.06 + index) * 2;
      const prowl = Math.sin(frameCountRef.current * 0.04 + index) * 3;

      // Shadow
      const shadow = new Graphics();
      shadow.ellipse(0, 0, 30, 8);
      shadow.fill(0x000000);
      shadow.alpha = 0.3;
      container.addChild(shadow);

      // Danger aura
      const aura = new Graphics();
      aura.circle(0, -25, 50);
      aura.fill(0xff0000);
      aura.alpha = 0.1 + Math.sin(frameCountRef.current * 0.1) * 0.05;
      container.addChild(aura);

      const enemy = new Graphics();

      if (threat.toLowerCase().includes('wolf')) {
        // Wolf - sleek and menacing
        // Body
        enemy.ellipse(prowl, -18, 35, 15);
        enemy.fill(0x4a4a4a);

        // Head
        enemy.ellipse(-30 + prowl, -22, 15, 12);
        enemy.fill(0x5a5a5a);

        // Snout
        enemy.ellipse(-42 + prowl, -20, 8, 5);
        enemy.fill(0x3a3a3a);

        // Ears
        enemy.moveTo(-38 + prowl, -35);
        enemy.lineTo(-34 + prowl, -45);
        enemy.lineTo(-30 + prowl, -35);
        enemy.fill(0x4a4a4a);
        enemy.moveTo(-26 + prowl, -35);
        enemy.lineTo(-22 + prowl, -45);
        enemy.lineTo(-18 + prowl, -35);
        enemy.fill(0x4a4a4a);

        // Glowing eye
        enemy.circle(-32 + prowl, -25, 3);
        enemy.fill(0xff4444);
        enemy.circle(-32 + prowl, -25, 2);
        enemy.fill(0xff6666);

        // Legs
        const legAnim = Math.sin(frameCountRef.current * 0.1) * 3;
        [-20, -5, 10, 25].forEach((lx, i) => {
          const offset = i % 2 === 0 ? legAnim : -legAnim;
          enemy.roundRect(lx + prowl - 3, -5 + offset, 6, 12, 2);
          enemy.fill(0x3a3a3a);
        });

        // Tail
        enemy.moveTo(30 + prowl, -20);
        enemy.quadraticCurveTo(45 + prowl, -30 + breathe, 40 + prowl, -15);
        enemy.stroke({ width: 6, color: 0x5a5a5a, cap: 'round' });

      } else if (threat.toLowerCase().includes('bear')) {
        // Bear - massive and powerful
        // Body
        enemy.ellipse(0, -30 + breathe, 45, 30);
        enemy.fill(0x5c3d1e);

        // Head
        enemy.circle(-40, -45 + breathe, 22);
        enemy.fill(0x6b4c2d);

        // Snout
        enemy.ellipse(-55, -42 + breathe, 10, 7);
        enemy.fill(0x4a3010);

        // Nose
        enemy.ellipse(-60, -42 + breathe, 4, 3);
        enemy.fill(0x1a0a00);

        // Ears
        enemy.circle(-52, -65 + breathe, 8);
        enemy.fill(0x4a3010);
        enemy.circle(-28, -65 + breathe, 8);
        enemy.fill(0x4a3010);

        // Eyes
        enemy.circle(-48, -48 + breathe, 4);
        enemy.fill(0x000000);
        enemy.circle(-32, -48 + breathe, 4);
        enemy.fill(0x000000);
        enemy.circle(-47, -49 + breathe, 1.5);
        enemy.fill(0xffffff);
        enemy.circle(-31, -49 + breathe, 1.5);
        enemy.fill(0xffffff);

        // Legs
        [-25, -8, 10, 28].forEach((lx, i) => {
          enemy.roundRect(lx - 6, -8, 12, 18, 4);
          enemy.fill(0x4a3010);
        });
      } else {
        // Generic threat
        enemy.circle(0, -30, 25);
        enemy.fill(0x8b0000);
        enemy.circle(-10, -35, 5);
        enemy.fill(0xff0000);
        enemy.circle(10, -35, 5);
        enemy.fill(0xff0000);
      }

      container.addChild(enemy);
      container.x = x;
      container.y = y;
      layer.addChild(container);
    });
  }, [worldState.threats]);

  // Weather particles
  const updateParticles = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('fx') as Container;
    layer.removeChildren();

    const width = app.screen.width;
    const height = app.screen.height;

    // Spawn new particles
    if (worldState.weather === 'rain' || worldState.weather === 'storm') {
      const intensity = worldState.weather === 'storm' ? 8 : 3;
      for (let i = 0; i < intensity; i++) {
        particlesRef.current.push({
          x: Math.random() * width,
          y: -10,
          vx: worldState.weather === 'storm' ? -3 - Math.random() * 2 : -0.5,
          vy: 12 + Math.random() * 6,
          life: 50,
          maxLife: 50,
          size: worldState.weather === 'storm' ? 3 : 2,
          color: 0x88aacc,
          alpha: 0.6,
          type: 'rain',
        });
      }
    }

    // Fireflies at night
    if (worldState.timeOfDay === 'night' && Math.random() < 0.05) {
      particlesRef.current.push({
        x: Math.random() * width,
        y: height * 0.4 + Math.random() * height * 0.3,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        life: 120,
        maxLife: 120,
        size: 3,
        color: 0xffff88,
        alpha: 0,
        type: 'firefly',
      });
    }

    // Update and render particles
    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      if (p.type === 'firefly') {
        p.vx += (Math.random() - 0.5) * 0.1;
        p.vy += (Math.random() - 0.5) * 0.1;
        p.alpha = Math.sin((p.maxLife - p.life) * 0.1) * 0.8;
      }

      if (p.life <= 0 || p.y > height || p.x < -20 || p.x > width + 20) return false;

      const particle = new Graphics();

      if (p.type === 'rain') {
        particle.moveTo(p.x, p.y);
        particle.lineTo(p.x + p.vx * 2, p.y + p.vy * 2);
        particle.stroke({ width: p.size, color: p.color, alpha: p.alpha * (p.life / p.maxLife) });
      } else if (p.type === 'firefly') {
        // Glow
        particle.circle(p.x, p.y, p.size * 3);
        particle.fill(p.color);
        particle.alpha = p.alpha * 0.3;
        layer.addChild(particle);

        const core = new Graphics();
        core.circle(p.x, p.y, p.size);
        core.fill(0xffffff);
        core.alpha = p.alpha;
        layer.addChild(core);
        return true;
      } else {
        particle.circle(p.x, p.y, p.size);
        particle.fill({ color: p.color, alpha: p.alpha * (p.life / p.maxLife) });
      }

      layer.addChild(particle);
      return true;
    });

    // Lightning for storms
    if (worldState.weather === 'storm' && Math.random() < 0.008) {
      const flash = new Graphics();
      flash.rect(0, 0, width, height);
      flash.fill(0xffffff);
      flash.alpha = 0.4;
      layer.addChild(flash);
    }
  }, [worldState.weather, worldState.timeOfDay]);

  // Atmospheric fog
  const drawFog = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('fog') as Container;
    layer.removeChildren();

    const width = app.screen.width;
    const height = app.screen.height;
    const groundY = height * 0.65;

    // Ground fog
    const fog = new Graphics();
    fog.rect(0, groundY - 30, width, height - groundY + 30);
    fog.fill(COLORS.fog);
    fog.alpha = 0.08;
    layer.addChild(fog);

    // Fog wisps
    for (let i = 0; i < 5; i++) {
      const wisp = new Graphics();
      const x = (i / 5) * width + Math.sin(frameCountRef.current * 0.01 + i) * 50;
      const y = groundY + 10 + Math.sin(frameCountRef.current * 0.02 + i * 2) * 10;

      wisp.ellipse(x, y, 80 + Math.sin(i) * 20, 15);
      wisp.fill(COLORS.fog);
      wisp.alpha = 0.06 + Math.sin(frameCountRef.current * 0.03 + i) * 0.02;
      layer.addChild(wisp);
    }
  }, []);

  // Vignette and color grading
  const drawVignette = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('vignette') as Container;
    layer.removeChildren();

    const width = app.screen.width;
    const height = app.screen.height;

    // Vignette corners
    const vignette = new Graphics();
    const gradient = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ];

    gradient.forEach(corner => {
      const v = new Graphics();
      v.circle(corner.x, corner.y, Math.max(width, height) * 0.7);
      v.fill(0x000000);
      v.alpha = 0.3;
      layer.addChild(v);
    });

    // Time-based color overlay
    const ambientColor = COLORS.ambient[worldState.timeOfDay];
    const overlay = new Graphics();
    overlay.rect(0, 0, width, height);
    overlay.fill(ambientColor);
    overlay.alpha = 0.05;
    layer.addChild(overlay);
  }, [worldState.timeOfDay]);

  // UI overlay
  const drawUI = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('ui') as Container;
    layer.removeChildren();

    const width = app.screen.width;

    // Location badge
    const locBg = new Graphics();
    locBg.roundRect(12, 12, 200, 36, 10);
    locBg.fill(0x000000);
    locBg.alpha = 0.5;
    layer.addChild(locBg);

    const locBorder = new Graphics();
    locBorder.roundRect(12, 12, 200, 36, 10);
    locBorder.stroke({ width: 1, color: 0x4a5568 });
    layer.addChild(locBorder);

    const locText = new Text({
      text: `📍 ${worldState.currentLocation}`,
      style: new TextStyle({
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 14,
        fontWeight: '600',
        fill: 0xffffff,
      }),
    });
    locText.x = 24;
    locText.y = 22;
    layer.addChild(locText);

    // Weather badge
    const weatherEmoji = { clear: '☀️', cloudy: '☁️', rain: '🌧️', storm: '⛈️' }[worldState.weather];
    const tempColor = worldState.temperature < 10 ? 0x60a5fa : worldState.temperature > 30 ? 0xf87171 : 0x4ade80;

    const weatherBg = new Graphics();
    weatherBg.roundRect(width - 120, 12, 108, 36, 10);
    weatherBg.fill(0x000000);
    weatherBg.alpha = 0.5;
    layer.addChild(weatherBg);

    const weatherBorder = new Graphics();
    weatherBorder.roundRect(width - 120, 12, 108, 36, 10);
    weatherBorder.stroke({ width: 1, color: 0x4a5568 });
    layer.addChild(weatherBorder);

    const weatherText = new Text({
      text: `${weatherEmoji} ${worldState.temperature}°C`,
      style: new TextStyle({
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 14,
        fontWeight: '600',
        fill: tempColor,
      }),
    });
    weatherText.x = width - 105;
    weatherText.y = 22;
    layer.addChild(weatherText);

    // Day counter
    const dayBg = new Graphics();
    dayBg.roundRect(width - 100, app.screen.height - 44, 88, 32, 8);
    dayBg.fill(0x000000);
    dayBg.alpha = 0.5;
    layer.addChild(dayBg);

    const dayText = new Text({
      text: `Day ${worldState.daysSurvived + 1}`,
      style: new TextStyle({
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 13,
        fontWeight: 'bold',
        fill: 0xffffff,
      }),
    });
    dayText.x = width - 85;
    dayText.y = app.screen.height - 36;
    layer.addChild(dayText);
  }, [worldState]);

  // Main game loop with proper timing
  useEffect(() => {
    if (!isLoaded || !appRef.current) return;

    let animationId: number;

    const gameLoop = (timestamp: number) => {
      const deltaTime = timestamp - lastTimeRef.current;

      // Cap frame rate to 60fps
      if (deltaTime >= 16) {
        lastTimeRef.current = timestamp;
        frameCountRef.current++;

        drawSky();
        drawCelestial();
        drawForest();
        drawGround();
        drawPlayer();
        drawThreats();
        updateParticles();
        drawFog();
        drawVignette();
        drawUI();
      }

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);

    return () => cancelAnimationFrame(animationId);
  }, [isLoaded, drawSky, drawCelestial, drawForest, drawGround, drawPlayer, drawThreats, updateParticles, drawFog, drawVignette, drawUI]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (appRef.current && containerRef.current) {
        appRef.current.renderer.resize(containerRef.current.clientWidth, 400);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20 pointer-events-none z-10 rounded-2xl" />
      <div
        ref={containerRef}
        className="w-full"
        style={{ height: '400px' }}
      />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-ping" />
            <span className="text-green-400 font-medium">Initializing game engine...</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Color interpolation helper
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return (rr << 16) | (rg << 8) | rb;
}
