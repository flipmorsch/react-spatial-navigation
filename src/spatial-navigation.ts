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
}

const DEFAULT_CONFIG: Required<SpatialNavConfig> = {
  sameGroupBonus: 50,
  outOfViewportPenalty: 500,
  primaryDistanceWeight: 1,
  crossDistanceWeight: 0.5,
  skipHiddenElements: true,
  preferViewport: true,
};

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
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  
  // Check CSS visibility
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }
  
  // Check opacity
  const opacity = parseFloat(style.opacity);
  if (opacity === 0) {
    return false;
  }
  
  // Check dimensions
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }
  
  // Check disabled state
  if ((el as HTMLButtonElement).disabled || el.hasAttribute('disabled')) {
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
  return (
    rect.bottom > 0 &&
    rect.top < window.innerHeight &&
    rect.right > 0 &&
    rect.left < window.innerWidth
  );
}

/**
 * Checks if two rects have overlap in the axis perpendicular to movement.
 */
function hasPerpendicularOverlap(
  current: Rect, 
  candidate: Rect, 
  direction: Direction
): boolean {
  if (direction === 'left' || direction === 'right') {
    // Check vertical overlap
    return candidate.bottom > current.top && candidate.top < current.bottom;
  } else {
    // Check horizontal overlap
    return candidate.right > current.left && candidate.left < current.right;
  }
}

/**
 * Calculates the edge-to-edge distance between two rects.
 */
function getPrimaryDistance(current: Rect, candidate: Rect, direction: Direction): number {
  switch (direction) {
    case 'left':  return current.left - candidate.right;
    case 'right': return candidate.left - current.right;
    case 'up':    return current.top - candidate.bottom;
    case 'down':  return candidate.top - current.bottom;
  }
}

/**
 * Calculates the perpendicular distance (misalignment from center axis).
 */
function getCrossDistance(current: Rect, candidate: Rect, direction: Direction): number {
  if (direction === 'left' || direction === 'right') {
    return Math.abs(candidate.centerY - current.centerY);
  } else {
    return Math.abs(candidate.centerX - current.centerX);
  }
}

/**
 * Validates direction using a "shadow" approach - checks if candidate
 * is in the correct direction by comparing leading edges, not just centers.
 * This handles cases where large elements extend behind the current focus.
 */
function isInDirection(current: Rect, candidate: Rect, direction: Direction): boolean {
  // Use leading edge comparison instead of center comparison
  // This is more intuitive for D-pad navigation
  switch (direction) {
    case 'left':  return candidate.right <= current.left + (current.width * 0.1);
    case 'right': return candidate.left >= current.right - (current.width * 0.1);
    case 'up':    return candidate.bottom <= current.top + (current.height * 0.1);
    case 'down':  return candidate.top >= current.bottom - (current.height * 0.1);
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
  config: Required<SpatialNavConfig>
): number {
  // 1. Directional Validity Check
  if (!isInDirection(current, candidate, direction)) {
    return Infinity;
  }

  // 2. Calculate distances
  const hasOverlap = hasPerpendicularOverlap(current, candidate, direction);
  let primaryDist = getPrimaryDistance(current, candidate, direction);
  const crossDist = getCrossDistance(current, candidate, direction);

  // Handle overlapping elements - cap primary distance at a small negative value
  // to prefer elements that overlap over those that don't
  if (primaryDist < 0) {
    // Element overlaps in the primary axis - give it a small bonus
    primaryDist = primaryDist * 0.5; // Reduce penalty for overlapping
  }

  // 3. Calculate base score
  let score: number;
  
  if (hasOverlap) {
    // Direct line of sight - minimal cross distance penalty
    score = primaryDist * config.primaryDistanceWeight + 
            crossDist * 0.1;
  } else {
    // Diagonal element - apply heavier cross distance penalty
    // Use Euclidean distance with weighted cross component
    const weightedPrimary = primaryDist * config.primaryDistanceWeight;
    const weightedCross = crossDist * config.crossDistanceWeight;
    
    // Penalty for not being in direct line of sight
    const diagonalPenalty = Math.min(current.width, current.height) * 2;
    
    score = diagonalPenalty + Math.sqrt(
      weightedPrimary * weightedPrimary + 
      weightedCross * weightedCross
    );
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
  config: SpatialNavConfig = {}
): string | null {
  const resolvedConfig = { ...DEFAULT_CONFIG, ...config };
  
  if (elements.length === 0) {
    console.warn('SpatialNav: No elements registered');
    return null;
  }

  // Filter out non-visible elements if configured
  const visibleElements = resolvedConfig.skipHiddenElements
    ? elements.filter(el => isElementVisible(el.ref))
    : elements;

  if (visibleElements.length === 0) {
    console.warn('SpatialNav: No visible elements');
    return null;
  }

  // Handle no current focus - return first visible element
  const currentEl = currentId 
    ? visibleElements.find(e => e.id === currentId) 
    : null;
  
  if (!currentEl) {
    console.log('SpatialNav: No current focus, defaulting to first element');
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
        sameGroup: !!(currentEl.groupId && element.groupId === currentEl.groupId),
      });
    }
  }

  if (candidates.length === 0) {
    console.log('SpatialNav: No valid candidate found in this direction');
    return null;
  }

  // Sort by: same group (bonus), then score, then priority
  candidates.sort((a, b) => {
    // Apply same group bonus
    const adjustedScoreA = a.sameGroup ? a.score - resolvedConfig.sameGroupBonus : a.score;
    const adjustedScoreB = b.sameGroup ? b.score - resolvedConfig.sameGroupBonus : b.score;
    
    if (adjustedScoreA !== adjustedScoreB) {
      return adjustedScoreA - adjustedScoreB;
    }
    // Tie-breaker: higher priority wins
    return b.priority - a.priority;
  });

  const best = candidates[0];
  console.log(
    `SpatialNav: Found best candidate ${best.id} with score ${best.score.toFixed(2)}` +
    (best.sameGroup ? ' (same group)' : '')
  );

  return best.id;
}

/**
 * Gets all focusable elements within a container.
 * Useful for dynamically discovering focusable elements.
 */
export function getFocusableElements(
  container: HTMLElement,
  selector: string = '[data-focusable]'
): FocusableElement[] {
  const elements: FocusableElement[] = [];
  const focusables = container.querySelectorAll<HTMLElement>(selector);
  
  focusables.forEach((el, index) => {
    const id = el.id || `focusable-${index}`;
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
  });
  
  return elements;
}