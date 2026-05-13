export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface FocusableElement {
  id: string;
  ref: HTMLElement;
  groupId?: string;
  priority?: number; // Higher priority = preferred when scores are close
}

export interface SpatialNavConfig {
  /** Bonus applied to elements in the same group */
  sameGroupBonus?: number;
  /** Penalty for elements not in viewport */
  outOfViewportPenalty?: number;
  /** Weight for primary distance (edge-to-edge) */
  primaryDistanceWeight?: number;
  /** Weight for cross distance (perpendicular offset) */
  crossDistanceWeight?: number;
  /** Whether to skip hidden/disabled elements */
  skipHiddenElements?: boolean;
  /** Whether to prefer elements in viewport */
  preferViewport?: boolean;
  /** Enable debug logging to console (off by default) */
  debug?: boolean;
}

const DEFAULT_CONFIG: Required<SpatialNavConfig> = {
  sameGroupBonus: 50,
  outOfViewportPenalty: 500,
  primaryDistanceWeight: 1,
  crossDistanceWeight: 0.5,
  skipHiddenElements: true,
  preferViewport: true,
  debug: false,
};

// ─── Scoring constants ────────────────────────────────────────────────────────
// These govern the spatial scoring heuristics. Exposed here for clarity;
// they are intentionally not user-configurable to keep the API surface small.
const SCORING = {
  /** Ratio of current element width/height allowed "behind" for isInDirection */
  BEHIND_TOLERANCE_RATIO: 0.1,
  /** Multiplier applied to primary distance when elements overlap in that axis */
  OVERLAP_BONUS_RATIO: 0.5,
  /** Penalty multiplier (× min dimension) for candidates not in direct LOS */
  DIAGONAL_PENALTY_MULTIPLIER: 2,
  /** Cross-distance weight used when elements have perpendicular overlap */
  DIRECT_CROSS_WEIGHT_FACTOR: 0.2,
} as const;

// ─── SSR-safe helpers ─────────────────────────────────────────────────────────

function getWindow(): Window | undefined {
  return typeof window !== 'undefined' ? window : undefined;
}

// ─── Public helpers ───────────────────────────────────────────────────────────

export function getRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return {
    top: r.top,
    left: r.left,
    right: r.right,
    bottom: r.bottom,
    width: r.width,
    height: r.height,
    centerX: r.left + r.width / 2,
    centerY: r.top + r.height / 2,
  };
}

/**
 * Checks if an element is visible and interactable.
 */
export function isElementVisible(el: HTMLElement): boolean {
  const win = getWindow();
  if (!win) return true; // SSR fallback — assume visible

  const style = win.getComputedStyle(el);
  const rect = el.getBoundingClientRect();

  // Check CSS visibility
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }

  // Check opacity (guard against NaN when style.opacity is empty)
  const opacity = parseFloat(style.opacity);
  if (Number.isNaN(opacity) ? false : opacity === 0) {
    return false;
  }

  // Check dimensions
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  // Check disabled state via attribute (handles buttons, fieldsets, etc.)
  if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') {
    return false;
  }

  // Check aria-hidden
  if (el.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  return true;
}

/**
 * Checks if a rect is within the viewport.
 */
export function isInViewport(rect: Rect): boolean {
  const win = getWindow();
  if (!win) return true; // SSR fallback

  return (
    rect.bottom > 0 &&
    rect.top < win.innerHeight &&
    rect.right > 0 &&
    rect.left < win.innerWidth
  );
}

/**
 * Checks if two rects have overlap in the axis perpendicular to movement.
 */
function hasPerpendicularOverlap(
  current: Rect,
  candidate: Rect,
  direction: Direction,
): boolean {
  if (direction === 'left' || direction === 'right') {
    return candidate.bottom > current.top && candidate.top < current.bottom;
  } else {
    return candidate.right > current.left && candidate.left < current.right;
  }
}

/**
 * Calculates the edge-to-edge distance between two rects.
 */
function getPrimaryDistance(
  current: Rect,
  candidate: Rect,
  direction: Direction,
): number {
  switch (direction) {
    case 'left':
      return current.left - candidate.right;
    case 'right':
      return candidate.left - current.right;
    case 'up':
      return current.top - candidate.bottom;
    case 'down':
      return candidate.top - current.bottom;
  }
}

/**
 * Calculates the perpendicular distance (misalignment from center axis).
 */
function getCrossDistance(
  current: Rect,
  candidate: Rect,
  direction: Direction,
): number {
  if (direction === 'left' || direction === 'right') {
    return Math.abs(candidate.centerY - current.centerY);
  } else {
    return Math.abs(candidate.centerX - current.centerX);
  }
}

/**
 * Validates direction by comparing leading edges with a small tolerance.
 * Handles large elements that extend behind current focus.
 */
function isInDirection(
  current: Rect,
  candidate: Rect,
  direction: Direction,
): boolean {
  const toleranceW = current.width * SCORING.BEHIND_TOLERANCE_RATIO;
  const toleranceH = current.height * SCORING.BEHIND_TOLERANCE_RATIO;

  switch (direction) {
    case 'left':
      return candidate.right <= current.left + toleranceW;
    case 'right':
      return candidate.left >= current.right - toleranceW;
    case 'up':
      return candidate.bottom <= current.top + toleranceH;
    case 'down':
      return candidate.top >= current.bottom - toleranceH;
  }
}

/**
 * Calculates a score for a candidate element based on spatial proximity.
 * Lower score is better. Infinity means the candidate is in the wrong direction.
 */
