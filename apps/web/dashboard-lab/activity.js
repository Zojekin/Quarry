// Presentation-only activity controls; supplied values are mock projections.
(() => {
  const activity = document.querySelector('.activity');
  const control = activity?.querySelector('.metric-switch');
  if (!control) return;
  const grid = activity.querySelector('.cells');
  const label = activity.querySelector('.legend-label');
  const buttons = [...control.querySelectorAll('[data-metric]')];
  const days = [...grid.querySelectorAll('[data-date]')];

  function setMetric(metric) {
    const duration = metric === 'duration';
    control.dataset.metric = metric;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.metric === metric)));
    days.forEach(day => {
      if (day.classList.contains('is-future') || day.classList.contains('outside')) return;
      const value = Number(duration ? day.dataset.seconds : day.dataset.count);
      const limits = duration ? [180, 420, 720] : [3, 5, 8];
      const level = value === 0 ? 0 : value < limits[0] ? 1 : value < limits[1] ? 2 : value < limits[2] ? 3 : 4;
      for (let i = 0; i <= 4; i++) day.classList.toggle(`lv${i}`, i === level);
    });
    label.textContent = duration ? '按用时着色' : '按作答量着色';
    grid.setAttribute('aria-label', `2026全年学习活动，${label.textContent}`);
  }

  buttons.forEach(button => button.addEventListener('click', () => setMetric(button.dataset.metric)));
  setMetric('count');
})();
