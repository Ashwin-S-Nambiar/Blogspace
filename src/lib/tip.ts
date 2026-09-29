const DELAY = 450;
const WARM = 400;
const fine = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

export function initTips() {
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.setAttribute('aria-hidden', 'true');
  document.body.append(tip);
  let target: HTMLElement | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastHide = 0;

  function place(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const gap = 8;
    let top = r.top - t.height - gap;
    let below = false;
    if (top < 6) {
      top = r.bottom + gap;
      below = true;
    }
    const left = Math.min(
      Math.max(6, r.left + r.width / 2 - t.width / 2),
      innerWidth - t.width - 6,
    );
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
    tip.classList.toggle('below', below);
  }

  function fill(el: HTMLElement) {
    tip.replaceChildren(el.dataset.tip ?? '');
    if (el.dataset.key && fine()) {
      const k = document.createElement('kbd');
      k.textContent = el.dataset.key;
      tip.append(k);
    }
  }

  function show(el: HTMLElement, instant: boolean) {
    if (!el.dataset.tip) return;
    target = el;
    fill(el);
    tip.classList.toggle('instant', instant);
    place(el);
    tip.classList.add('on');
  }

  function hide() {
    clearTimeout(timer);
    if (tip.classList.contains('on')) lastHide = performance.now();
    tip.classList.remove('on');
    target = null;
  }

  const tipped = (e: Event) =>
    (e.target as Element | null)?.closest?.<HTMLElement>('[data-tip]') ?? null;

  document.addEventListener('pointerover', (e) => {
    if (!fine()) return;
    const el = tipped(e);
    if (el === target) return;
    if (!el) {
      if (target) hide();
      return;
    }
    clearTimeout(timer);
    const warm = tip.classList.contains('on') || performance.now() - lastHide < WARM;
    if (warm) show(el, true);
    else timer = setTimeout(() => show(el, false), DELAY);
  });

  document.addEventListener('pointerout', (e) => {
    const el = tipped(e);
    if (el && !el.contains(e.relatedTarget as Node | null)) hide();
  });

  document.addEventListener('pointerdown', hide, true);
  addEventListener('blur', hide);
  addEventListener('resize', hide);
  document.addEventListener('scroll', hide, true);

  document.addEventListener('focusin', (e) => {
    const el = tipped(e);
    if (el?.matches(':focus-visible')) show(el, false);
  });
  document.addEventListener('focusout', (e) => {
    if (tipped(e)) hide();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === ' ') hide();
  });

  return {
    refresh(el: HTMLElement) {
      if (target === el && el.dataset.tip) {
        fill(el);
        place(el);
      }
    },
  };
}
