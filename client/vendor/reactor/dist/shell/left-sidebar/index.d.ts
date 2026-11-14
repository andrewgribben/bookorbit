export { mountLeftSidebar } from './mount.js';
export type { LeftSidebarCapabilities, LeftSidebarHandle, LeftSidebarOptions, LeftSidebarTab, RelatedItem, StarredItem } from './types.js';
export { flattenToc, visibleTocNodes, findCurrentTocId, findCurrentTocIdByLabel, computeWindow } from './toc-flatten.js';
export type { FlatTocNode } from './toc-flatten.js';
export { nextTab, prevTab } from './tabs.js';
export { resolveSwipe, classifySwipeStart, SWIPE_THRESHOLD_PX } from './swipe.js';
export type { SwipeRegion, SwipeResult } from './swipe.js';
