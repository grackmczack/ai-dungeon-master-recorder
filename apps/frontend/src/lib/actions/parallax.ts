/**
 * Leichtgewichtige Parallax-Actions für Hintergrundbilder.
 *
 * `parallax` — verschiebt das Element vertikal proportional zur Position
 *              seines Parents im Viewport (für Kachel-Hintergründe).
 *
 * `parallaxFixed` — verschiebt das Element vertikal proportional zum
 *                   window-Scroll (für seitenweite fixed Hintergründe).
 */

export function parallax(node: HTMLElement, factor: number = 0.15) {
  let currentFactor = factor;
  let ticking = false;

  function update() {
    const parent = node.parentElement;
    const parentTop = parent?.getBoundingClientRect().top ?? 0;
    const offset = parentTop * currentFactor;
    node.style.transform = `translate3d(0, ${offset}px, 0)`;
    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  return {
    update(newFactor: number) {
      currentFactor = newFactor ?? factor;
      update();
    },
    destroy() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      }
    }
  };
}

export function parallaxFixed(node: HTMLElement, factor: number = 0.3) {
  let ticking = false;

  function update() {
    const scrollY = window.scrollY || window.pageYOffset;
    const offset = scrollY * factor;
    node.style.transform = `translate3d(0, ${offset}px, 0)`;
    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
  }

  return {
    update(newFactor: number) {
      factor = newFactor ?? factor;
      update();
    },
    destroy() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('scroll', onScroll);
      }
    }
  };
}