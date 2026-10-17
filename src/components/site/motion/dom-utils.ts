/** Small DOM helpers shared by the motion code (no GSAP: importing this pulls in nothing else). */

/** Document y of an element's layout box (offsetTop chain: transforms are ignored). */
export function layoutTop(el: HTMLElement): number {
  let y = 0;
  for (let node: Element | null = el; node instanceof HTMLElement; node = node.offsetParent) y += node.offsetTop;
  return y;
}
