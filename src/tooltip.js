export function createTooltip() {
  const element = document.createElement('div');
  element.className = 'tooltip';
  element.hidden = true;
  document.body.append(element);
  return {
    show(event, lines) {
      element.replaceChildren(
        ...lines.map((line, index) => {
          const node = document.createElement(index ? 'div' : 'strong');
          node.textContent = line;
          return node;
        }),
      );
      element.hidden = false;
      element.style.left = `${Math.min(event.clientX + 14, window.innerWidth - 310)}px`;
      element.style.top = `${Math.max(8, Math.min(event.clientY + 14, window.innerHeight - element.offsetHeight - 12))}px`;
    },
    hide() {
      element.hidden = true;
    },
    destroy() {
      element.remove();
    },
  };
}
