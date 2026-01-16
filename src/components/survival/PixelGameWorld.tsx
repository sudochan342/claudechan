'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { useSurvivalStore } from '@/store/survival';
import {
  PALETTE,
  HERO_IDLE,
  HERO_WALK,
  HERO_CHOP,
  HERO_GATHER,
  TREE,
  BUSH,
  BERRY_BUSH,
  ROCK,
  WOLF,
  BEAR,
  SUN,
  MOON,
  CLOUD,
  getActionSprites,
} from './SpriteAssets';

// BIG chunky pixels for that retro look
const PIXEL_SIZE = 4;

// ============================================
// SPRITE DRAWING - Classic pixel-by-pixel
// ============================================
function drawSprite(
  g: Graphics,
  sprite: number[][],
  x: number,
  y: number,
  scale: number = 1,
  flipX: boolean = false
) {
  const size = PIXEL_SIZE * scale;

  for (let row = 0; row < sprite.length; row++) {
    for (let col = 0; col < sprite[row].length; col++) {
      const colorIndex = sprite[row][col];
      if (colorIndex === 0) continue;

      const color = PALETTE[colorIndex as keyof typeof PALETTE];
      const px = flipX
        ? x + (sprite[row].length - 1 - col) * size
        : x + col * size;
      const py = y + row * size;

      g.rect(px, py, size, size);
      g.fill(color);
    }
  }
}

// ============================================
// WORLD DATA
// ============================================
interface WorldObj {
  x: number;
  y: number;
  type: 'tree' | 'bush' | 'berry' | 'rock';
}

