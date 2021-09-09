/* eslint-env browser */
function createLoadingScreen(opacityDuration) {
  const container = window.document.createElement('div');
  container.style = `position: absolute; top: 45%; left: 50%; opacity: 1; transition: opacity ${opacityDuration}ms ease-in-out;`;

  const spinner = createSpinner();
  container.appendChild(spinner);

  const p = window.document.createElement('p');
  p.style = 'font-weight: bold; margin: 0; margin-top: 16px; color:rgba(0, 0, 0, 0.80); font-size: 0.875rem; line-height: 1.5;';
  p.textContent = 'LOADING';
  container.appendChild(p);

  return container;
}

function createSpinner() {
  const svg = window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const spinnerClass = 'spinner';
  svg.setAttribute('viewBox', '0 0 90 90');
  svg.setAttribute('fill-opacity', '0.80');
  svg.setAttribute('fill', '#000000');
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

  const size = '60px';
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);

  const paths = [
    'M40.776,6.709c4.291,0.129,11.111,1.317,15.519,7.929c7.343,11.013-7.383,26.614-7.383,26.614  c-4.106-2.752-7.956-0.655-7.956-0.655s-3.409-9.439-7.604-21.108c-2.192-6.096-0.52-9.508,1.279-11.265c0,0,1.37-1.416,2.925-1.516  C39.113,6.609,40.346,6.696,40.776,6.709z',
    'M83.744,62.346c-1.942,3.828-5.919,9.494-13.779,10.672c-13.09,1.959-20.944-18.004-20.944-18.004  c4.237-2.545,3.978-6.922,3.978-6.922s9.993,0.931,22.338,2.099c6.449,0.609,8.825,3.574,9.649,5.949c0,0,0.7,1.842,0.128,3.293  C84.542,60.884,83.938,61.963,83.744,62.346z',
    'M9.833,72.049c-2.024-3.786-4.39-10.291-0.85-17.408c5.895-11.85,26.756-6.849,26.756-6.849  c-0.343,4.932,3.394,7.227,3.394,7.227s-6.489,7.656-14.52,17.105c-4.194,4.936-7.986,5.184-10.406,4.498  c0,0-1.909-0.481-2.771-1.782C10.574,73.54,10.036,72.427,9.833,72.049z',
  ];
  paths.forEach((d) => {
    const path = window.document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  });
  const circle = window.document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '44.265');
  circle.setAttribute('cy', '48.092');
  circle.setAttribute('r', '6.135');
  svg.appendChild(circle);

  return svg;
}

module.exports = createLoadingScreen;
