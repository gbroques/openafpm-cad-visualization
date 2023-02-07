/* eslint-env browser */
import cssModuleInjector from './cssModuleInjector';

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

cssModuleInjector.set('tooltip', styles);

export default function createTooltip() {
  const classes = cssModuleInjector.getClasses('tooltip');
  const tooltip = window.document.createElement('div');
  tooltip.classList.add(classes.tooltip);
  return tooltip;
}
