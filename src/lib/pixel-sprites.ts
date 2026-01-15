// Pixel Art Sprite Generator - Creates game sprites programmatically
// This generates all sprites as base64 data URLs for the survival game

export interface SpriteData {
  data: string;
  width: number;
  height: number;
}

// Color palettes
const PALETTES = {
  survivor: ['#2d1b00', '#5c3d1e', '#8b6914', '#f4d03f', '#ffeaa7', '#ffffff'],
  forest: ['#0d1b0d', '#1a3a1a', '#2d5a2d', '#4a7c4a', '#6b9b6b', '#8fbc8f'],
  sky: {
    dawn: ['#1a0a2e', '#3d1f5c', '#8b4513', '#ff6b35', '#ffa07a', '#ffecd2'],
    day: ['#1e3a5f', '#2e6b9b', '#87ceeb', '#b0e0e6', '#e0f7fa', '#ffffff'],
    dusk: ['#1a0a2e', '#4a1c40', '#8b2252', '#cd5c5c', '#ffa07a', '#ffd700'],
    night: ['#000011', '#0a0a2e', '#1a1a4e', '#2e2e6e', '#4a4a8e', '#6b6bae'],
  },
  fire: ['#1a0000', '#4a0000', '#8b0000', '#ff4500', '#ff6b35', '#ffd700', '#ffffff'],
  water: ['#001a33', '#003366', '#0066cc', '#3399ff', '#66ccff', '#99ffff'],
  danger: ['#1a0000', '#4a0000', '#8b0000', '#cd5c5c', '#ff6b6b', '#ff9999'],
};

// Create a canvas and draw pixel art
function createPixelCanvas(width: number, height: number, scale: number = 4): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  setPixel: (x: number, y: number, color: string) => void;
  getDataURL: () => string;
} {
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const setPixel = (x: number, y: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * scale, y * scale, scale, scale);
  };

  const getDataURL = () => canvas.toDataURL('image/png');

  return { canvas, ctx, setPixel, getDataURL };
}

// Generate survivor character sprite (16x24 pixels)
export function generateSurvivorSprite(frame: number = 0): SpriteData {
  const { setPixel, getDataURL } = createPixelCanvas(16, 24, 4);

  // Body colors
  const skin = '#f4d03f';
  const hair = '#5c3d1e';
  const shirt = '#2e6b9b';
  const pants = '#1a3a5f';
  const outline = '#1a0a00';

  // Animation offset
  const walkOffset = frame % 2 === 0 ? 0 : 1;

  // Hair
  for (let x = 5; x <= 10; x++) {
    setPixel(x, 0, hair);
    setPixel(x, 1, hair);
  }
  setPixel(4, 1, hair);
  setPixel(11, 1, hair);

  // Head
  for (let x = 5; x <= 10; x++) {
    for (let y = 2; y <= 6; y++) {
      setPixel(x, y, skin);
    }
  }
  setPixel(4, 3, skin);
  setPixel(4, 4, skin);
  setPixel(11, 3, skin);
  setPixel(11, 4, skin);

  // Eyes
  setPixel(6, 4, outline);
  setPixel(9, 4, outline);

  // Body/Shirt
  for (let x = 5; x <= 10; x++) {
    for (let y = 7; y <= 13; y++) {
      setPixel(x, y, shirt);
    }
  }
  // Arms
  setPixel(4, 8 + walkOffset, skin);
  setPixel(4, 9, shirt);
  setPixel(4, 10 - walkOffset, skin);
  setPixel(11, 8 - walkOffset, skin);
  setPixel(11, 9, shirt);
  setPixel(11, 10 + walkOffset, skin);

  // Pants
  for (let x = 5; x <= 10; x++) {
    for (let y = 14; y <= 19; y++) {
      setPixel(x, y, pants);
    }
  }
  // Leg gap
  setPixel(7, 17, '#0000');
  setPixel(8, 17, '#0000');
  setPixel(7, 18, '#0000');
  setPixel(8, 18, '#0000');

  // Feet
  setPixel(4 + walkOffset, 20, pants);
  setPixel(5, 20, pants);
  setPixel(6, 20, pants);
  setPixel(9, 20, pants);
  setPixel(10, 20, pants);
  setPixel(11 - walkOffset, 20, pants);

  return { data: getDataURL(), width: 64, height: 96 };
}

