/**
 * Leichtgewichtige Parallax-Scroll-Action für Kampagnen-Hintergrundbilder.
 *
 * Verschiebt das Element vertikal proportional zu seiner Position im Viewport
 * (kein `background-attachment: fixed`, das auf iOS Safari unzuverlässig ist).
 * Das Hintergrundbild-Element sollte größer als sein Container sein
 * (z.B. `inset: -20%`) und der Container braucht `overflow: hidden`,
 * damit beim Verschieben keine Lücken sichtbar werden.
 *
 * Nutzung: <div class="absolute -inset-y-[20%] inset-x-0" use:parallax={0.15}>
 */
export function parallax(node: HTMLElement, factor: number = 0.15) {
  let currentFactor = factor;
  let ticking = false;

  function update() {
    const rect = node.getBoundingClientRect();
    const parent = node.parentElement;
    const parentTop = parent?.getBoundingClientRect().top ?? rect.top;
    // Offset relativ zur Position des Containers im Viewport — bei 0 (Container
    // exakt am oberen Viewport-Rand) ist der Offset 0, darüber/darunter verschiebt sich das Bild sanft mit.
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
