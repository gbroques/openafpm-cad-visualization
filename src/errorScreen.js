/* eslint-env browser */
import cssModuleInjector from './cssModuleInjector';
import { OPACITY_DURATION } from './loadingScreen';

const styles = {
  container: {
    height: '100%',
    width: '100%',
    display: 'flex',
    'align-items': 'center',
    'flex-direction': 'column',
    'justify-content': 'center',
    opacity: '1',
    transition: `opacity ${OPACITY_DURATION}ms ease-in-out`,
    color: 'var(--openafpm-foreground-color)',
  },
  message: {
    'font-weight': 'bold',
    margin: '0px',
    'font-size': '0.875rem',
    'line-height': '1.5',
  },
  detail: {
    margin: '4px 0px',
    'font-size': '0.75rem',
    'line-height': '1.5',
  },
  svg: {
    fill: 'var(--openafpm-foreground-color)',
  },
};

cssModuleInjector.set('error-screen', styles);

function createErrorScreen(rootDomElement) {
  const classes = cssModuleInjector.getClasses('error-screen');
  const container = window.document.createElement('div');
  container.classList.add(classes.container);

  const errorIcon = createErrorIcon();
  errorIcon.classList.add(classes.svg);
  container.appendChild(errorIcon);

  const message = window.document.createElement('p');
  message.classList.add(classes.message);
  message.textContent = 'ERROR';
  container.appendChild(message);

  const detail = window.document.createElement('p');
  detail.classList.add(classes.detail);
  container.appendChild(detail);

  return {
    showErrorScreen: (errorMessage) => {
      detail.textContent = errorMessage;
      rootDomElement.appendChild(container);
    },
    hideErrorScreen: (...args) => {
      container.style.opacity = 0;
      return new Promise((resolve) => {
        setTimeout(() => {
          // Avoid "DOMException: Failed to execute 'removeChild' on 'Node'"
          // as a potential race condition when switching visualizations.
          if (rootDomElement.contains(container)) {
            rootDomElement.removeChild(container);
          }
          resolve(...args);
        }, OPACITY_DURATION);
      });
    },
  };
}

/**
 * Error icon.
 * By i cons, US.
 * {@link https://thenounproject.com/icon/error-1939555/}
 */
function createErrorIcon() {
  const svg = window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 700 700');

  const size = '50px';
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);

  const g = window.document.createElementNS('http://www.w3.org/2000/svg', 'g');

  const path = window.document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'm618.35 444.02-218.68-378.67c-13.664-23.688-31.641-35.504-49.672-35.504s-36.008 11.816-49.672 35.504l-218.4 378.67c-27.609 47.375-5.2109 86.129 49.672 86.129h436.8c54.883 0 77.281-38.754 49.953-86.129zm-296.8-223.27 56.953 0.003906v132.49h-57.008v-132.49zm28.504 218.4v0.003906c-8.2695 0-16.207-3.2852-22.055-9.1367-5.8516-5.8477-9.1367-13.781-9.1367-22.055 0-8.2734 3.2852-16.207 9.1367-22.059 5.8477-5.8477 13.785-9.1328 22.055-9.1328 8.2734 0 16.207 3.2852 22.059 9.1328 5.8477 5.8516 9.1328 13.785 9.1328 22.059 0.015625 8.293-3.2695 16.246-9.1328 22.109-5.8633 5.8633-13.82 9.1523-22.113 9.1367z');
  g.appendChild(path);

  svg.appendChild(g);
  return svg;
}

export default createErrorScreen;
