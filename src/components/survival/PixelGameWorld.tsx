'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { useSurvivalStore } from '@/store/survival';
import {
  COLORS,
  CHARACTER_IDLE,
  CHARACTER_WALK,
  CHARACTER_CHOP,
  CHARACTER_GATHER,
  TREE_PINE,
  TREE_OAK,
  WOLF,
  BEAR,
  BUSH,
  BERRY_BUSH,
  SUN,
  MOON,
  CLOUD,
  GRASS,
  FLOWER_RED,
  FLOWER_YELLOW,
  ROCK,
  ANIMATION_CONFIG,
  getAnimationFrames,
} from './SpriteAssets';

const PIXEL_SCALE = 3;

// ============================================
// ANIMATION MANAGER
// ============================================
class AnimationManager {
  private currentAnimation: string = 'idle';
  private currentFrame: number = 0;
  private frameTime: number = 0;
  private lastTime: number = 0;

  update(deltaTime: number): number {
    this.frameTime += deltaTime;
    const config = ANIMATION_CONFIG[this.currentAnimation as keyof typeof ANIMATION_CONFIG] || ANIMATION_CONFIG.idle;
    const frameInterval = 1000 / config.fps;

    if (this.frameTime >= frameInterval) {
      this.frameTime = 0;
      this.currentFrame++;
      if (this.currentFrame >= config.frames) {
        this.currentFrame = config.loop ? 0 : config.frames - 1;
      }
    }
    return this.currentFrame;
  }

  setAnimation(animation: string) {
    if (this.currentAnimation !== animation) {
      this.currentAnimation = animation;
      this.currentFrame = 0;
      this.frameTime = 0;
    }
  }

  getFrame(): number {
    return this.currentFrame;
  }
}

// ============================================
// PARTICLE SYSTEM
// ============================================
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
  type: string;
  gravity?: number;
}

// ============================================
// SPRITE DRAWING FUNCTIONS
// ============================================
function drawSprite(
  graphics: Graphics,
  sprite: number[][],
  x: number,
  y: number,
  scale: number = PIXEL_SCALE,
  flipX: boolean = false,
  alpha: number = 1
) {
  if (!sprite || sprite.length === 0) return;

  const width = sprite[0].length;
  const height = sprite.length;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const color = sprite[row][col];
      if (color === 0) continue;

      const px = flipX ? x + (width - 1 - col) * scale : x + col * scale;
      const py = y + row * scale;

      graphics.rect(px, py, scale, scale);
      graphics.fill({ color, alpha });
    }
  }
}

function drawAnimatedSprite(
  graphics: Graphics,
  frames: number[][][],
  frameIndex: number,
  x: number,
  y: number,
  scale: number = PIXEL_SCALE,
  flipX: boolean = false
) {
  const frame = frames[Math.min(frameIndex, frames.length - 1)];
  if (frame) {
    drawSprite(graphics, frame, x, y, scale, flipX);
  }
}

// ============================================
// WORLD OBJECTS
// ============================================
interface WorldObject {
  x: number;
  y: number;
  type: 'tree_pine' | 'tree_oak' | 'bush' | 'berry' | 'rock' | 'grass' | 'flower_red' | 'flower_yellow';
  scale: number;
  sway: number;
}

interface Enemy {
  x: number;
  y: number;
  type: 'wolf' | 'bear';
  direction: number;
  walkFrame: number;
}