// Generate tree sprite (32x48 pixels)
export function generateTreeSprite(variant: number = 0): SpriteData {
  const { setPixel, getDataURL } = createPixelCanvas(32, 48, 3);

  const trunk = ['#2d1b00', '#5c3d1e', '#8b6914'][variant % 3];
  const leaves = ['#1a3a1a', '#2d5a2d', '#4a7c4a'];

  // Trunk
  for (let y = 28; y < 48; y++) {
    for (let x = 13; x <= 18; x++) {
      setPixel(x, y, trunk);
    }
  }
  // Trunk detail
  setPixel(14, 35, '#1a0a00');
  setPixel(17, 40, '#1a0a00');

  // Leaves (layered triangles)
  const drawLeafLayer = (startY: number, width: number, color: string) => {
    for (let row = 0; row < 12; row++) {
      const rowWidth = Math.max(1, width - row * 2);
      const startX = 16 - Math.floor(rowWidth / 2);
      for (let x = 0; x < rowWidth; x++) {
        if (Math.random() > 0.1) { // Add some texture
          setPixel(startX + x, startY + row, color);
        }
      }
    }
  };

  drawLeafLayer(0, 20, leaves[0]);
  drawLeafLayer(6, 24, leaves[1]);
  drawLeafLayer(14, 28, leaves[2]);

  // Highlight leaves
  for (let i = 0; i < 15; i++) {
    const x = 8 + Math.floor(Math.random() * 16);
    const y = 2 + Math.floor(Math.random() * 20);
    setPixel(x, y, '#6b9b6b');
  }

  return { data: getDataURL(), width: 96, height: 144 };
}

// Generate wolf sprite (24x16 pixels)
export function generateWolfSprite(frame: number = 0): SpriteData {
  const { setPixel, getDataURL } = createPixelCanvas(24, 16, 4);

  const fur = '#4a4a4a';
  const furLight = '#6b6b6b';
  const furDark = '#2a2a2a';
  const eye = '#ff4444';

  const walkOffset = frame % 2;

  // Body
  for (let x = 6; x <= 18; x++) {
    for (let y = 5; y <= 10; y++) {
      setPixel(x, y, fur);
    }
  }

  // Head
  for (let x = 2; x <= 7; x++) {
    for (let y = 4; y <= 9; y++) {
      setPixel(x, y, fur);
    }
  }

  // Snout
  setPixel(1, 6, furLight);
  setPixel(1, 7, furLight);
  setPixel(0, 7, furDark);

  // Ears
  setPixel(3, 2, fur);
  setPixel(3, 3, fur);
  setPixel(6, 2, fur);
  setPixel(6, 3, fur);

  // Eye
  setPixel(4, 5, eye);

  // Tail
  setPixel(19, 4, fur);
  setPixel(20, 3, fur);
  setPixel(21, 3, furLight);

  // Legs
  setPixel(8, 11 + walkOffset, furDark);
  setPixel(8, 12, furDark);
  setPixel(8, 13 - walkOffset, furDark);

  setPixel(12, 11 - walkOffset, furDark);
  setPixel(12, 12, furDark);
  setPixel(12, 13 + walkOffset, furDark);

  setPixel(16, 11 + walkOffset, furDark);
  setPixel(16, 12, furDark);
  setPixel(16, 13 - walkOffset, furDark);

  return { data: getDataURL(), width: 96, height: 64 };
}