// ============================================
// MAIN COMPONENT
// ============================================
export function PixelGameWorld() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const frameRef = useRef(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const { worldState, playerStats, currentAction, isPlaying, isPaused } = useSurvivalStore();

  // World objects
  const worldObjRef = useRef<WorldObj[]>([]);

  // Player state
  const playerRef = useRef({
    x: 300,
    targetX: 300,
    dir: 1,
    action: 'idle',
  });

  // Detect action type
  const getAction = useCallback((action: string): string => {
    const a = action.toLowerCase();
    if (a.includes('chop') || a.includes('wood') || a.includes('cut')) return 'chop';
    if (a.includes('gather') || a.includes('berr') || a.includes('pick')) return 'gather';
    if (a.includes('fight') || a.includes('attack')) return 'attack';
    if (a.includes('walk') || a.includes('move') || a.includes('go')) return 'walk';
    return 'idle';
  }, []);

  useEffect(() => {
    if (currentAction) {
      playerRef.current.action = getAction(currentAction);
    }
  }, [currentAction, getAction]);

  // Generate world
  const initWorld = useCallback((width: number) => {
    const objs: WorldObj[] = [];

    // Trees on left
    for (let i = 0; i < 4; i++) {
      objs.push({ x: 40 + i * 80, y: 220, type: 'tree' });
    }

    // Trees on right
    for (let i = 0; i < 3; i++) {
      objs.push({ x: width - 280 + i * 80, y: 220, type: 'tree' });
    }

    // Bushes
    for (let i = 0; i < 5; i++) {
      const x = 100 + Math.random() * (width - 200);
      if (x > width / 2 - 80 && x < width / 2 + 80) continue;
      objs.push({ x, y: 310, type: Math.random() > 0.5 ? 'berry' : 'bush' });
    }

    // Rocks
    objs.push({ x: 150, y: 320, type: 'rock' });
    objs.push({ x: width - 200, y: 320, type: 'rock' });

    worldObjRef.current = objs;
  }, []);

  // Initialize PixiJS
  useEffect(() => {
    if (!containerRef.current || appRef.current) return;

    const init = async () => {
      const app = new Application();
      await app.init({
        width: containerRef.current!.clientWidth,
        height: 400,
        backgroundColor: 0x000000,
        antialias: false,
        resolution: 1,
      });

      containerRef.current!.appendChild(app.canvas);
      appRef.current = app;

      // Layers
      ['sky', 'bg', 'objects', 'enemies', 'player', 'ui'].forEach(name => {
        const c = new Container();
        c.label = name;
        app.stage.addChild(c);
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

  // Render sky - solid color blocks like old RPGs
  const renderSky = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('sky') as Container;
    layer.removeChildren();

    const width = app.screen.width;
    const g = new Graphics();
    const time = worldState.timeOfDay;

    // Sky color based on time
    const skyColors: Record<string, number> = {
      dawn: 0xFFB090,
      day: 0x68B8F8,
      dusk: 0xFF6060,
      night: 0x101030,
    };

    // Solid sky
    g.rect(0, 0, width, 280);
    g.fill(skyColors[time] || skyColors.day);
    layer.addChild(g);

    // Sun or Moon
    const celestial = new Graphics();
    if (time === 'night') {
      drawSprite(celestial, MOON, width - 100, 30, 1.5);

      // Stars - simple white pixels
      for (let i = 0; i < 20; i++) {
        const sx = (i * 37) % width;
        const sy = 20 + (i * 23) % 150;
        const twinkle = Math.sin(frameRef.current * 0.1 + i) > 0;
        if (twinkle) {
          celestial.rect(sx, sy, PIXEL_SIZE, PIXEL_SIZE);
          celestial.fill(0xFFFFFF);
        }
      }
    } else {
      const sunX = time === 'dawn' ? 80 : time === 'dusk' ? width - 100 : width / 2 - 32;
      drawSprite(celestial, SUN, sunX, 30, 1.5);
    }
    layer.addChild(celestial);

    // Clouds
    const cloudG = new Graphics();
    const cloudAlpha = time === 'night' ? 0.3 : 0.9;
    for (let i = 0; i < 3; i++) {
      const cx = ((frameRef.current * 0.3 + i * 250) % (width + 100)) - 50;
      const cy = 50 + i * 40;
      cloudG.alpha = cloudAlpha;
      drawSprite(cloudG, CLOUD, cx, cy, 1.2);
    }
    layer.addChild(cloudG);
  }, [worldState.timeOfDay]);

  // Render ground - simple grass tiles
  const renderBg = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('bg') as Container;
    if (layer.children.length > 0) return;

    const width = app.screen.width;
    const height = app.screen.height;
    const g = new Graphics();

    // Grass base
    g.rect(0, 280, width, height - 280);
    g.fill(0x40A820);

    // Grass pattern - alternating shades like old RPGs
    for (let x = 0; x < width; x += PIXEL_SIZE * 4) {
      for (let y = 280; y < height; y += PIXEL_SIZE * 4) {
        if ((x + y) % (PIXEL_SIZE * 8) === 0) {
          g.rect(x, y, PIXEL_SIZE * 2, PIXEL_SIZE * 2);
          g.fill(0x60D040);
        }
      }
    }

    // Dirt path in middle
    const pathX = width / 2 - 60;
    g.rect(pathX, 280, 120, height - 280);
    g.fill(0x906830);

    // Path detail
    for (let y = 285; y < height; y += PIXEL_SIZE * 6) {
      g.rect(pathX + 20, y, PIXEL_SIZE * 2, PIXEL_SIZE * 2);
      g.fill(0x604020);
      g.rect(pathX + 80, y + PIXEL_SIZE * 3, PIXEL_SIZE * 2, PIXEL_SIZE * 2);
      g.fill(0x604020);
    }

    layer.addChild(g);
  }, []);

  // Render world objects
  const renderObjects = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('objects') as Container;
    layer.removeChildren();

    const frame = frameRef.current;

    worldObjRef.current.forEach(obj => {
      const g = new Graphics();
      // Simple sway for trees
      const sway = obj.type === 'tree' ? Math.sin(frame * 0.02) * 2 : 0;

      switch (obj.type) {
        case 'tree':
          drawSprite(g, TREE, obj.x + sway, obj.y, 2);
          break;
        case 'bush':
          drawSprite(g, BUSH, obj.x, obj.y, 1.5);
          break;
        case 'berry':
          drawSprite(g, BERRY_BUSH, obj.x, obj.y, 1.5);
          break;
        case 'rock':
          drawSprite(g, ROCK, obj.x, obj.y, 1.5);
          break;
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

    worldState.threats.forEach((threat, i) => {
      const g = new Graphics();
      const bounce = Math.sin(frame * 0.1 + i) * 3;
      const x = 180 + i * 150;
      const y = 290 + bounce;

      if (threat.toLowerCase().includes('wolf')) {
        drawSprite(g, WOLF, x, y, 2);
      } else {
        drawSprite(g, BEAR, x, y, 2);
      }

      // Danger indicator - simple red square
      const danger = new Graphics();
      const flash = Math.sin(frame * 0.15) > 0;
      if (flash) {
        danger.rect(x + 20, y - 30, PIXEL_SIZE * 4, PIXEL_SIZE * 4);
        danger.fill(0xF83030);
      }
      layer.addChild(danger);

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
    const player = playerRef.current;
    const isActive = isPlaying && !isPaused;

    // Update position
    if (isActive && frame % 60 === 0) {
      const action = player.action;
      if (action === 'chop') {
        player.targetX = 100;
      } else if (action === 'gather') {
        player.targetX = app.screen.width - 150;
      } else if (action === 'attack' && worldState.threats.length > 0) {
        player.targetX = 200;
      } else {
        player.targetX = app.screen.width / 2;
      }
    }

    const dx = player.targetX - player.x;
    if (Math.abs(dx) > 3) {
      player.x += dx * 0.05;
      player.dir = dx > 0 ? 1 : -1;
    }

    // Get animation frames
    const isWalking = Math.abs(dx) > 3;
    let sprites;
    if (isWalking) {
      sprites = HERO_WALK;
    } else if (player.action === 'chop' || player.action === 'attack') {
      sprites = HERO_CHOP;
    } else if (player.action === 'gather') {
      sprites = HERO_GATHER;
    } else {
      sprites = HERO_IDLE;
    }

    // Simple 2-frame animation
    const animFrame = Math.floor(frame / 15) % sprites.length;
    const sprite = sprites[animFrame];

    // Shadow
    const shadow = new Graphics();
    shadow.ellipse(player.x + 32, 350, 20, 6);
    shadow.fill({ color: 0x000000, alpha: 0.3 });
    layer.addChild(shadow);

    // Character
    const charG = new Graphics();
    drawSprite(charG, sprite, player.x, 280, 2.5, player.dir === -1);
    layer.addChild(charG);

    // Speech bubble for action
    if (currentAction && isActive) {
      const bubbleG = new Graphics();
      // Pixel art speech bubble
      bubbleG.rect(player.x - 10, 240, 90, 30);
      bubbleG.fill(0xFFFFFF);
      bubbleG.rect(player.x + 30, 270, 8, 8);
      bubbleG.fill(0xFFFFFF);

      layer.addChild(bubbleG);

      const actionText = new Text({
        text: currentAction.length > 10 ? currentAction.slice(0, 10) + '..' : currentAction,
        style: new TextStyle({
          fontFamily: 'monospace',
          fontSize: 10,
          fontWeight: 'bold',
          fill: 0x000000,
        }),
      });
      actionText.x = player.x - 5;
      actionText.y = 248;
      layer.addChild(actionText);
    }

    // Health bar - pixel style
    const barX = player.x;
    const barY = 230;
    const barW = 64;
    const barH = 8;

    const barBg = new Graphics();
    barBg.rect(barX, barY, barW, barH);
    barBg.fill(0x000000);
    layer.addChild(barBg);

    const healthPct = playerStats.health / 100;
    const barFill = new Graphics();
    barFill.rect(barX + 2, barY + 2, (barW - 4) * healthPct, barH - 4);
    barFill.fill(healthPct > 0.5 ? 0x40A820 : healthPct > 0.25 ? 0xF8D830 : 0xF83030);
    layer.addChild(barFill);
  }, [isPlaying, isPaused, currentAction, playerStats.health, worldState.threats]);

  // Render UI
  const renderUI = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('ui') as Container;
    layer.removeChildren();

    const width = app.screen.width;

    // Day counter - pixel box
    const dayBg = new Graphics();
    dayBg.rect(width - 100, 8, 92, 28);
    dayBg.fill(0x000000);
    dayBg.rect(width - 98, 10, 88, 24);
    dayBg.fill(0x202040);
    layer.addChild(dayBg);

    const dayText = new Text({
      text: `DAY ${worldState.daysSurvived + 1}`,
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 14,
        fontWeight: 'bold',
        fill: 0xFFFFFF,
      }),
    });
    dayText.x = width - 85;
    dayText.y = 14;
    layer.addChild(dayText);

    // Time indicator
    const timeBg = new Graphics();
    timeBg.rect(8, 8, 80, 28);
    timeBg.fill(0x000000);
    timeBg.rect(10, 10, 76, 24);
    timeBg.fill(0x202040);
    layer.addChild(timeBg);

    const timeEmoji: Record<string, string> = {
      dawn: 'DAWN',
      day: 'DAY',
      dusk: 'DUSK',
      night: 'NIGHT',
    };

    const timeText = new Text({
      text: timeEmoji[worldState.timeOfDay] || 'DAY',
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: 'bold',
        fill: 0xFFFFFF,
      }),
    });
    timeText.x = 20;
    timeText.y = 16;
    layer.addChild(timeText);

    // Weather
    if (worldState.weather !== 'clear') {
      const frame = frameRef.current;

      // Rain drops - simple vertical lines
      if (worldState.weather === 'rain' || worldState.weather === 'storm') {
        const intensity = worldState.weather === 'storm' ? 40 : 20;
        const rainG = new Graphics();

        for (let i = 0; i < intensity; i++) {
          const rx = (i * 31) % width;
          const ry = ((frame * 6 + i * 23) % 420) - 20;
          rainG.rect(rx, ry, 2, 10);
          rainG.fill({ color: 0x68B8F8, alpha: 0.7 });
        }
        layer.addChild(rainG);

        // Lightning flash
        if (worldState.weather === 'storm' && Math.random() < 0.01) {
          const flash = new Graphics();
          flash.rect(0, 0, width, 400);
          flash.fill({ color: 0xFFFFFF, alpha: 0.4 });
          layer.addChild(flash);
        }
      }
    }
  }, [worldState]);

  // Main loop
  useEffect(() => {
    if (!isLoaded || !appRef.current) return;

    let animId: number;

    const loop = () => {
      frameRef.current++;

      renderSky();
      renderBg();
      renderObjects();
      renderEnemies();
      renderPlayer();
      renderUI();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isLoaded, renderSky, renderBg, renderObjects, renderEnemies, renderPlayer, renderUI]);

  return (
    <div className="relative w-full rounded-lg overflow-hidden border-4 border-black bg-black shadow-2xl">
      <div
        ref={containerRef}
        className="w-full"
        style={{ height: 400, imageRendering: 'pixelated' }}
      />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-4">
            <div className="text-3xl">LOADING...</div>
            <div className="flex gap-1">
              <div className="w-4 h-4 bg-green-500 animate-pulse" />
              <div className="w-4 h-4 bg-green-500 animate-pulse delay-100" />
              <div className="w-4 h-4 bg-green-500 animate-pulse delay-200" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
