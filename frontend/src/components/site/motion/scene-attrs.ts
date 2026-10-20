/**
 * Scene root attributes (no imports: MOTION_BOOT in boot.ts inlines them into a server-rendered
 * script; env.ts re-exports them for the client).
 */

/** Server-rendered on every scene root (SceneRoot); removed once the scene is set up (scheduler.ts). */
export const SCENE_PENDING_ATTR = 'data-scene-pending';

/**
 * Set by MOTION_BOOT's late gate (boot.ts, production) on a scene root that came on screen while
 * still pending once the visitor had scrolled — the app bundle had not set it up in time (a cold
 * visit on a slow network). CSS draws no start states for it (the content shows as rendered) and
 * its setup keeps what may already have been seen as rendered (effects.ts unseen()), so nothing hides and pops in
 * under the finger.
 */
export const SCENE_LATE_ATTR = 'data-scene-late';
