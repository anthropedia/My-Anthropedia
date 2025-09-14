document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.scrollable-section').forEach(section => {
    const leftBtn  = section.querySelector('.scrollLeft');
    const rightBtn = section.querySelector('.scrollRight');
    // The inner flex row has the overflow; fall back to .content if needed
    const scroller = section.querySelector('.overflow-auto') || section.querySelector('.content');
    if (!leftBtn || !rightBtn || !scroller) return;

    const step = () => Math.max(240, Math.round(scroller.clientWidth * 0.9)); // responsive step

    leftBtn.addEventListener('click', () => {
      scroller.scrollBy({ left: -step(), behavior: 'smooth' });
    });
    rightBtn.addEventListener('click', () => {
      scroller.scrollBy({ left: step(), behavior: 'smooth' });
    });
  });
});