/* eslint-env browser */
import * as THREE from 'three';
import CssModuleInjector from './cssModuleInjector';

const CSS_NAMESPACE = 'openafpm-view-cube';

const SIZE = '110px';
const MARGIN = '10px';
const INNER_SIZE = `calc(${SIZE} - ${MARGIN} * 2)`;

const styles = {
  viewCube: {
    width: SIZE,
    height: SIZE,
    margin: MARGIN,
    perspective: '400px',
    position: 'absolute',
    left: '2%',
    bottom: '1%',
    'z-index': '2',
  },
  cube: {
    width: INNER_SIZE,
    height: INNER_SIZE,
    position: 'relative',
    'transform-style': 'preserve-3d',
    transform: 'translateZ(-300px)',
    'text-transform': 'uppercase',
  },
  cubeFace: {
    display: 'flex',
    'justify-content': 'center',
    'align-items': 'center',
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    border: '2px solid #7d7d7d',
    'line-height': INNER_SIZE,
    'font-size': '24px',
    'font-weight': 'bold',
    color: '#7d7d7d',
    'text-align': 'center',
    background: '#ddd',
    transition: 'all 0.2s',
    cursor: 'pointer',
    'user-select': 'none',
    '&:hover': {
      background: '#7d7d7d',
      color: '#fff',
    },
  },
  xPos: {
    transform: `rotateY(90deg) rotateX(180deg) translateZ(calc(-${SIZE} / 2))`,
  },
  xNeg: {
    transform: `rotateY(-90deg) rotateX(180deg) translateZ(calc(-${SIZE} / 2))`,
  },
  yPos: {
    transform: `rotateX(90deg) rotateZ(180deg) translateZ(calc(-${SIZE} / 2))`,
  },
  yNeg: {
    transform: `rotateX(270deg) rotateZ(180deg) translateZ(calc(-${SIZE} / 2))`,
  },
  zPos: {
    transform: `rotateX(180deg) translateZ(calc(-${SIZE} / 2))`,
  },
  zNeg: {
    transform: `rotateZ(180deg) translateZ(calc(-${SIZE} / 2))`,
  },
};

const orientation = {
  xPos: {
    azimuthAngle: Math.PI / 2,
    polarAngle: Math.PI / 2,
  },
  xNeg: {
    azimuthAngle: -Math.PI / 2,
    polarAngle: Math.PI / 2,
  },
  yPos: {
    azimuthAngle: Math.PI,
    polarAngle: 0,
  },
  yNeg: {
    azimuthAngle: Math.PI,
    polarAngle: Math.PI,
  },
  zPos: {
    azimuthAngle: 0,
    polarAngle: Math.PI / 2,
  },
  zNeg: {
    azimuthAngle: Math.PI,
    polarAngle: Math.PI / 2,
  },
};

const axisDirections = [
  'xPos', 'xNeg',
  'yPos', 'yNeg',
  'zPos', 'zNeg',
];

/**
 * A 3D orientation indicator and controller.
 *
 * A cube-shaped widget placed in a corner of the window.
 * When used as an orientation indicator,
 * the ViewCube turns to reflect the current view direction.
 *
 * When used as an orientation controller,
 * the ViewCube's faces can be clicked to orient the scene to the corresponding view.
 */
export default class ViewCube {
  constructor(camera, rotateCameraTo, faces) {
    this.domElement = createViewCube(rotateCameraTo, faces);
    this.update = makeUpdateViewCube(this.domElement, camera);
  }
}

/**
 * @callback rotateCameraTo
 * @param {Object} orientation Describes the orientation of the camera.
 * @param {number} orientation.azimuthAngle If camera is Y-up,
 *                                          then azimuth angle rotates around y-axis.
 * @param {number} orientation.polarAngle If camera is Y-up,
 *                                        then polar angle rotates around x-axis.
 */

/**
 * Create a view cube.
 *
 * @param {rotateCameraTo} rotateCameraTo Function that receives azimuthAngle and polarAngle
 *                                        object.
 * @param {Array.<string>} 6-element array of face labels in order:
 *                         positive x-axis, negative x-axis,
 *                         positive y-axis, negative y-axis,
 *                         positive z-axis, negative z-axis
 * @returns {HTMLElement} View cube element.
 */
function createViewCube(rotateCameraTo, faces) {
  // inject styles into head of page
  const cssModuleInjecter = new CssModuleInjector(CSS_NAMESPACE);
  const classes = cssModuleInjecter.inject(styles);

  // create view cube container
  const viewCube = window.document.createElement('div');
  viewCube.classList.add(classes.viewCube);

  // create main cube
  const cube = window.document.createElement('div');
  cube.classList.add(classes.cube);
  viewCube.appendChild(cube);

  // create elements for each face of the cube
  faces.forEach((face, index) => {
    const faceElement = window.document.createElement('div');
    faceElement.classList.add(classes.cubeFace);
    const axisDirection = axisDirections[index];
    faceElement.classList.add(classes[axisDirection]);
    faceElement.innerText = face;
    faceElement.onclick = () => rotateCameraTo(orientation[axisDirection]);
    cube.appendChild(faceElement);
  });

  return viewCube;
}

/**
 * Make a function that updates the view cube.
 *
 * This should be called in a render loop or when the camera orientation changes.
 *
 * @param {HTMLElement} viewCube View cube element from createViewCube.
 * @param {THREE.Camera} camera Any Three.js camera.
 * @returns {function} Function that updates the view cube.
 */
function makeUpdateViewCube(viewCube, camera) {
  const matrix = new THREE.Matrix4();
  return () => {
    matrix.extractRotation(camera.matrixWorldInverse);
    viewCube.firstElementChild.style.transform = `translateZ(-300px) ${getCameraCSSMatrix(
      matrix,
    )}`;
  };
}

function epsilon(value) {
  return Math.abs(value) < 1e-3 ? 0 : value;
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/matrix3d()
 * @param {THREE.Matrix4} matrix
 * @returns {string} matrix3d
 */
function getCameraCSSMatrix(matrix) {
  const { elements } = matrix;
  return `matrix3d(
    ${epsilon(elements[0])},
    ${epsilon(-elements[1])},
    ${epsilon(elements[2])},
    ${epsilon(elements[3])},
    ${epsilon(elements[4])},
    ${epsilon(-elements[5])},
    ${epsilon(elements[6])},
    ${epsilon(elements[7])},
    ${epsilon(elements[8])},
    ${epsilon(-elements[9])},
    ${epsilon(elements[10])},
    ${epsilon(elements[11])},
    ${epsilon(elements[12])},
    ${epsilon(-elements[13])},
    ${epsilon(elements[14])},
    ${epsilon(elements[15])})`;
}
