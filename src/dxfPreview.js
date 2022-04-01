/* eslint-disable indent */
/* eslint-env browser */

class DxfPreview extends HTMLElement {
  constructor() {
    super();
    const url = this.getAttribute('url');
    const variant = this.getAttribute('variant');
    const shadow = this.attachShadow({ mode: 'open' });
    fetch(url)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .then((materialsByVariant) => {
        const materials = materialsByVariant[variant];
        shadow.innerHTML = `
            <style>
                svg {
                    width: 100%;
                    height: auto;
                    max-width: 150px;
                }
                .row {
                    display: inline-flex;
                    flex-wrap: wrap;
                    gap: 32px;
                    align-items: flex-end;
                }
            </style>
        `;
        const root = document.createElement('div');
        root.innerHTML = materials.map(({ material, thickness, objects }) => (`
            <div>
                <h1>${material} ${thickness.value} ${thickness.unit}</h1>
                <div class="row">
                    ${objects.map(({ name, svg }) => (
                        `<div style="text-align: center">${svg}<p>${name}</p></div>`
                    )).join('')}
                </div>
            </div>
        `));
        shadow.appendChild(root);
      })
      .catch(console.error);
  }
}

module.exports = DxfPreview;