// Generate bear sprite (32x24 pixels)
export function generateBearSprite(frame: number = 0): SpriteData {
  const { setPixel, getDataURL } = createPixelCanvas(32, 24, 3);

  const fur = '#5c3d1e';
  const furLight = '#8b6914';
  const furDark = '#2d1b00';
  const eye = '#000000';
  const nose = '#1a0a00';

  const walkOffset = frame % 2;

  // Body (large oval)
  for (let x = 8; x <= 24; x++) {
    for (let y = 8; y <= 18; y++) {
      const distX = Math.abs(x - 16);
      const distY = Math.abs(y - 13);
      if (distX * distX / 64 + distY * distY / 25 < 1) {
        setPixel(x, y, fur);
      }
    }
  }

  // Head
  for (let x = 2; x <= 10; x++) {
    for (let y = 6; y <= 14; y++) {
      const distX = Math.abs(x - 6);
      const distY = Math.abs(y - 10);
      if (distX * distX / 16 + distY * distY / 16 < 1) {
        setPixel(x, y, fur);
      }
    }
  }

  // Ears
  setPixel(3, 4, furDark);
  setPixel(4, 4, furDark);
  setPixel(8, 4, furDark);
  setPixel(9, 4, furDark);

  // Eyes
  setPixel(4, 9, eye);
  setPixel(8, 9, eye);

  // Nose
  setPixel(5, 11, nose);
  setPixel(6, 11, nose);
  setPixel(7, 11, nose);
  setPixel(6, 12, nose);

  // Legs
  for (let leg = 0; leg < 4; leg++) {
    const lx = 10 + leg * 4;
    const offset = leg % 2 === 0 ? walkOffset : -walkOffset;
    setPixel(lx, 19 + offset, furDark);
    setPixel(lx, 20, furDark);
    setPixel(lx, 21 - offset, furDark);
    setPixel(lx + 1, 19 + offset, furDark);
    setPixel(lx + 1, 20, furDark);
    setPixel(lx + 1, 21 - offset, furDark);
  }

  return { data: getDataURL(), width: 96, height: 72 };
}

// Generate campfire sprite (16x20 pixels)
export function generateCampfireSprite(frame: number = 0): SpriteData {
  const { setPixel, getDataURL } = createPixelCanvas(16, 20, 4);

  const wood = '#5c3d1e';
  const woodDark = '#2d1b00';

  // Logs
  for (let x = 2; x <= 13; x++) {
    setPixel(x, 16, wood);
    setPixel(x, 17, woodDark);
  }
  for (let x = 4; x <= 11; x++) {
    setPixel(x, 14, wood);
    setPixel(x, 15, woodDark);
  }

  // Fire (animated)
  const fireColors = ['#ff4500', '#ff6b35', '#ffa500', '#ffd700', '#ffff00'];
  const flameHeight = [8, 10, 9, 11, 8, 9, 10, 8];

  for (let x = 5; x <= 10; x++) {
    const height = flameHeight[(x + frame) % 8];
    for (let y = 0; y < height; y++) {
      const colorIdx = Math.min(4, Math.floor((height - y) / 2));
      if (Math.random() > 0.2) {
        setPixel(x, 14 - y, fireColors[colorIdx]);
      }
    }
  }

  // Sparks
  if (frame % 2 === 0) {
    setPixel(4 + (frame % 4), 2, '#ffff00');
    setPixel(10 - (frame % 3), 1, '#ffa500');
  }

  return { data: getDataURL(), width: 64, height: 80 };
}

