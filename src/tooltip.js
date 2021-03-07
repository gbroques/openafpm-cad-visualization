/* eslint-env browser */
import CssModuleInjector from './cssModuleInjector';

const CSS_NAMESPACE = 'openafpm';

const styles = {
  tooltip: {
    height: 'auto',
    'font-weight': 'bold',
    'background-color': 'rgba(0, 0, 0, 0.67)',
    color: '#fff',
    'border-radius': '5px',
    position: 'fixed',
    padding: '8px 16px 8px 16px',
    'margin-left': '20px',
    'margin-top': '20px',
    '-moz-box-shadow': '3px 3px 5px 6px #ccc',
    '-webkit-box-shadow': '3px 3px 5px 6px #ccc',
    'box-shadow': '1px 3px 1px 1px rgba(0, 0, 0, 0.17)',
    'z-index': '1000',
  },
};

export default function createTooltip() {
  const cssModuleInjecter = new CssModuleInjector(CSS_NAMESPACE);
  const classes = cssModuleInjecter.inject(styles);
  const tooltip = window.document.createElement('div');
  tooltip.classList.add(classes.tooltip);
  return tooltip;
}
