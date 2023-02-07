/* eslint-env browser */
import { partition } from './array';

/**
 * Simple implementation of CSS modules.
 */
class CssModuleInjector {
  constructor(namespace) {
    this._namespace = namespace;
    this._stylesByKey = new Map();
  }

  /**
   * Register styles.
   *
   * @param {string} key Unique key.
   * @param {Object} styles Keys are class names,
   *                        and values are an object with CSS property-value pairs.
   */
  set(key, styles) {
    this._stylesByKey.set(key, styles);
  }

  /**
   * Get classes for previously registered styles.
   *
   * @param {string} key Unique key.
   * @returns {Object} "classes" object where keys are class names,
   *                   as defined as keys in styles object,
   *                   and values are a unique and generated class name.
   */
  getClasses(key) {
    const styles = this._stylesByKey.get(key);
    return this._fromStylesObjectToClassesObject(key, styles);
  }

  /**
   * Inject styles by appending CSS into the head of the page.
   */
  inject() {
    for (const [key, styles] of this._stylesByKey) {
      const cssContent = this._fromStylesObjectToCss(key, styles);
      injectCss(this._namespace + '-' + key, cssContent);
    }
  }

  // https://css-tricks.com/css-ruleset-terminology/
  _fromStylesObjectToCss(key, styles) {
    return Object.entries(styles)
      .map(([classKey, object], index) => {
        const className = `${this._namespace}-${key}-${index}-${classKey}`;

        // https://sass-lang.com/documentation/style-rules/parent-selector
        const [parentSelectorEntries, entries] = partition(
          Object.entries(object),
          (entry) => entry[0].startsWith('&'),
        );
        const classesObject = Object.fromEntries(entries);
        const ruleset = toClassRuleset(className, classesObject);
        const parentClassRulesets = parentSelectorEntries.map(([property, value]) => (
          toClassRuleset(property.replace('&', className), value)
        ));
        const rulesets = [ruleset].concat(parentClassRulesets);
        return rulesets.join('');
      }).join('');
  }

  _fromStylesObjectToClassesObject(key, styles) {
    return Object.keys(styles)
      .reduce((classesAccumulator, className, index) => (
        {
          ...classesAccumulator,
          [className]: `${this._namespace}-${key}-${index}-${className}`,
        }
      ), {});
  }
}

function injectCss(namespace, cssContent) {
  const style = window.document.createElement('style');
  style.type = 'text/css';
  style.innerHTML = cssContent;
  style.dataset.namespace = namespace;
  const head = window.document.getElementsByTagName('head')[0];
  try {
    head.appendChild(style);
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

const NAMESPACE = 'openafpm';

export default new CssModuleInjector(NAMESPACE);