// ============================================
// MAIN COMPONENT
// ============================================
export function PixelGameWorld() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const { worldState, playerStats, currentAction, isPlaying, isPaused } = useSurvivalStore();

  // Animation manager
  const animManagerRef = useRef(new AnimationManager());

  // World data
  const worldObjectsRef = useRef<WorldObject[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const screenShakeRef = useRef({ x: 0, y: 0, intensity: 0 });

  // Player state
  const playerRef = useRef({
    x: 400,
    targetX: 400,
    y: 0,
    direction: 1,
    animFrame: 0,
    actionType: 'idle' as string,
    isMoving: false,
  });

  // Detect action type from action string
  const getActionType = useCallback((action: string): string => {
    const a = action.toLowerCase();
    if (a.includes('chop') || a.includes('wood') || a.includes('cut')) return 'chop';
    if (a.includes('gather') || a.includes('berr') || a.includes('pick') || a.includes('collect')) return 'gather';
    if (a.includes('fight') || a.includes('attack') || a.includes('defend')) return 'attack';
    if (a.includes('walk') || a.includes('move') || a.includes('go') || a.includes('travel') || a.includes('run')) return 'walk';
    if (a.includes('rest') || a.includes('sleep')) return 'idle';
    return 'idle';
  }, []);

  // Update action when it changes
  useEffect(() => {
    if (currentAction) {
      const actionType = getActionType(currentAction);
      playerRef.current.actionType = actionType;
      animManagerRef.current.setAnimation(actionType);
    }
  }, [currentAction, getActionType]);

  // Spawn particles
  const spawnParticles = useCallback((x: number, y: number, type: string, count: number = 5) => {
    const colors: Record<string, number[]> = {
      wood: [0x8B4513, 0xA0522D, 0xD2691E],
      leaf: [0x228B22, 0x32CD32, 0x90EE90],
      sparkle: [0xFFD700, 0xFFF8DC, 0xFFFFE0],
      dust: [0xD2B48C, 0xDEB887, 0xF5DEB3],
      blood: [0xFF4444, 0xCC0000, 0x990000],
      berry: [0xFF6B6B, 0xE74C3C, 0xC0392B],
    };

    const particleColors = colors[type] || colors.dust;

    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 4 - 2,
        life: 40 + Math.random() * 20,
        maxLife: 50,
        color: particleColors[Math.floor(Math.random() * particleColors.length)],
        size: 2 + Math.random() * 3,
        type,
        gravity: 0.15,
      });
    }
  }, []);

  // Screen shake
  const triggerScreenShake = useCallback((intensity: number) => {
    screenShakeRef.current.intensity = intensity;
  }, []);

  // Generate world objects
  const initWorld = useCallback((width: number) => {
    const objects: WorldObject[] = [];
    const groundY = 350;

    // Trees on left
    for (let i = 0; i < 5; i++) {
      objects.push({
        x: 30 + i * 70,
        y: groundY - 140,
        type: Math.random() > 0.5 ? 'tree_pine' : 'tree_oak',
        scale: 1.5 + Math.random() * 0.5,
        sway: Math.random() * Math.PI * 2,
      });
    }

    // Trees on right
    for (let i = 0; i < 4; i++) {
      objects.push({
        x: width - 280 + i * 70,
        y: groundY - 140,
        type: Math.random() > 0.5 ? 'tree_pine' : 'tree_oak',
        scale: 1.5 + Math.random() * 0.5,
        sway: Math.random() * Math.PI * 2,
      });
    }

    // Bushes with berries
    for (let i = 0; i < 8; i++) {
      const x = 100 + Math.random() * (width - 200);
      if (x > width / 2 - 80 && x < width / 2 + 80) continue;
      objects.push({
        x,
        y: groundY - 30,
        type: Math.random() > 0.4 ? 'berry' : 'bush',
        scale: 1.8 + Math.random() * 0.4,
        sway: Math.random() * Math.PI * 2,
      });
    }

    // Grass tufts
    for (let i = 0; i < 20; i++) {
      objects.push({
        x: Math.random() * width,
        y: groundY - 8,
        type: 'grass',
        scale: 1 + Math.random() * 0.5,
        sway: Math.random() * Math.PI * 2,
      });
    }

    // Flowers
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * width;
      if (x > width / 2 - 100 && x < width / 2 + 100) continue;
      objects.push({
        x,
        y: groundY - 15,
        type: Math.random() > 0.5 ? 'flower_red' : 'flower_yellow',
        scale: 1.5,
        sway: Math.random() * Math.PI * 2,
      });
    }

    // Rocks
    for (let i = 0; i < 4; i++) {
      objects.push({
        x: Math.random() * width,
        y: groundY - 15,
        type: 'rock',
        scale: 1.5 + Math.random() * 0.5,
        sway: 0,
      });
    }

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
        antialias: false,
        resolution: 1,
      });

      containerRef.current!.appendChild(app.canvas);
      appRef.current = app;

      // Create layers
      const layers = ['sky', 'clouds', 'background', 'ground', 'objects', 'enemies', 'player', 'particles', 'ui'];
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

  // Render sky with gradient
  const renderSky = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('sky') as Container;
    layer.removeChildren();

    const width = app.screen.width;
    const height = 350;
    const time = worldState.timeOfDay;

    const g = new Graphics();

    // Sky colors by time
    const skyGradients: Record<string, number[]> = {
      dawn: [0xFFB6C1, 0xFFA07A, 0x87CEEB],
      day: [0x87CEEB, 0xADD8E6, 0xB0E0E6],
      dusk: [0xFF6B6B, 0xFF8C42, 0x4B0082],
      night: [0x191970, 0x0D0D2B, 0x000011],
    };

    const colors = skyGradients[time] || skyGradients.day;
    const steps = 15;

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const colorIndex = Math.floor(t * (colors.length - 1));
      const nextIndex = Math.min(colorIndex + 1, colors.length - 1);
      const localT = (t * (colors.length - 1)) % 1;

      const r1 = (colors[colorIndex] >> 16) & 0xFF;
      const g1 = (colors[colorIndex] >> 8) & 0xFF;
      const b1 = colors[colorIndex] & 0xFF;
      const r2 = (colors[nextIndex] >> 16) & 0xFF;
      const g2 = (colors[nextIndex] >> 8) & 0xFF;
      const b2 = colors[nextIndex] & 0xFF;

      const r = Math.round(r1 + (r2 - r1) * localT);
      const gv = Math.round(g1 + (g2 - g1) * localT);
      const b = Math.round(b1 + (b2 - b1) * localT);
      const color = (r << 16) | (gv << 8) | b;

      g.rect(0, i * (height / steps), width, height / steps + 1);
      g.fill(color);
    }

    layer.addChild(g);

    // Sun or Moon
    const celestial = new Graphics();
    if (time === 'night') {
      drawSprite(celestial, MOON, width - 120, 40, 4);

      // Stars
      for (let i = 0; i < 30; i++) {
        const sx = (Math.sin(i * 1234.5) * 0.5 + 0.5) * width;
        const sy = (Math.cos(i * 5678.9) * 0.5 + 0.5) * height * 0.7;
        const twinkle = Math.sin(frameRef.current * 0.05 + i) * 0.5 + 0.5;
        celestial.circle(sx, sy, 1 + Math.random());
        celestial.fill({ color: 0xFFFFFF, alpha: twinkle * 0.8 });
      }
    } else {
      const sunX = time === 'dawn' ? 100 : time === 'dusk' ? width - 120 : width / 2 - 32;
      const sunY = time === 'day' ? 50 : 100;
      drawSprite(celestial, SUN, sunX, sunY, 4);
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

    for (let i = 0; i < 4; i++) {
      const cloudG = new Graphics();
      const x = ((i * 280 + frame * 0.2) % (width + 150)) - 80;
      const y = 40 + i * 35 + Math.sin(i * 1.5) * 20;
      drawSprite(cloudG, CLOUD, x, y, 2);
      cloudG.alpha = worldState.timeOfDay === 'night' ? 0.2 : 0.85;
      layer.addChild(cloudG);
    }
  }, [worldState.timeOfDay]);

  // Render ground
  const renderGround = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('ground') as Container;
    if (layer.children.length > 0) return;

    const width = app.screen.width;
    const height = app.screen.height;
    const groundY = 350;

    const g = new Graphics();

    // Main grass
    g.rect(0, groundY, width, height - groundY);
    g.fill(0x4CAF50);

    // Grass texture variations
    for (let x = 0; x < width; x += PIXEL_SCALE) {
      const grassH = 6 + Math.sin(x * 0.08) * 3 + Math.random() * 2;
      g.rect(x, groundY - grassH, PIXEL_SCALE, grassH);
      g.fill(Math.random() > 0.4 ? 0x66BB6A : 0x43A047);
    }

    // Dirt patches
    for (let i = 0; i < 30; i++) {
      const px = Math.random() * width;
      const py = groundY + 10 + Math.random() * (height - groundY - 30);
      g.ellipse(px, py, 15 + Math.random() * 25, 6 + Math.random() * 8);
      g.fill(Math.random() > 0.5 ? 0x8D6E63 : 0x795548);
    }

    // Central path
    const pathWidth = 140;
    const pathX = (width - pathWidth) / 2;
    g.roundRect(pathX, groundY - 3, pathWidth, 18, 8);
    g.fill(0xD7CCC8);

    // Path stones
    for (let i = 0; i < 8; i++) {
      const sx = pathX + 15 + i * 15 + Math.random() * 5;
      const sy = groundY + 2 + Math.random() * 8;
      g.ellipse(sx, sy, 4 + Math.random() * 3, 2 + Math.random() * 2);
      g.fill(0xBDBDBD);
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

    // Sort by Y for depth
    const sorted = [...worldObjectsRef.current].sort((a, b) => a.y - b.y);

    sorted.forEach((obj, i) => {
      const g = new Graphics();
      const sway = Math.sin(frame * 0.015 + obj.sway) * 2;

      switch (obj.type) {
        case 'tree_pine':
          drawSprite(g, TREE_PINE, obj.x + sway, obj.y, obj.scale);
          break;
        case 'tree_oak':
          drawSprite(g, TREE_OAK, obj.x + sway, obj.y, obj.scale);
          break;
        case 'bush':
          drawSprite(g, BUSH, obj.x + sway * 0.5, obj.y, obj.scale);
          break;
        case 'berry':
          drawSprite(g, BERRY_BUSH, obj.x + sway * 0.5, obj.y, obj.scale);
          break;
        case 'grass':
          drawSprite(g, GRASS, obj.x + sway * 0.3, obj.y, obj.scale);
          break;
        case 'flower_red':
          drawSprite(g, FLOWER_RED, obj.x + sway * 0.2, obj.y, obj.scale);
          break;
        case 'flower_yellow':
          drawSprite(g, FLOWER_YELLOW, obj.x + sway * 0.2, obj.y, obj.scale);
          break;
        case 'rock':
          drawSprite(g, ROCK, obj.x, obj.y, obj.scale);
          break;
      }

      layer.addChild(g);
    });
  }, []);

  // Render enemies/threats
  const renderEnemies = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('enemies') as Container;
    layer.removeChildren();

    const frame = frameRef.current;
    const groundY = 350;

    worldState.threats.forEach((threat, i) => {
      const g = new Graphics();
      const bounce = Math.sin(frame * 0.08 + i) * 3;
      const x = 180 + i * 180 + Math.sin(frame * 0.02 + i * 2) * 30;

      if (threat.toLowerCase().includes('wolf')) {
        drawSprite(g, WOLF, x, groundY - 55 + bounce, 2.5);
      } else if (threat.toLowerCase().includes('bear')) {
        drawSprite(g, BEAR, x, groundY - 65 + bounce, 2);
      } else {
        // Generic threat
        drawSprite(g, WOLF, x, groundY - 55 + bounce, 2.5);
      }

      // Danger indicator
      const danger = new Graphics();
      danger.circle(x + 30, groundY - 90, 15);
      danger.fill({ color: 0xFF0000, alpha: 0.3 + Math.sin(frame * 0.1) * 0.2 });
      layer.addChild(danger);

      // Exclamation mark
      const exclaim = new Text({
        text: '!',
        style: new TextStyle({
          fontSize: 20,
          fontWeight: 'bold',
          fill: 0xFF0000,
        }),
      });
      exclaim.x = x + 25;
      exclaim.y = groundY - 105;
      exclaim.alpha = 0.5 + Math.sin(frame * 0.15) * 0.5;
      layer.addChild(exclaim);

      layer.addChild(g);
    });
  }, [worldState.threats]);

  // Render player with animations
  const renderPlayer = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('player') as Container;
    layer.removeChildren();

    const frame = frameRef.current;
    const groundY = 350;
    const player = playerRef.current;
    const isActive = isPlaying && !isPaused;

    // Update animation
    const deltaTime = 16; // ~60fps
    const animFrame = animManagerRef.current.update(deltaTime);

    // Update player position based on action
    if (isActive) {
      if (frame % 45 === 0) {
        const action = player.actionType;
        if (action === 'chop') {
          player.targetX = 80 + Math.random() * 100;
        } else if (action === 'gather') {
          player.targetX = app.screen.width - 200 + Math.random() * 80;
        } else if (action === 'attack' && worldState.threats.length > 0) {
          player.targetX = 220 + Math.random() * 150;
        } else {
          player.targetX = app.screen.width / 2 - 40 + Math.random() * 80;
        }
      }

      const dx = player.targetX - player.x;
      if (Math.abs(dx) > 3) {
        player.x += dx * 0.04;
        player.direction = dx > 0 ? 1 : -1;
        player.isMoving = true;
        if (player.actionType === 'idle') {
          animManagerRef.current.setAnimation('walk');
        }
      } else {
        player.isMoving = false;
        if (player.actionType === 'idle') {
          animManagerRef.current.setAnimation('idle');
        }
      }

      // Spawn action particles
      if (frame % 30 === 0) {
        if (player.actionType === 'chop') {
          spawnParticles(player.x + 24, groundY - 40, 'wood', 3);
        } else if (player.actionType === 'gather') {
          spawnParticles(player.x + 24, groundY - 30, 'berry', 2);
        } else if (player.actionType === 'attack') {
          spawnParticles(player.x + 24, groundY - 50, 'dust', 4);
          triggerScreenShake(3);
        }
      }
    }

    // Get animation frames
    const frames = getAnimationFrames(player.actionType);
    const currentFrame = animFrame % frames.length;

    // Shadow
    const shadow = new Graphics();
    shadow.ellipse(player.x + 24, groundY - 3, 18, 7);
    shadow.fill({ color: 0x000000, alpha: 0.25 });
    layer.addChild(shadow);

    // Character sprite
    const charG = new Graphics();
    const bounce = player.isMoving ? Math.abs(Math.sin(frame * 0.15)) * 2 : 0;

    drawAnimatedSprite(
      charG,
      frames,
      currentFrame,
      player.x,
      groundY - 72 - bounce,
      PIXEL_SCALE,
      player.direction === -1
    );
    layer.addChild(charG);

    // Action speech bubble
    if (currentAction && isActive) {
      const bubbleG = new Graphics();
      bubbleG.roundRect(player.x - 20, groundY - 105, 90, 26, 6);
      bubbleG.fill({ color: 0xFFFFFF, alpha: 0.95 });

      // Bubble pointer
      bubbleG.moveTo(player.x + 20, groundY - 79);
      bubbleG.lineTo(player.x + 25, groundY - 72);
      bubbleG.lineTo(player.x + 30, groundY - 79);
      bubbleG.fill({ color: 0xFFFFFF, alpha: 0.95 });

      layer.addChild(bubbleG);

      const actionText = new Text({
        text: currentAction.length > 12 ? currentAction.slice(0, 12) + '...' : currentAction,
        style: new TextStyle({
          fontFamily: 'monospace',
          fontSize: 10,
          fontWeight: 'bold',
          fill: 0x333333,
        }),
      });
      actionText.x = player.x - 15;
      actionText.y = groundY - 100;
      layer.addChild(actionText);
    }

    // Health bar
    const barWidth = 36;
    const barHeight = 5;
    const barX = player.x + 6;
    const barY = groundY - 115;

    const barBg = new Graphics();
    barBg.roundRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2, 2);
    barBg.fill(0x333333);
    layer.addChild(barBg);

    const healthPercent = playerStats.health / 100;
    const barFill = new Graphics();
    barFill.roundRect(barX, barY, barWidth * healthPercent, barHeight, 1);
    barFill.fill(healthPercent > 0.5 ? 0x4CAF50 : healthPercent > 0.25 ? 0xFFC107 : 0xF44336);
    layer.addChild(barFill);
  }, [isPlaying, isPaused, currentAction, playerStats.health, worldState.threats, spawnParticles, triggerScreenShake]);

  // Render particles
  const renderParticles = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('particles') as Container;
    layer.removeChildren();

    // Update and render particles
    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity || 0.1;
      p.vx *= 0.98;
      p.life--;

      if (p.life <= 0) return false;

      const alpha = p.life / p.maxLife;
      const g = new Graphics();
      g.circle(p.x, p.y, p.size * alpha);
      g.fill({ color: p.color, alpha });
      layer.addChild(g);

      return true;
    });

    // Limit particles
    if (particlesRef.current.length > 100) {
      particlesRef.current = particlesRef.current.slice(-50);
    }
  }, []);

  // Render UI
  const renderUI = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const layer = app.stage.getChildByLabel('ui') as Container;
    layer.removeChildren();

    const width = app.screen.width;

    // Day counter
    const dayBg = new Graphics();
    dayBg.roundRect(width - 115, 12, 105, 32, 6);
    dayBg.fill({ color: 0x000000, alpha: 0.6 });
    layer.addChild(dayBg);

    const dayText = new Text({
      text: `Day ${worldState.daysSurvived + 1}`,
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 16,
        fontWeight: 'bold',
        fill: 0xFFFFFF,
      }),
    });
    dayText.x = width - 95;
    dayText.y = 20;
    layer.addChild(dayText);

    // Time indicator
    const timeBg = new Graphics();
    timeBg.roundRect(12, 12, 95, 32, 6);
    timeBg.fill({ color: 0x000000, alpha: 0.6 });
    layer.addChild(timeBg);

    const timeEmoji: Record<string, string> = {
      dawn: '🌅',
      day: '☀️',
      dusk: '🌇',
      night: '🌙'
    };

    const timeText = new Text({
      text: `${timeEmoji[worldState.timeOfDay] || '☀️'} ${worldState.timeOfDay}`,
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 13,
        fontWeight: 'bold',
        fill: 0xFFFFFF,
      }),
    });
    timeText.x = 22;
    timeText.y = 21;
    layer.addChild(timeText);

    // Weather indicator
    if (worldState.weather !== 'clear') {
      const weatherBg = new Graphics();
      weatherBg.roundRect(width / 2 - 40, 12, 80, 28, 6);
      weatherBg.fill({ color: 0x000000, alpha: 0.5 });
      layer.addChild(weatherBg);

      const weatherEmoji = worldState.weather === 'rain' ? '🌧️' : worldState.weather === 'storm' ? '⛈️' : '☁️';
      const weatherText = new Text({
        text: weatherEmoji + ' ' + worldState.weather,
        style: new TextStyle({
          fontSize: 12,
          fill: 0xFFFFFF,
        }),
      });
      weatherText.x = width / 2 - 30;
      weatherText.y = 17;
      layer.addChild(weatherText);
    }

    // Render rain/storm
    if (worldState.weather === 'rain' || worldState.weather === 'storm') {
      const frame = frameRef.current;
      const intensity = worldState.weather === 'storm' ? 50 : 25;

      for (let i = 0; i < intensity; i++) {
        const x = (Math.sin(i * 1234.5) * 0.5 + 0.5) * width;
        const y = ((frame * 8 + i * 30) % 500) - 50;

        const drop = new Graphics();
        drop.moveTo(x, y);
        drop.lineTo(x + 1, y + 12);
        drop.stroke({ color: 0x4FC3F7, width: 1.5, alpha: 0.6 });
        layer.addChild(drop);
      }

      if (worldState.weather === 'storm' && Math.random() < 0.01) {
        const lightning = new Graphics();
        lightning.rect(0, 0, width, 450);
        lightning.fill({ color: 0xFFFFFF, alpha: 0.3 });
        layer.addChild(lightning);
      }
    }
  }, [worldState]);

  // Main render loop
  useEffect(() => {
    if (!isLoaded || !appRef.current) return;

    let animId: number;

    const loop = (timestamp: number) => {
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;
      frameRef.current++;

      // Screen shake
      if (screenShakeRef.current.intensity > 0) {
        screenShakeRef.current.x = (Math.random() - 0.5) * screenShakeRef.current.intensity;
        screenShakeRef.current.y = (Math.random() - 0.5) * screenShakeRef.current.intensity;
        screenShakeRef.current.intensity *= 0.9;

        if (appRef.current) {
          appRef.current.stage.x = screenShakeRef.current.x;
          appRef.current.stage.y = screenShakeRef.current.y;
        }
      } else if (appRef.current) {
        appRef.current.stage.x = 0;
        appRef.current.stage.y = 0;
      }

      renderSky();
      renderClouds();
      renderGround();
      renderObjects();
      renderEnemies();
      renderPlayer();
      renderParticles();
      renderUI();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isLoaded, renderSky, renderClouds, renderGround, renderObjects, renderEnemies, renderPlayer, renderParticles, renderUI]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border-4 border-gray-800 bg-gray-900 shadow-2xl">
      <div
        ref={containerRef}
        className="w-full"
        style={{ height: 450, imageRendering: 'pixelated' }}
      />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="flex flex-col items-center gap-4">
            <div className="text-5xl animate-bounce">🎮</div>
            <span className="text-white font-mono font-bold text-lg">Loading Pixel World...</span>
            <div className="flex gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse delay-100" />
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse delay-200" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
