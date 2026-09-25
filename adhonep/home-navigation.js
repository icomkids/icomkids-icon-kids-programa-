/* Navigation works with native anchors, even without JavaScript or the API. */
(() => {
  const menus = [...document.querySelectorAll('[data-home-navigation]')].map((menu) =>
    [...menu.querySelectorAll('a[href^="#"]')].map((link) => ({
      link,
      section: document.getElementById(link.hash.slice(1)),
    })).filter(({ section }) => section)
  );
  let scheduled = false;
  function updateCurrentSection() {
    scheduled = false;
    const threshold = Math.min(180, window.innerHeight * .25);
    menus.forEach((items) => {
      // Visual order changes on mobile; measure positions instead of DOM order.
      const passed = items.filter(({ section }) => section.getBoundingClientRect().top <= threshold);
      const current = passed.sort((a, b) => b.section.getBoundingClientRect().top - a.section.getBoundingClientRect().top)[0] || items[0];
      items.forEach((item) => {
        const active = item === current;
        item.link.classList.toggle('active', active);
        if (active) item.link.setAttribute('aria-current', 'location');
        else item.link.removeAttribute('aria-current');
      });
    });
  }
  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(updateCurrentSection);
  }
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate, { passive: true });
  window.addEventListener('hashchange', scheduleUpdate);
  window.addEventListener('load', scheduleUpdate);
  updateCurrentSection();
})();
