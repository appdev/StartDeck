import type { WidgetConfig } from "@/types";

export interface GridLayoutItem extends WidgetConfig {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function generateLayout(
  widgets: WidgetConfig[],
  colNum: number,
): GridLayoutItem[] {
  const layout: GridLayoutItem[] = [];
  const matrix: boolean[][] = []; // true if occupied
  const step = 1;
  const scale = 1;
  const normalize = (value: number) => Math.round(value * scale) / scale;
  const toScaled = (value: number) => Math.round(value * scale);
  const normalizedColNum =
    Number.isFinite(colNum) && colNum > 0 ? Math.floor(colNum) : 1;
  const isFiniteNumber = (value: number | undefined): value is number =>
    typeof value === "number" && Number.isFinite(value);
  const normalizeSpan = (value: number | undefined, fallback = 1) => {
    const raw = isFiniteNumber(value) ? value : fallback;
    return Math.max(1, normalize(raw));
  };
  const normalizeCoordinate = (value: number | undefined) =>
    isFiniteNumber(value) ? normalize(value) : undefined;

  function isOccupied(x: number, y: number, w: number, h: number) {
    const sx = toScaled(x);
    const sy = toScaled(y);
    const sw = toScaled(w);
    const sh = toScaled(h);
    for (let i = sx; i < sx + sw; i++) {
      for (let j = sy; j < sy + sh; j++) {
        if (matrix[j]?.[i]) return true;
      }
    }
    return false;
  }

  function occupy(x: number, y: number, w: number, h: number) {
    const sx = toScaled(x);
    const sy = toScaled(y);
    const sw = toScaled(w);
    const sh = toScaled(h);
    for (let i = sx; i < sx + sw; i++) {
      for (let j = sy; j < sy + sh; j++) {
        if (!matrix[j]) matrix[j] = [];
        const row = matrix[j];
        if (row) row[i] = true;
      }
    }
  }

  // 分离已有位置和无位置的组件
  // 优先处理已有位置的组件，避免被新组件抢占位置导致重叠
  const positioned: WidgetConfig[] = [];
  const unpositioned: WidgetConfig[] = [];

  widgets.forEach((w) => {
    const width = normalizeSpan(w.w ?? w.colSpan);
    const x = normalizeCoordinate(w.x);
    const y = normalizeCoordinate(w.y);
    // 只有当位置存在且在当前列数范围内时，才保留原位置
    // 否则视为无位置，重新排布（例如从宽屏切换到窄屏时）
    if (x !== undefined && y !== undefined && x + width <= normalizedColNum) {
      positioned.push(w);
    } else {
      unpositioned.push(w);
    }
  });

  // 1. 先放置已有位置的组件
  positioned.forEach((w) => {
    const width = Math.min(normalizedColNum, normalizeSpan(w.w ?? w.colSpan));
    const height = normalizeSpan(w.h ?? w.rowSpan);
    const x = normalizeCoordinate(w.x) ?? 0;
    const y = normalizeCoordinate(w.y) ?? 0;

    // 如果位置已经被占用了（说明有组件重叠），
    // 或者虽然之前检查了宽度，但为了双重保险（例如 occupy 逻辑可能有变），
    // 这里再次检查占用情况。
    // 如果重叠，则降级为 unpositioned，由后续逻辑自动寻找空位。
    if (isOccupied(x, y, width, height)) {
      unpositioned.push(w);
      return;
    }

    occupy(x, y, width, height);
    layout.push({ ...w, i: w.id, w: width, h: height, x, y });
  });

  // 2. 再放置无位置（或位置失效、或因重叠被挤出）的组件
  unpositioned.forEach((w) => {
    let width = normalizeSpan(w.w ?? w.colSpan);
    const height = normalizeSpan(w.h ?? w.rowSpan);

    // Safety check: if width is greater than colNum, clamp it to colNum
    // This prevents infinite loop in the while(true) block below
    if (width > normalizedColNum) width = normalizedColNum;

    // Find first spot
    let x = 0;
    let y = 0;
    while (true) {
      if (x + width > normalizedColNum) {
        x = 0;
        y = normalize(y + step);
        continue;
      }
      if (!isOccupied(x, y, width, height)) {
        occupy(x, y, width, height);
        layout.push({ ...w, i: w.id, x, y, w: width, h: height });
        break;
      }
      x = normalize(x + step);
    }
  });

  return layout;
}

export function resolveResizeLayout(
  layout: GridLayoutItem[],
  targetId: string,
  size: { colSpan: number; rowSpan: number },
  colNum: number,
): GridLayoutItem[] {
  const normalizedColNum =
    Number.isFinite(colNum) && colNum > 0 ? Math.floor(colNum) : 1;
  const normalizeSpan = (value: number | undefined, fallback = 1) => {
    const raw =
      typeof value === "number" && Number.isFinite(value) ? value : fallback;
    return Math.max(1, Math.round(raw));
  };
  const normalizeCoordinate = (value: number | undefined) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(0, Math.round(value))
      : 0;
  const collides = (a: GridLayoutItem, b: GridLayoutItem) =>
    a.i !== b.i &&
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y;
  const insideColumns = (item: GridLayoutItem) =>
    item.x >= 0 && item.x + item.w <= normalizedColNum;
  const canPlace = (item: GridLayoutItem, placed: GridLayoutItem[]) =>
    insideColumns(item) &&
    !placed.some((placedItem) => collides(item, placedItem));
  const normalizeItem = (item: GridLayoutItem): GridLayoutItem => ({
    ...item,
    i: item.i || item.id,
    x: normalizeCoordinate(item.x),
    y: normalizeCoordinate(item.y),
    w: Math.min(normalizedColNum, normalizeSpan(item.w ?? item.colSpan)),
    h: normalizeSpan(item.h ?? item.rowSpan),
  });
  const targetSource = layout.find(
    (item) => item.i === targetId || item.id === targetId,
  );
  if (!targetSource) return layout;

  const targetWidth = Math.min(
    normalizedColNum,
    normalizeSpan(size.colSpan, targetSource.w || targetSource.colSpan || 1),
  );
  const targetHeight = normalizeSpan(
    size.rowSpan,
    targetSource.h || targetSource.rowSpan || 1,
  );
  const targetX = Math.min(
    normalizeCoordinate(targetSource.x),
    Math.max(0, normalizedColNum - targetWidth),
  );
  const target: GridLayoutItem = {
    ...normalizeItem(targetSource),
    x: targetX,
    w: targetWidth,
    h: targetHeight,
    colSpan: targetWidth,
    rowSpan: targetHeight,
  };
  const placed: GridLayoutItem[] = [target];
  const resolvedById = new Map<string, GridLayoutItem>([[target.i, target]]);
  const others = layout
    .filter((item) => item.i !== target.i && item.id !== target.id)
    .map(normalizeItem)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const findRightwardSlot = (item: GridLayoutItem): GridLayoutItem => {
    const width = Math.min(normalizedColNum, normalizeSpan(item.w));
    const height = normalizeSpan(item.h);
    const startY = normalizeCoordinate(item.y);
    const sameRowStartX = Math.min(
      normalizedColNum,
      normalizeCoordinate(item.x) + 1,
    );
    for (let x = sameRowStartX; x + width <= normalizedColNum; x += 1) {
      const candidate = {
        ...item,
        x,
        y: startY,
        w: width,
        h: height,
        colSpan: width,
        rowSpan: height,
      };
      if (canPlace(candidate, placed)) return candidate;
    }

    const originalCandidate = {
      ...item,
      w: width,
      h: height,
      colSpan: width,
      rowSpan: height,
    };
    const collisionBottom = placed.reduce((bottom, placedItem) => {
      if (!collides(originalCandidate, placedItem)) return bottom;
      return Math.max(bottom, placedItem.y + placedItem.h);
    }, startY + 1);

    let y = collisionBottom;
    while (y < 10000) {
      for (let x = 0; x + width <= normalizedColNum; x += 1) {
        const candidate = {
          ...item,
          x,
          y,
          w: width,
          h: height,
          colSpan: width,
          rowSpan: height,
        };
        if (canPlace(candidate, placed)) return candidate;
      }
      y += 1;
    }

    return {
      ...item,
      x: Math.max(0, Math.min(item.x, normalizedColNum - width)),
      y: startY,
      w: width,
      h: height,
      colSpan: width,
      rowSpan: height,
    };
  };

  for (const item of others) {
    const originalCandidate = {
      ...item,
      colSpan: item.w,
      rowSpan: item.h,
    };
    const resolved = canPlace(originalCandidate, placed)
      ? originalCandidate
      : findRightwardSlot(item);
    placed.push(resolved);
    resolvedById.set(resolved.i, resolved);
  }

  return layout.map((item) => resolvedById.get(item.i || item.id) || item);
}