function getScore(
  current: Rect,
  candidate: Rect,
  direction: Direction,
  config: Required<SpatialNavConfig>,
): number {
  // 1. Directional Validity Check
  if (!isInDirection(current, candidate, direction)) {
    return Infinity;
  }

  // 2. Calculate distances
  const hasOverlap = hasPerpendicularOverlap(current, candidate, direction);
  let primaryDist = getPrimaryDistance(current, candidate, direction);
  const crossDist = getCrossDistance(current, candidate, direction);

  // Give a bonus for elements that overlap in the primary axis
  if (primaryDist < 0) {
    primaryDist *= SCORING.OVERLAP_BONUS_RATIO;
  }

  // 3. Calculate base score
  let score: number;

  if (hasOverlap) {
    // Direct line of sight — use linear combination with a reduced cross factor
    score =
      primaryDist * config.primaryDistanceWeight +
      crossDist * config.crossDistanceWeight * SCORING.DIRECT_CROSS_WEIGHT_FACTOR;
  } else {
    // Diagonal element — Euclidean distance with heavier cross penalty
    // Use Math.max(0, ...) on primary to avoid squaring erasing the overlap bonus
    const effectivePrimary =
      Math.max(0, primaryDist) * config.primaryDistanceWeight;
    const weightedCross = crossDist * config.crossDistanceWeight;
    const diagonalPenalty =
      Math.min(current.width, current.height) * SCORING.DIAGONAL_PENALTY_MULTIPLIER;

    score =
      diagonalPenalty +
      Math.sqrt(effectivePrimary * effectivePrimary + weightedCross * weightedCross);
  }

  // 4. Apply viewport penalty
  if (config.preferViewport && !isInViewport(candidate)) {
    score += config.outOfViewportPenalty;
  }

  return score;
}

/**
 * Finds the next focusable element in the given direction.
 */
export function findNextFocusable(
  currentId: string | null,
  elements: FocusableElement[],
  direction: Direction,
  config: SpatialNavConfig = {},
): string | null {
  const resolvedConfig = {...DEFAULT_CONFIG, ...config};
  const {debug} = resolvedConfig;

  if (elements.length === 0) {
    if (debug) console.warn('SpatialNav: No elements registered');
    return null;
  }

  // Filter out non-visible elements if configured
  const visibleElements = resolvedConfig.skipHiddenElements
    ? elements.filter(el => isElementVisible(el.ref))
    : elements;

  if (visibleElements.length === 0) {
    if (debug) console.warn('SpatialNav: No visible elements');
    return null;
  }

  // Handle no current focus — return first visible element
  const currentEl = currentId
    ? visibleElements.find(e => e.id === currentId)
    : null;

  if (!currentEl) {
    if (debug) console.log('SpatialNav: No current focus, defaulting to first element');
    return visibleElements[0].id;
  }

  const currentRect = getRect(currentEl.ref);

  // Collect all candidates with their scores
  interface Candidate {
    id: string;
    score: number;
    priority: number;
    sameGroup: boolean;
  }

  const candidates: Candidate[] = [];

  for (const element of visibleElements) {
    if (element.id === currentId) continue;

    const candidateRect = getRect(element.ref);
    const score = getScore(currentRect, candidateRect, direction, resolvedConfig);

    if (score !== Infinity) {
      candidates.push({
        id: element.id,
        score,
        priority: element.priority ?? 0,
        sameGroup: !!(
          currentEl.groupId && element.groupId === currentEl.groupId
        ),
      });
    }
  }

  if (candidates.length === 0) {
    if (debug) console.log('SpatialNav: No valid candidate found in this direction');
    return null;
  }

  // Sort by: same group (bonus), then score, then priority
  candidates.sort((a, b) => {
    const adjustedScoreA = a.sameGroup
      ? Math.max(0, a.score - resolvedConfig.sameGroupBonus)
      : a.score;
    const adjustedScoreB = b.sameGroup
      ? Math.max(0, b.score - resolvedConfig.sameGroupBonus)
      : b.score;

    if (adjustedScoreA !== adjustedScoreB) {
      return adjustedScoreA - adjustedScoreB;
    }
    // Tie-breaker: higher priority wins
    return b.priority - a.priority;
  });

  const best = candidates[0];
  if (debug) {
    console.log(
      `SpatialNav: Found best candidate ${best.id} with score ${best.score.toFixed(2)}` +
        (best.sameGroup ? ' (same group)' : ''),
    );
  }

  return best.id;
}

/**
 * Gets all focusable elements within a container.
 * Useful for dynamically discovering focusable elements.
 */
export function getFocusableElements(
  container: HTMLElement,
  selector: string = '[data-focusable]',
  filterHidden: boolean = true,
): FocusableElement[] {
  const elements: FocusableElement[] = [];
  const focusables = container.querySelectorAll<HTMLElement>(selector);

  // Collect used IDs to avoid collisions with generated fallbacks
  const usedIds = new Set<string>();
  for (const el of focusables) {
    if (el.id) usedIds.add(el.id);
  }

  let autoIndex = 0;
  for (const el of focusables) {
    if (filterHidden && !isElementVisible(el)) continue;

    // Generate a collision-free fallback ID
    let id = el.id;
    if (!id) {
      do {
        id = `__spatial-fallback-${autoIndex++}`;
      } while (usedIds.has(id));
      usedIds.add(id);
    }

    const groupId = el.dataset.focusGroup;
    const priority = el.dataset.focusPriority
      ? parseInt(el.dataset.focusPriority, 10)
      : undefined;

    elements.push({
      id,
      ref: el,
      groupId,
      priority,
    });
  }

  return elements;
}