// Generate ground tiles
export function generateGroundTile(type: 'grass' | 'dirt' | 'water'): SpriteData {
  const { setPixel, getDataURL } = createPixelCanvas(16, 16, 4);

  const colors = {
    grass: ['#1a3a1a', '#2d5a2d', '#4a7c4a', '#3d6b3d'],
    dirt: ['#2d1b00', '#5c3d1e', '#4a3010', '#3d2a0d'],
    water: ['#003366', '#004488', '#0055aa', '#0066cc'],
  };

  const palette = colors[type];

  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 16; y++) {
      const colorIdx = Math.floor(Math.random() * palette.length);
      setPixel(x, y, palette[colorIdx]);
    }
  }

  // Add detail
  if (type === 'grass') {
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(Math.random() * 14) + 1;
      const y = Math.floor(Math.random() * 14) + 1;
      setPixel(x, y, '#6b9b6b');
      setPixel(x, y - 1, '#4a7c4a');
    }
  }

  return { data: getDataURL(), width: 64, height: 64 };
}

// Generate cloud sprite
export function generateCloudSprite(): SpriteData {
  const { setPixel, getDataURL } = createPixelCanvas(32, 16, 3);

  const white = '#ffffff';
  const gray = '#e0e0e0';

  // Cloud shape (blobby)
  const cloudShape = [
    '      ####      ',
    '    ########    ',
    '  ############  ',
    ' ############## ',
    '################',
    '################',
    ' ############## ',
    '  ############  ',
  ];

  cloudShape.forEach((row, y) => {
    row.split('').forEach((char, x) => {
      if (char === '#') {
        setPixel(x + 8, y + 4, Math.random() > 0.3 ? white : gray);
      }
    });
  });

  return { data: getDataURL(), width: 96, height: 48 };
}

// Generate rain drop
export function generateRainDrop(): SpriteData {
  const { setPixel, getDataURL } = createPixelCanvas(2, 8, 2);

  setPixel(0, 0, '#66ccff');
  setPixel(0, 1, '#3399ff');
  setPixel(0, 2, '#3399ff');
  setPixel(1, 2, '#66ccff');
  setPixel(0, 3, '#0066cc');
  setPixel(1, 3, '#3399ff');
  setPixel(0, 4, '#0066cc');
  setPixel(0, 5, '#003366');

  return { data: getDataURL(), width: 4, height: 16 };
}

// Generate moon sprite
export function generateMoonSprite(): SpriteData {
  const { setPixel, getDataURL } = createPixelCanvas(16, 16, 4);

  const moonLight = '#fffacd';
  const moonDark = '#f0e68c';
  const crater = '#daa520';

  // Moon circle
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 16; y++) {
      const dist = Math.sqrt((x - 8) ** 2 + (y - 8) ** 2);
      if (dist < 7) {
        setPixel(x, y, dist < 5 ? moonLight : moonDark);
      }
    }
  }

  // Craters
  setPixel(5, 5, crater);
  setPixel(10, 7, crater);
  setPixel(6, 10, crater);
  setPixel(11, 4, crater);

  return { data: getDataURL(), width: 64, height: 64 };
}

// Generate sun sprite
export function generateSunSprite(): SpriteData {
  const { setPixel, getDataURL } = createPixelCanvas(24, 24, 3);

  const sunCore = '#ffff00';
  const sunMid = '#ffd700';
  const sunOuter = '#ffa500';
  const ray = '#ffcc00';

  // Sun circle
  for (let x = 0; x < 24; x++) {
    for (let y = 0; y < 24; y++) {
      const dist = Math.sqrt((x - 12) ** 2 + (y - 12) ** 2);
      if (dist < 5) {
        setPixel(x, y, sunCore);
      } else if (dist < 6) {
        setPixel(x, y, sunMid);
      } else if (dist < 7) {
        setPixel(x, y, sunOuter);
      }
    }
  }

  // Rays
  const rayPositions = [
    [12, 0], [12, 23], [0, 12], [23, 12],
    [4, 4], [20, 4], [4, 20], [20, 20],
  ];

  rayPositions.forEach(([x, y]) => {
    setPixel(x, y, ray);
    setPixel(x + 1, y, ray);
    setPixel(x, y + 1, ray);
  });

  return { data: getDataURL(), width: 72, height: 72 };
}
