'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { useSurvivalStore } from '@/store/survival';
import {
  PALETTE,
  CHARACTER_IDLE,
  CHARACTER_WALK1,
  TREE_PINE,
  WOLF,
  BUSH,
  BERRY_BUSH,
  SUN,
  MOON,
  CLOUD,
} from './PixelSprites';

const PIXEL_SCALE = 3; // Scale up pixels for visibility

// Draw a sprite from pixel data
function drawSprite(
  graphics: Graphics,
  sprite: number[][],
  x: number,
  y: number,
  scale: number = PIXEL_SCALE,
  flipX: boolean = false
) {
  const width = sprite[0].length;
  const height = sprite.length;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const colorIndex = sprite[row][col];
      if (colorIndex === 0) continue; // Transparent

      const color = PALETTE[colorIndex as keyof typeof PALETTE];
      const px = flipX ? x + (width - 1 - col) * scale : x + col * scale;
      const py = y + row * scale;

      graphics.rect(px, py, scale, scale);
      graphics.fill(color);
    }
  }
}

// Game world data
interface WorldObject {
  x: number;
  y: number;
  type: 'tree' | 'bush' | 'berry' | 'water';
  variant: number;
}

interface Enemy {
  x: number;
  y: number;
  type: 'wolf' | 'bear';
  direction: number;
}

