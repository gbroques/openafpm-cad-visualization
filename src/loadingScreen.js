/* eslint-env browser */
import cssModuleInjector from './cssModuleInjector';

const OPACITY_DURATION = 200;

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
  },
  text: {
    'font-weight': 'bold',
    margin: '0',
    'margin-top': '16px',
    color: 'var(--openafpm-foreground-color)',
    'font-size': '0.875rem',
    'line-height': '1.5',
  },
  svg: {
    fill: 'var(--openafpm-foreground-color)',
  },
};

cssModuleInjector.set('loading-indicator', styles);

function createLoadingScreen(rootDomElement) {
  const classes = cssModuleInjector.getClasses('loading-indicator');
  const container = window.document.createElement('div');
  container.classList.add(classes.container);

  const spinner = createSpinner();
  spinner.classList.add(classes.svg);
  container.appendChild(spinner);

  const p = window.document.createElement('p');
  p.classList.add(classes.text);
  p.textContent = 'LOADING';
  container.appendChild(p);

  return {
    showLoadingScreen: () => {
      rootDomElement.appendChild(container);
    },
    hideLoadingScreen: (...args) => {
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
 * Propeller icon.
 * By Francesca Bonaccorsi, Italy.
 * {@link https://thenounproject.com/term/propeller/77747/}
 */
function createSpinner() {
  const svg = window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const spinnerClass = 'spinner';
  svg.setAttribute('viewBox', '0 0 90 90');
  svg.setAttribute('class', spinnerClass);

  const style = window.document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.type = 'text/css';
  style.scoped = true;
  style.appendChild(window.document.createTextNode(
    `.${spinnerClass} { animation: spin 1s infinite ease-in-out; }`
    + '@keyframes spin {\n'
    + '    from { transform:rotate(0deg); }\n'
    + '    to { transform:rotate(360deg); }\n'
    + '};\n',
  ));
  svg.appendChild(style);

  const size = '55px';
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);

  const g = window.document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('transform', 'translate(-1.250697)');

  const paths = [
    'm 42.977383,3.8888253 c 4.291,0.129 11.111,1.317 15.519,7.9289997 7.343,11.013 -7.383,26.614 -7.383,26.614 -4.106,-2.752 -7.956,-0.655 -7.956,-0.655 0,0 -3.409,-9.439 -7.604,-21.108 -2.192,-6.096 -0.52,-9.5079997 1.279,-11.2649997 0,0 1.37,-1.416 2.925,-1.516 1.557,-0.099 2.79,-0.012 3.22,0.001 z',
    'm 85.128155,59.230666 c -1.942,3.828 -5.919,9.494 -13.779,10.672 -13.09,1.959 -20.944,-18.004 -20.944,-18.004 4.237,-2.545 3.978,-6.922 3.978,-6.922 0,0 9.993,0.931 22.338,2.099 6.449,0.609 8.825,3.574 9.649,5.949 0,0 0.7,1.842 0.128,3.293 -0.572,1.451 -1.176,2.53 -1.37,2.913 z',
    'm 12.532903,68.591355 c -2.024,-3.786 -4.3899997,-10.291 -0.85,-17.408 5.895,-11.85 26.756,-6.849 26.756,-6.849 -0.343,4.932 3.394,7.227 3.394,7.227 0,0 -6.489,7.656 -14.52,17.105 -4.194,4.936 -7.986,5.184 -10.406,4.498 0,0 -1.909,-0.481 -2.771,-1.782 -0.862,-1.3 -1.4,-2.413 -1.603,-2.791 z',
  ];
  paths.forEach((d) => {
    const path = window.document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    g.appendChild(path);
  });

  const circle = window.document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '46.250698');
  circle.setAttribute('cy', '45');
  circle.setAttribute('r', '6.135');
  g.appendChild(circle);

  svg.appendChild(g);
  return svg;
}

export { OPACITY_DURATION };

export default createLoadingScreen;
