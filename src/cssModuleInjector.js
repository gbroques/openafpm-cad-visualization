/* eslint-env browser */

/**
 * Simple implementation of CSS modules.
 */
export default class CssModuleInjector {
  constructor(namespace) {
    this._namespace = namespace;
  }

  /**
   * Inject styles by appending CSS into the head of the page.
   *
   * @param {Object} styles Keys are class names,
   *                        and values are an object with CSS property-value pairs.
   * @returns {Object} "classes" object where keys are class names,
   *                   as defined as keys in styles object,
   *                   and values are a unique and generated class name.
   */
  inject(styles) {
    const cssContent = this._fromStylesObjectToCss(styles);
    const classes = this._fromStylesObjectToClassesObject(styles);
    injectCss(cssContent);
    return classes;
  }

  _fromStylesObjectToCss(styles) {
    return Object.values(styles)
      .map((object, index) => (
        `.${this._namespace + index} {\n${
          fromObjectToCssBlock(object)
        }}\n`
      )).join('\n');
  }

  _fromStylesObjectToClassesObject(styles) {
    return Object.keys(styles)
      .reduce((classesAccumulator, className, index) => (
        { ...classesAccumulator, [className]: this._namespace + index }
      ), {});
  }
}

function injectCss(cssContent) {
  const injected = window.document.createElement('style');
  injected.type = 'text/css';
  injected.innerHTML = cssContent;
  const head = window.document.getElementsByTagName('head')[0];
  try {
    head.appendChild(injected);
  } catch (e) {
    // Unable to inject CSS, probably because of a Content Security Policy.
    console.error(e);
  }
}

function fromObjectToCssBlock(object, indentationLevel = 2) {
  const indentation = [...Array(indentationLevel)].map(() => ' ').join('');
  return `${Object.entries(object)
    .map((entry) => indentation + entry.join(': '))
    .join(';\n')};\n`;
}
