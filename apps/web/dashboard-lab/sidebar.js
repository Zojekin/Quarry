// Preview-only shell interaction. It never changes learning data or sessions.
(() => {
  const sidebar = document.getElementById('quarry-sidebar');
  const collapse = document.querySelector('[data-sidebar-action="collapse"]');
  const expand = document.querySelector('[data-sidebar-action="expand"]');
  if (!sidebar || !collapse || !expand) return;
  sidebar.querySelectorAll('.nav-item, .utilities > div').forEach(item => {
    const label = item.querySelector('span')?.textContent ?? item.textContent.trim();
    item.setAttribute('aria-label', label);
    item.title = label;
  });

  function setExpanded(expanded) {
    document.body.dataset.sidebar = expanded ? 'expanded' : 'collapsed';
    collapse.setAttribute('aria-expanded', String(expanded));
    expand.setAttribute('aria-expanded', String(expanded));
    (expanded ? collapse : expand).focus({ preventScroll: true });
  }

  collapse.addEventListener('click', () => setExpanded(false));
  expand.addEventListener('click', () => setExpanded(true));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.body.dataset.sidebar !== 'collapsed') {
      setExpanded(false);
    }
  });
})();
