'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Application, Container, Graphics, Sprite, Texture, Text, TextStyle, Assets } from 'pixi.js';
import { useSurvivalStore } from '@/store/survival';

// Sky colors for different times of day
const SKY_COLORS = {
  dawn: [0x1a0a2e, 0xff6b35, 0xffecd2],
  day: [0x1e90ff, 0x87ceeb, 0xe0f7fa],
  dusk: [0x4a1c40, 0xcd5c5c, 0xffd700],
  night: [0x000022, 0x0a0a3e, 0x1a1a5e],
};

// Ground colors
const GROUND_COLORS = {
  grass: 0x2d5a2d,
  dirt: 0x5c3d1e,
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
  type: 'fire' | 'rain' | 'spark' | 'dust';
}

export function PixiGameWorld() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const { worldState, playerStats, currentAction, isPlaying } = useSurvivalStore();

  // Initialize PixiJS
  useEffect(() => {
    if (!containerRef.current || appRef.current) return;

    const initPixi = async () => {
      const app = new Application();

      await app.init({
        width: containerRef.current!.clientWidth,
        height: 320,
        backgroundColor: 0x1a1a2e,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      containerRef.current!.appendChild(app.canvas);
      appRef.current = app;

      // Create game layers
      const skyLayer = new Container();
      const bgLayer = new Container();
      const groundLayer = new Container();
      const entityLayer = new Container();
      const fxLayer = new Container();
      const uiLayer = new Container();

      skyLayer.label = 'sky';
      bgLayer.label = 'background';
      groundLayer.label = 'ground';
      entityLayer.label = 'entities';
      fxLayer.label = 'effects';
      uiLayer.label = 'ui';

      app.stage.addChild(skyLayer);
      app.stage.addChild(bgLayer);
      app.stage.addChild(groundLayer);
      app.stage.addChild(entityLayer);
      app.stage.addChild(fxLayer);
      app.stage.addChild(uiLayer);

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

  // Draw sky gradient
  const drawSky = useCallback((timeOfDay: 'dawn' | 'day' | 'dusk' | 'night') => {
    const app = appRef.current;
    if (!app) return;

    const skyLayer = app.stage.getChildByLabel('sky') as Container;
    skyLayer.removeChildren();

    const sky = new Graphics();
    const colors = SKY_COLORS[timeOfDay];
    const height = app.screen.height * 0.7;

    // Draw gradient manually with rectangles
    const steps = 50;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const color = lerpColor(colors[0], colors[1], t);
      sky.rect(0, (i / steps) * height, app.screen.width, height / steps + 1);
      sky.fill(color);
    }

    skyLayer.addChild(sky);

    // Add celestial body
    if (timeOfDay === 'night') {
      // Moon
      const moon = new Graphics();
      moon.circle(app.screen.width - 80, 50, 25);
      moon.fill(0xfffacd);
      moon.circle(app.screen.width - 70, 45, 20);
      moon.fill(SKY_COLORS.night[2]); // Crescent effect
      skyLayer.addChild(moon);

      // Stars
      for (let i = 0; i < 50; i++) {
        const star = new Graphics();
        star.circle(Math.random() * app.screen.width, Math.random() * height * 0.8, Math.random() * 2 + 0.5);
        star.fill(0xffffff);
        star.alpha = Math.random() * 0.5 + 0.5;
        skyLayer.addChild(star);
      }
    } else if (timeOfDay === 'day') {
      // Sun
      const sun = new Graphics();
      sun.circle(100, 50, 30);
      sun.fill(0xffff00);

      // Sun glow
      const sunGlow = new Graphics();
      sunGlow.circle(100, 50, 45);
      sunGlow.fill(0xffff00);
      sunGlow.alpha = 0.3;
      skyLayer.addChild(sunGlow);
      skyLayer.addChild(sun);
    } else if (timeOfDay === 'dawn' || timeOfDay === 'dusk') {
      // Sun near horizon
      const sunY = timeOfDay === 'dawn' ? height - 20 : height - 30;
      const sunX = timeOfDay === 'dawn' ? 80 : app.screen.width - 80;
      const sun = new Graphics();
      sun.circle(sunX, sunY, 35);
      sun.fill(timeOfDay === 'dawn' ? 0xffa500 : 0xff4500);

      const sunGlow = new Graphics();
      sunGlow.circle(sunX, sunY, 60);
      sunGlow.fill(timeOfDay === 'dawn' ? 0xffa500 : 0xff4500);
      sunGlow.alpha = 0.2;
      skyLayer.addChild(sunGlow);
      skyLayer.addChild(sun);
    }
  }, []);

  // Draw forest background with parallax layers
  const drawForest = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const bgLayer = app.stage.getChildByLabel('background') as Container;
    bgLayer.removeChildren();

    const width = app.screen.width;
    const groundY = app.screen.height * 0.7;

    // Far mountains
    const mountains = new Graphics();
    mountains.moveTo(0, groundY);
    for (let x = 0; x <= width; x += 60) {
      const peakHeight = 80 + Math.sin(x * 0.02) * 40 + Math.random() * 20;
      mountains.lineTo(x, groundY - peakHeight);
      mountains.lineTo(x + 30, groundY - peakHeight + 20);
    }
    mountains.lineTo(width, groundY);
    mountains.closePath();
    mountains.fill(0x1a2a1a);
    mountains.alpha = 0.6;
    bgLayer.addChild(mountains);

    // Tree layers (back to front)
    const treeLayers = [
      { y: groundY - 20, color: 0x0d1f0d, scale: 0.6, count: 15 },
      { y: groundY - 10, color: 0x1a3a1a, scale: 0.8, count: 12 },
      { y: groundY, color: 0x2d5a2d, scale: 1, count: 10 },
    ];

    treeLayers.forEach((layer) => {
      for (let i = 0; i < layer.count; i++) {
        const tree = new Graphics();
        const x = (i / layer.count) * width + Math.random() * 50 - 25;
        const treeHeight = (60 + Math.random() * 40) * layer.scale;
        const trunkHeight = treeHeight * 0.3;
        const trunkWidth = 8 * layer.scale;

        // Trunk
        tree.rect(x - trunkWidth / 2, layer.y - trunkHeight, trunkWidth, trunkHeight);
        tree.fill(0x3d2a1a);

        // Foliage (triangle tree)
        tree.moveTo(x, layer.y - treeHeight);
        tree.lineTo(x - treeHeight * 0.4, layer.y - trunkHeight + 10);
        tree.lineTo(x + treeHeight * 0.4, layer.y - trunkHeight + 10);
        tree.closePath();
        tree.fill(layer.color);

        // Second layer of foliage
        tree.moveTo(x, layer.y - treeHeight + 15);
        tree.lineTo(x - treeHeight * 0.35, layer.y - trunkHeight + 5);
        tree.lineTo(x + treeHeight * 0.35, layer.y - trunkHeight + 5);
        tree.closePath();
        tree.fill(layer.color + 0x101010);

        bgLayer.addChild(tree);
      }
    });
  }, []);

  // Draw ground
  const drawGround = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const groundLayer = app.stage.getChildByLabel('ground') as Container;
    groundLayer.removeChildren();

    const groundY = app.screen.height * 0.7;
    const width = app.screen.width;
    const height = app.screen.height - groundY;

    // Main ground
    const ground = new Graphics();
    ground.rect(0, groundY, width, height);
    ground.fill(GROUND_COLORS.grass);
    groundLayer.addChild(ground);

    // Grass details
    for (let i = 0; i < 100; i++) {
      const grass = new Graphics();
      const x = Math.random() * width;
      const grassHeight = 5 + Math.random() * 10;
      grass.moveTo(x, groundY);
      grass.lineTo(x - 2, groundY - grassHeight);
      grass.lineTo(x + 2, groundY - grassHeight / 2);
      grass.stroke({ width: 1, color: 0x4a7c4a });
      groundLayer.addChild(grass);
    }

    // Path/dirt
    const path = new Graphics();
    path.rect(width * 0.3, groundY, width * 0.4, 15);
    path.fill(GROUND_COLORS.dirt);
    groundLayer.addChild(path);
  }, []);

  // Draw player character
  const drawPlayer = useCallback((isMoving: boolean = false) => {
    const app = appRef.current;
    if (!app) return;

    const entityLayer = app.stage.getChildByLabel('entities') as Container;

    // Remove old player
    const oldPlayer = entityLayer.getChildByLabel('player');
    if (oldPlayer) entityLayer.removeChild(oldPlayer);

    const playerContainer = new Container();
    playerContainer.label = 'player';

    const groundY = app.screen.height * 0.7;
    const playerX = app.screen.width / 2;
    const playerY = groundY - 5;

    // Player body
    const player = new Graphics();

    // Health-based glow
    const glowColor = playerStats.health > 50 ? 0x22c55e : playerStats.health > 25 ? 0xeab308 : 0xef4444;
    const glow = new Graphics();
    glow.circle(0, -20, 30);
    glow.fill(glowColor);
    glow.alpha = 0.2;
    playerContainer.addChild(glow);

    // Legs
    const legOffset = isMoving ? Math.sin(Date.now() * 0.01) * 3 : 0;
    player.rect(-6, -8, 5, 15 + legOffset);
    player.fill(0x1a3a5f);
    player.rect(1, -8, 5, 15 - legOffset);
    player.fill(0x1a3a5f);

    // Body
    player.roundRect(-8, -30, 16, 25, 3);
    player.fill(0x2e6b9b);

    // Arms
    player.rect(-12, -28 + legOffset, 4, 15);
    player.fill(0xf4d03f);
    player.rect(8, -28 - legOffset, 4, 15);
    player.fill(0xf4d03f);

    // Head
    player.circle(0, -40, 10);
    player.fill(0xf4d03f);

    // Hair
    player.rect(-8, -52, 16, 6);
    player.fill(0x5c3d1e);

    // Eyes
    player.circle(-4, -42, 2);
    player.fill(0x000000);
    player.circle(4, -42, 2);
    player.fill(0x000000);

    playerContainer.addChild(player);
    playerContainer.x = playerX;
    playerContainer.y = playerY;

    entityLayer.addChild(playerContainer);

    // Add action indicator
    if (currentAction) {
      const actionText = new Text({
        text: currentAction,
        style: new TextStyle({
          fontFamily: 'monospace',
          fontSize: 12,
          fill: 0xffffff,
          fontWeight: 'bold',
        }),
      });
      actionText.anchor.set(0.5);
      actionText.x = playerX;
      actionText.y = groundY - 80;

      const actionBg = new Graphics();
      actionBg.roundRect(
        playerX - actionText.width / 2 - 8,
        groundY - 92,
        actionText.width + 16,
        24,
        4
      );
      actionBg.fill(0x22c55e);
      actionBg.alpha = 0.9;

      entityLayer.addChild(actionBg);
      entityLayer.addChild(actionText);
    }
  }, [playerStats.health, currentAction]);

  // Draw threats/enemies
  const drawThreats = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const entityLayer = app.stage.getChildByLabel('entities') as Container;

    // Remove old threats
    entityLayer.children
      .filter(c => c.label?.startsWith('threat_'))
      .forEach(c => entityLayer.removeChild(c));

    const groundY = app.screen.height * 0.7;

    worldState.threats.forEach((threat, index) => {
      const threatContainer = new Container();
      threatContainer.label = `threat_${index}`;

      const x = 100 + index * 120;
      const y = groundY - 5;

      const enemy = new Graphics();

      if (threat === 'Wolf' || threat === 'wolf') {
        // Wolf
        enemy.ellipse(0, -15, 25, 12);
        enemy.fill(0x4a4a4a);
        // Head
        enemy.ellipse(-20, -18, 12, 10);
        enemy.fill(0x5a5a5a);
        // Ears
        enemy.moveTo(-28, -28);
        enemy.lineTo(-24, -35);
        enemy.lineTo(-20, -28);
        enemy.fill(0x4a4a4a);
        enemy.moveTo(-18, -28);
        enemy.lineTo(-14, -35);
        enemy.lineTo(-10, -28);
        enemy.fill(0x4a4a4a);
        // Eye
        enemy.circle(-24, -20, 3);
        enemy.fill(0xff4444);
        // Legs
        for (let i = 0; i < 4; i++) {
          enemy.rect(-15 + i * 10, -5, 4, 12);
          enemy.fill(0x3a3a3a);
        }
        // Tail
        enemy.moveTo(20, -18);
        enemy.lineTo(35, -25);
        enemy.lineTo(30, -15);
        enemy.fill(0x5a5a5a);
      } else if (threat === 'Bear' || threat === 'bear') {
        // Bear (larger)
        enemy.ellipse(0, -25, 40, 25);
        enemy.fill(0x5c3d1e);
        // Head
        enemy.circle(-35, -35, 18);
        enemy.fill(0x6b4c2d);
        // Ears
        enemy.circle(-48, -50, 6);
        enemy.fill(0x4a3010);
        enemy.circle(-22, -50, 6);
        enemy.fill(0x4a3010);
        // Eyes
        enemy.circle(-40, -38, 3);
        enemy.fill(0x000000);
        enemy.circle(-30, -38, 3);
        enemy.fill(0x000000);
        // Nose
        enemy.ellipse(-35, -30, 5, 3);
        enemy.fill(0x1a0a00);
        // Legs
        for (let i = 0; i < 4; i++) {
          enemy.rect(-25 + i * 15, -5, 8, 15);
          enemy.fill(0x4a3010);
        }
      } else {
        // Generic threat
        enemy.circle(0, -20, 20);
        enemy.fill(0x8b0000);
        enemy.circle(-8, -25, 4);
        enemy.fill(0xff0000);
        enemy.circle(8, -25, 4);
        enemy.fill(0xff0000);
      }

      threatContainer.addChild(enemy);
      threatContainer.x = x;
      threatContainer.y = y;

      // Animate
      threatContainer.scale.x = 1 + Math.sin(Date.now() * 0.005 + index) * 0.05;

      entityLayer.addChild(threatContainer);
    });
  }, [worldState.threats]);

  // Add weather particles
  const updateParticles = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const fxLayer = app.stage.getChildByLabel('effects') as Container;
    fxLayer.removeChildren();

    // Add new particles based on weather
    if (worldState.weather === 'rain' || worldState.weather === 'storm') {
      const intensity = worldState.weather === 'storm' ? 5 : 2;
      for (let i = 0; i < intensity; i++) {
        particlesRef.current.push({
          x: Math.random() * app.screen.width,
          y: -10,
          vx: worldState.weather === 'storm' ? -2 : 0,
          vy: 8 + Math.random() * 4,
          life: 60,
          maxLife: 60,
          size: 2,
          color: 0x6699cc,
          type: 'rain',
        });
      }
    }

    // Update and draw particles
    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      if (p.life <= 0 || p.y > app.screen.height) return false;

      const particle = new Graphics();
      if (p.type === 'rain') {
        particle.moveTo(p.x, p.y);
        particle.lineTo(p.x + p.vx * 2, p.y + p.vy * 2);
        particle.stroke({ width: p.size, color: p.color, alpha: p.life / p.maxLife });
      } else {
        particle.circle(p.x, p.y, p.size);
        particle.fill({ color: p.color, alpha: p.life / p.maxLife });
      }
      fxLayer.addChild(particle);

      return true;
    });

    // Storm lightning
    if (worldState.weather === 'storm' && Math.random() < 0.005) {
      const lightning = new Graphics();
      lightning.rect(0, 0, app.screen.width, app.screen.height);
      lightning.fill(0xffffff);
      lightning.alpha = 0.3;
      fxLayer.addChild(lightning);
      setTimeout(() => {
        if (fxLayer.children.includes(lightning)) {
          fxLayer.removeChild(lightning);
        }
      }, 100);
    }
  }, [worldState.weather]);

  // Draw UI overlay
  const drawUI = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const uiLayer = app.stage.getChildByLabel('ui') as Container;
    uiLayer.removeChildren();

    // Location badge
    const locBg = new Graphics();
    locBg.roundRect(10, 10, 180, 30, 5);
    locBg.fill(0x000000);
    locBg.alpha = 0.6;
    uiLayer.addChild(locBg);

    const locText = new Text({
      text: `📍 ${worldState.currentLocation}`,
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 14,
        fill: 0xffffff,
      }),
    });
    locText.x = 20;
    locText.y = 17;
    uiLayer.addChild(locText);

    // Weather & temp badge
    const weatherEmoji = { clear: '☀️', cloudy: '☁️', rain: '🌧️', storm: '⛈️' }[worldState.weather];
    const tempColor = worldState.temperature < 10 ? 0x66ccff : worldState.temperature > 30 ? 0xff6666 : 0x66ff66;

    const weatherBg = new Graphics();
    weatherBg.roundRect(app.screen.width - 110, 10, 100, 30, 5);
    weatherBg.fill(0x000000);
    weatherBg.alpha = 0.6;
    uiLayer.addChild(weatherBg);

    const weatherText = new Text({
      text: `${weatherEmoji} ${worldState.temperature}°C`,
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 14,
        fill: tempColor,
      }),
    });
    weatherText.x = app.screen.width - 100;
    weatherText.y = 17;
    uiLayer.addChild(weatherText);

    // Day counter
    const dayBg = new Graphics();
    dayBg.roundRect(app.screen.width - 90, app.screen.height - 35, 80, 25, 5);
    dayBg.fill(0x000000);
    dayBg.alpha = 0.6;
    uiLayer.addChild(dayBg);

    const dayText = new Text({
      text: `Day ${worldState.daysSurvived + 1}`,
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 12,
        fill: 0xffffff,
        fontWeight: 'bold',
      }),
    });
    dayText.x = app.screen.width - 75;
    dayText.y = app.screen.height - 30;
    uiLayer.addChild(dayText);
  }, [worldState]);

  // Main render loop
  useEffect(() => {
    if (!isLoaded || !appRef.current) return;

    const animate = () => {
      drawSky(worldState.timeOfDay);
      drawForest();
      drawGround();
      drawPlayer(!!currentAction);
      drawThreats();
      updateParticles();
      drawUI();

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isLoaded, worldState, currentAction, playerStats, drawSky, drawForest, drawGround, drawPlayer, drawThreats, updateParticles, drawUI]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (appRef.current && containerRef.current) {
        appRef.current.renderer.resize(
          containerRef.current.clientWidth,
          320
        );
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border-2 border-gray-700/50 bg-gray-900">
      <div
        ref={containerRef}
        className="w-full"
        style={{ height: '320px', imageRendering: 'pixelated' }}
      />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-green-400 font-mono animate-pulse">Loading game...</div>
        </div>
      )}
    </div>
  );
}

// Helper: Linear interpolate between two colors
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
