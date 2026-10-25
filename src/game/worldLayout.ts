export const WORLD_WIDTH = 6400;
export const VIEW_WIDTH = 1280;

export const DISTRICTS = [
  { name: 'Phố cũ', start: 0, color: 0x667c9b },
  { name: 'Công viên', start: 1280, color: 0x4f887b },
  { name: 'Ga bỏ hoang', start: 2560, color: 0x8c7668 },
  { name: 'Bờ sông', start: 3840, color: 0x557e97 },
  { name: 'Khu nhà máy', start: 5120, color: 0x82778d },
] as const;

export function getDistrictAt(x: number): typeof DISTRICTS[number] {
  return DISTRICTS[Math.max(0, Math.min(DISTRICTS.length - 1, Math.floor(x / VIEW_WIDTH)))];
}

/** Continuous follow target; only the ends of the road constrain the camera. */
export const cameraTarget = (playerX: number): number => Math.max(0, Math.min(WORLD_WIDTH - VIEW_WIDTH, playerX - VIEW_WIDTH / 2));