export function PixelGameWorld() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const frameRef = useRef(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const { worldState, playerStats, currentAction, isPlaying, isPaused } = useSurvivalStore();

  // World objects (generated once)
  const worldObjectsRef = useRef<WorldObject[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);

  // Player state
  const playerRef = useRef({
    x: 400,
    targetX: 400,
    direction: 1,
    walkFrame: 0,
    actionType: 'idle' as string,
  });

  // Detect action type
  const getActionType = useCallback((action: string): string => {
    const a = action.toLowerCase();
    if (a.includes('chop') || a.includes('wood')) return 'chopping';
    if (a.includes('gather') || a.includes('berr')) return 'gathering';
    if (a.includes('fight') || a.includes('attack')) return 'fighting';
    if (a.includes('rest') || a.includes('sleep')) return 'resting';
    if (a.includes('walk') || a.includes('move')) return 'walking';
    return 'idle';
  }, []);

  // Update action type when action changes
  useEffect(() => {
    if (currentAction) {
      playerRef.current.actionType = getActionType(currentAction);
    }
  }, [currentAction, getActionType]);

  // Generate world objects
  const initWorld = useCallback((width: number) => {
    const objects: WorldObject[] = [];
    const groundY = 350;

    // Trees on left side
    for (let i = 0; i < 4; i++) {
      objects.push({
        x: 50 + i * 80 + Math.random() * 30,
        y: groundY - 120,
        type: 'tree',
        variant: Math.floor(Math.random() * 3),
      });
    }

    // Trees on right side
    for (let i = 0; i < 4; i++) {
      objects.push({
        x: width - 350 + i * 80 + Math.random() * 30,
        y: groundY - 120,
        type: 'tree',
        variant: Math.floor(Math.random() * 3),
      });
    }

    // Bushes
    for (let i = 0; i < 6; i++) {
      const x = 100 + Math.random() * (width - 200);
      if (x > width / 2 - 100 && x < width / 2 + 100) continue;
      objects.push({
        x,
        y: groundY - 30,
        type: Math.random() > 0.5 ? 'bush' : 'berry',
        variant: 0,
      });
    }

    // Water on far left
    objects.push({
      x: 20,
      y: groundY,
      type: 'water',
      variant: 0,
    });

    worldObjectsRef.current = objects;
  }, []);

  // Initialize PixiJS
  useEffect(() => {
    if (!containerRef.current || appRef.current) return;

    const init = async () => {
      const app = new Application();
      await app.init({
        width: containerRef.current!.clientWidth,
        height: 450,
        backgroundColor: 0x87CEEB,
        antialias: false, // Pixel perfect!
        resolution: 1,
      });

      containerRef.current!.appendChild(app.canvas);
      appRef.current = app;

      // Create layers
      const layers = ['sky', 'clouds', 'background', 'ground', 'objects', 'enemies', 'player', 'ui'];
      layers.forEach(name => {
        const container = new Container();
        container.label = name;
        app.stage.addChild(container);
      });

      initWorld(app.screen.width);
      setIsLoaded(true);
    };

    init();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [initWorld]);

  // Render sky
  const renderSky = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('sky') as Container;
    layer.removeChildren();

    const width = app.screen.width;
    const height = 350; // Sky height
    const time = worldState.timeOfDay;

    const g = new Graphics();

    // Sky gradient based on time
    const colors: Record<string, number[]> = {
      dawn: [0xFFB6C1, 0xFFD700, 0x87CEEB],
      day: [0x87CEEB, 0xADD8E6, 0xB0E0E6],
      dusk: [0xFF6B6B, 0xFFA500, 0x4B0082],
      night: [0x191970, 0x000033, 0x000000],
    };

    const skyColors = colors[time] || colors.day;
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const colorIndex = Math.min(Math.floor(t * skyColors.length), skyColors.length - 1);
      g.rect(0, i * (height / steps), width, height / steps + 1);
      g.fill(skyColors[colorIndex]);
    }

    layer.addChild(g);

    // Sun or Moon
    const celestial = new Graphics();
    if (time === 'night') {
      drawSprite(celestial, MOON, width - 100, 50, 4);
    } else {
      const sunX = time === 'dawn' ? 100 : time === 'dusk' ? width - 100 : width / 2;
      const sunY = time === 'day' ? 60 : 120;
      drawSprite(celestial, SUN, sunX - 32, sunY, 4);
    }
    layer.addChild(celestial);
  }, [worldState.timeOfDay]);

  // Render clouds
  const renderClouds = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('clouds') as Container;
    layer.removeChildren();

    const frame = frameRef.current;
    const width = app.screen.width;

    // Draw 3 clouds
    for (let i = 0; i < 3; i++) {
      const cloudG = new Graphics();
      const x = ((i * 300 + frame * 0.3) % (width + 200)) - 100;
      const y = 50 + i * 40;
      drawSprite(cloudG, CLOUD, x, y, 2);
      cloudG.alpha = worldState.timeOfDay === 'night' ? 0.3 : 0.9;
      layer.addChild(cloudG);
    }
  }, [worldState.timeOfDay]);

  // Render ground
  const renderGround = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('ground') as Container;
    if (layer.children.length > 0) return; // Only render once

    const width = app.screen.width;
    const height = app.screen.height;
    const groundY = 350;

    const g = new Graphics();

    // Grass layer (top)
    for (let x = 0; x < width; x += PIXEL_SCALE) {
      const grassHeight = 10 + Math.sin(x * 0.1) * 3;
      g.rect(x, groundY - grassHeight, PIXEL_SCALE, grassHeight);
      g.fill(Math.random() > 0.3 ? 0x7CFC00 : 0x6B8E23);
    }

    // Dirt layer
    g.rect(0, groundY, width, height - groundY);
    g.fill(0x8B7355);

    // Dirt texture
    for (let i = 0; i < 100; i++) {
      const px = Math.random() * width;
      const py = groundY + Math.random() * (height - groundY);
      g.rect(px, py, PIXEL_SCALE * 2, PIXEL_SCALE * 2);
      g.fill(Math.random() > 0.5 ? 0x6B5344 : 0x9B8B75);
    }

    // Path in middle
    const pathWidth = 150;
    const pathX = (width - pathWidth) / 2;
    g.rect(pathX, groundY - 5, pathWidth, 20);
    g.fill(0xD2B48C);

    layer.addChild(g);
  }, []);

  // Render world objects (trees, bushes)
  const renderObjects = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('objects') as Container;
    layer.removeChildren();

    const frame = frameRef.current;

    worldObjectsRef.current.forEach((obj, i) => {
      const g = new Graphics();
      const sway = Math.sin(frame * 0.02 + i) * 2;

      if (obj.type === 'tree') {
        // Draw simplified tree
        const scale = 2;
        // Trunk
        g.rect(obj.x + 12 * scale, obj.y + 70 * scale, 8 * scale, 50 * scale);
        g.fill(0x8B4513);
        // Foliage layers
        for (let layer = 0; layer < 3; layer++) {
          const layerY = obj.y + layer * 25 * scale;
          const layerWidth = (60 - layer * 15) * scale;
          g.moveTo(obj.x + 16 * scale + sway, layerY);
          g.lineTo(obj.x + 16 * scale - layerWidth / 2 + sway * 0.8, layerY + 30 * scale);
          g.lineTo(obj.x + 16 * scale + layerWidth / 2 + sway * 1.2, layerY + 30 * scale);
          g.closePath();
          g.fill(layer === 0 ? 0x228B22 : layer === 1 ? 0x2E8B2E : 0x32CD32);
        }
      } else if (obj.type === 'bush') {
        drawSprite(g, BUSH, obj.x + sway, obj.y, 2);
      } else if (obj.type === 'berry') {
        drawSprite(g, BERRY_BUSH, obj.x + sway, obj.y, 2);
      } else if (obj.type === 'water') {
        // Animated water
        const waterWidth = 100;
        const waterHeight = 30;
        for (let wx = 0; wx < waterWidth; wx += PIXEL_SCALE) {
          const waveY = Math.sin((frame * 0.1 + wx * 0.1)) * 3;
          g.rect(obj.x + wx, obj.y + waveY, PIXEL_SCALE, waterHeight);
          g.fill(Math.random() > 0.3 ? 0x4FC3F7 : 0x29B6F6);
        }
      }

      layer.addChild(g);
    });
  }, []);

  // Render enemies
  const renderEnemies = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('enemies') as Container;
    layer.removeChildren();

    const frame = frameRef.current;
    const groundY = 350;

    // Check for threats in world state
    worldState.threats.forEach((threat, i) => {
      const g = new Graphics();
      const bounce = Math.sin(frame * 0.1 + i) * 3;
      const x = 150 + i * 200;

      if (threat.toLowerCase().includes('wolf')) {
        drawSprite(g, WOLF, x, groundY - 50 + bounce, 3);
      } else {
        // Generic enemy (bear-like)
        g.rect(x, groundY - 60 + bounce, 60, 50);
        g.fill(0x5C4033);
        g.circle(x + 10, groundY - 70 + bounce, 15);
        g.fill(0x5C4033);
        // Eyes
        g.circle(x + 5, groundY - 75 + bounce, 3);
        g.fill(0xFF0000);
        g.circle(x + 15, groundY - 75 + bounce, 3);
        g.fill(0xFF0000);
      }

      // Danger indicator
      const dangerG = new Graphics();
      dangerG.circle(x + 30, groundY - 100, 20);
      dangerG.fill(0xFF0000);
      dangerG.alpha = 0.3 + Math.sin(frame * 0.15) * 0.2;
      layer.addChild(dangerG);

      layer.addChild(g);
    });
  }, [worldState.threats]);

  // Render player
  const renderPlayer = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('player') as Container;
    layer.removeChildren();

    const frame = frameRef.current;
    const groundY = 350;
    const player = playerRef.current;
    const isActive = isPlaying && !isPaused;

    // Update player position
    if (isActive) {
      // Move based on action
      if (frame % 30 === 0) {
        const action = player.actionType;
        if (action === 'chopping') {
          player.targetX = 100 + Math.random() * 100;
        } else if (action === 'gathering') {
          player.targetX = app.screen.width - 200 + Math.random() * 100;
        } else if (action === 'fighting' && worldState.threats.length > 0) {
          player.targetX = 200 + Math.random() * 200;
        } else {
          player.targetX = app.screen.width / 2 - 50 + Math.random() * 100;
        }
      }

      const dx = player.targetX - player.x;
      if (Math.abs(dx) > 5) {
        player.x += dx * 0.05;
        player.direction = dx > 0 ? 1 : -1;
        player.walkFrame = frame;
      }
    }

    const g = new Graphics();

    // Shadow
    g.ellipse(player.x + 24, groundY - 5, 20, 8);
    g.fill(0x000000);
    g.alpha = 0.3;
    layer.addChild(g);

    // Character
    const charG = new Graphics();
    const isWalking = Math.abs(player.targetX - player.x) > 5;
    const sprite = isWalking && Math.floor(frame / 10) % 2 === 0 ? CHARACTER_WALK1 : CHARACTER_IDLE;

    drawSprite(charG, sprite, player.x, groundY - 72, PIXEL_SCALE, player.direction === -1);
    layer.addChild(charG);

    // Action indicator above head
    if (currentAction && isActive) {
      const bubbleG = new Graphics();
      bubbleG.roundRect(player.x - 30, groundY - 110, 110, 30, 8);
      bubbleG.fill(0xFFFFFF);
      layer.addChild(bubbleG);

      const actionText = new Text({
        text: currentAction.length > 15 ? currentAction.slice(0, 15) + '...' : currentAction,
        style: new TextStyle({
          fontFamily: 'monospace',
          fontSize: 11,
          fontWeight: 'bold',
          fill: 0x333333,
        }),
      });
      actionText.x = player.x - 25;
      actionText.y = groundY - 105;
      layer.addChild(actionText);
    }

    // Health bar above character
    const barWidth = 40;
    const barHeight = 6;
    const barX = player.x + 4;
    const barY = groundY - 125;

    // Background
    const barBg = new Graphics();
    barBg.rect(barX, barY, barWidth, barHeight);
    barBg.fill(0x333333);
    layer.addChild(barBg);

    // Health fill
    const healthPercent = playerStats.health / 100;
    const barFill = new Graphics();
    barFill.rect(barX, barY, barWidth * healthPercent, barHeight);
    barFill.fill(healthPercent > 0.5 ? 0x22C55E : healthPercent > 0.25 ? 0xFBBF24 : 0xEF4444);
    layer.addChild(barFill);
  }, [isPlaying, isPaused, currentAction, playerStats.health, worldState.threats]);

  // Render UI
  const renderUI = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('ui') as Container;
    layer.removeChildren();

    const width = app.screen.width;

    // Day counter
    const dayBg = new Graphics();
    dayBg.roundRect(width - 120, 10, 110, 35, 8);
    dayBg.fill(0x000000);
    dayBg.alpha = 0.7;
    layer.addChild(dayBg);

    const dayText = new Text({
      text: `Day ${worldState.daysSurvived + 1}`,
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 18,
        fontWeight: 'bold',
        fill: 0xFFFFFF,
      }),
    });
    dayText.x = width - 100;
    dayText.y = 18;
    layer.addChild(dayText);

    // Time indicator
    const timeBg = new Graphics();
    timeBg.roundRect(10, 10, 100, 35, 8);
    timeBg.fill(0x000000);
    timeBg.alpha = 0.7;
    layer.addChild(timeBg);

    const timeEmoji: Record<string, string> = { dawn: '🌅', day: '☀️', dusk: '🌇', night: '🌙' };
    const timeText = new Text({
      text: `${timeEmoji[worldState.timeOfDay] || '☀️'} ${worldState.timeOfDay}`,
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 14,
        fontWeight: 'bold',
        fill: 0xFFFFFF,
      }),
    });
    timeText.x = 20;
    timeText.y = 20;
    layer.addChild(timeText);

    // Weather
    if (worldState.weather !== 'clear') {
      const weatherText = new Text({
        text: worldState.weather === 'rain' ? '🌧️' : worldState.weather === 'storm' ? '⛈️' : '☁️',
        style: new TextStyle({ fontSize: 24 }),
      });
      weatherText.x = width / 2 - 15;
      weatherText.y = 10;
      layer.addChild(weatherText);
    }
  }, [worldState]);

  // Main render loop
  useEffect(() => {
    if (!isLoaded || !appRef.current) return;

    let animId: number;

    const loop = () => {
      frameRef.current++;

      renderSky();
      renderClouds();
      renderGround();
      renderObjects();
      renderEnemies();
      renderPlayer();
      renderUI();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isLoaded, renderSky, renderClouds, renderGround, renderObjects, renderEnemies, renderPlayer, renderUI]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border-4 border-gray-800 bg-gray-900">
      <div ref={containerRef} className="w-full" style={{ height: 450, imageRendering: 'pixelated' }} />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="flex flex-col items-center gap-4">
            <div className="text-4xl animate-bounce">🎮</div>
            <span className="text-white font-mono font-bold">Loading Pixel World...</span>
          </div>
        </div>
      )}
    </div>
  );
}
