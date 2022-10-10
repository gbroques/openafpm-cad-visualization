/* eslint-env browser */
import partition from './partition';

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

  // https://css-tricks.com/css-ruleset-terminology/
  _fromStylesObjectToCss(styles) {
    return Object.entries(styles)
      .map(([classKey, object], index) => {
        const className = `${this._namespace}-${index}-${classKey}`;

        // https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-classes
        const [pseudoClassEntries, entries] = partition(
          Object.entries(object),
          (entry) => entry[0].startsWith('&:'),
        );
        const classesObject = Object.fromEntries(entries);
        const ruleset = toClassRuleset(className, classesObject);
        const pseudoClassRulesets = pseudoClassEntries.map(([key, value]) => (
          toClassRuleset(key.replace('&', className), value)
        ));
        const rulesets = [ruleset].concat(pseudoClassRulesets);
        return rulesets.join('');
      }).join('');
  }

  _fromStylesObjectToClassesObject(styles) {
    return Object.keys(styles)
      .reduce((classesAccumulator, className, index) => (
        {
          ...classesAccumulator,
          [className]: `${this._namespace}-${index}-${className}`,
        }
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

function toClassRuleset(className, classesObject) {
  return `.${className} {\n${
    fromObjectToDeclarationBlock(classesObject)
  }}\n`;
}

function fromObjectToDeclarationBlock(object, indentationLevel = 2) {
  const indentation = generateIndentation(indentationLevel);
  return `${Object.entries(object)
    .map((entry) => indentation + entry.join(': '))
    .join(';\n')};\n`;
}

function generateIndentation(level) {
  return (
    [...Array(level)]
      .map(() => ' ')
      .join('')
  );
}
