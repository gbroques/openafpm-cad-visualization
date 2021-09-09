/* eslint-env browser */
/* global DEBUG */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Stats from 'three/examples/jsm/libs/stats.module';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { EdgeSplitModifier } from 'three/examples/jsm/modifiers/EdgeSplitModifier';
import { GUI } from 'three/examples/jsm/libs/dat.gui.module';
import { Line2 } from 'three/examples/jsm/lines/Line2';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry';
import Material from './material';
import debounce from './debounce';
import createTooltip from './tooltip';

const DEFAULT_ORBIT_CONTROLS_X = -1100;

class OpenAfpmCadVisualization {
  constructor(options) {
    const {
      objUrl,
      rootDomElement,
      width,
      height,
    } = options;

    this._camera = createCamera(width, height);
    this._renderer = createRenderer(width, height);
    this._orbitControls = createOrbitControls(this._camera, this._renderer.domElement);
    this._windTurbine = {};
    this._explosionController = { Explode: 0 };

    const lightByName = createLightByName();
    this._cameraLight = lightByName.cameraLight;
    if (DEBUG) {
      this._stats = Stats();
    }

    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();
    this._tooltip = createTooltip();
    this.handleMouseMove = debounce(this._handleMouseMove, 10);

    this._scene = new THREE.Scene();

    const lights = Object.values(lightByName);
    lights.forEach((light) => {
      this._scene.add(light);
      if (light.target) {
        this._scene.add(light.target);
      }
    });

    if (DEBUG) {
      const axesHelper = new THREE.AxesHelper(1000);
      axesHelper.name = 'Axes';
      this._scene.add(axesHelper);
    }

    const materialByPartName = createMaterialByPartName();

    loadObj(objUrl).then((object) => {
      const wireMaterial = createWireMaterial(width, height);
      Object.entries(materialByPartName).forEach(([partName, material]) => {
        const mesh = object.getObjectByName(partName);
        if (mesh) {
          /**
           * EdgeSplitModifier combine vertices,
           * so that smoothing normals can be generated WITHOUT removing hard edges of model.
           * {@link https://threejs.org/examples/?q=edgesplit#webgl_modifier_edgesplit}
           * {@link https://github.com/mrdoob/three.js/pull/20535}
           */
          const edgeSplitModifier = new EdgeSplitModifier();
          const cutOffAngle = 20 * (Math.PI / 180);
          mesh.geometry = edgeSplitModifier.modify(
            mesh.geometry,
            cutOffAngle,
          );
          mesh.material = material;
          mesh.name = `${mesh.name}Mesh`;

          const numberOfWires = findNumberOfWires(object, partName);
          const wireMeshes = [...Array(numberOfWires).keys()].map((n) => {
            const importedWireMesh = object.getObjectByName(`${partName}Wire${n}`);
            return createWireMesh(importedWireMesh, wireMaterial);
          });
          const wireMeshGroup = wireMeshes.reduce((group, wireMesh) => {
            group.add(wireMesh);
            return group;
          }, new THREE.Group());
          wireMeshGroup.name = `${partName}WireGroup`;
          const part = new THREE.Group();
          part.add(mesh);
          part.add(wireMeshGroup);
          part.name = partName;
          this._windTurbine[partName] = part;
          this._scene.add(part);
        } else {
          console.warn(`"${partName}" not found in OBJ file.`);
        }
      });
      this._animate();
    }).catch(console.error);

    const gui = createGUI(
      this._orbitControls,
      this._windTurbine,
      this._explosionController,
    );
    this._render();
    this._mount(rootDomElement, gui.domElement);
  }

  resize(width, height) {
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(width, height);
  }

  _handleMouseMove(event) {
    if (this._tooltip.style.display !== 'none') {
      this._tooltip.style.left = `${event.clientX}px`;
      this._tooltip.style.top = `${event.clientY}px`;
    }

    const rect = this._renderer.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this._mouse.x = (x / this._renderer.domElement.width) * 2 - 1;
    this._mouse.y = -(y / this._renderer.domElement.height) * 2 + 1;
  }

  _mount(rootDomElement, guiDomElement) {
    const { top } = rootDomElement.getBoundingClientRect();
    const guiContainer = createGuiContainer(guiDomElement);
    guiContainer.style.top = `${top}px`;

    rootDomElement.appendChild(guiContainer);
    rootDomElement.appendChild(this._renderer.domElement);
    if (DEBUG) {
      this._stats.dom.style.top = `${top}px`;
      rootDomElement.appendChild(this._stats.dom);
    }
    rootDomElement.appendChild(this._tooltip);
  }

  _animate() {
    this._orbitControls.update();
    if (DEBUG) {
      this._stats.update();
    }
    this._render();
    window.requestAnimationFrame(() => this._animate());
  }

  _render() {
    this._positionCameraLight();
    if (this._isWindTurbineLoaded()) {
      this._explode();
    }

    this._raycaster.setFromCamera(this._mouse, this._camera);

    const parts = this._getVisibleMeshes();
    // console.log('parts', intersects);
    const recursive = true;
    const intersects = this._raycaster.intersectObjects(parts, recursive);
    // console.log('intersects', intersects);

    if (!intersects.length) {
      this._tooltip.style.display = 'none';
    } else {
      this._tooltip.style.display = 'block';

      const intersected = intersects[0];

      const oldestAncestor = findOldestAncestor(intersected.object);
      const label = separatePascalCaseBySpaces(oldestAncestor.name);
      this._tooltip.textContent = label;
    }
    this._renderer.render(this._scene, this._camera);
  }

  _getVisibleMeshes() {
    return Object.values(this._windTurbine)
      .filter((p) => p.visible);
  }

  _positionCameraLight() {
    this._cameraLight.position.set(
      this._camera.position.x,
      this._camera.position.y,
      this._camera.position.z,
    );
  }

  _isWindTurbineLoaded() {
    return Object.keys(this._windTurbine).length > 0;
  }

  _explode() {
    const statorExlosionFactor = 0;
    this._explodeX('StatorResinCast', statorExlosionFactor);
    this._explodeX('Coils', statorExlosionFactor);

    const rotorExlosionFactor = 0.5;
    this._explodeX('BottomRotorResinCast', rotorExlosionFactor);
    this._explodeX('BottomRotorDisk', rotorExlosionFactor);
    this._explodeX('BottomMagnets', rotorExlosionFactor);
    this._explodeX('TopRotorResinCast', -rotorExlosionFactor);
    this._explodeX('TopRotorDisk', -rotorExlosionFactor);
    this._explodeX('TopMagnets', -rotorExlosionFactor);

    this._explodeX('HubThreads', -0.7);
    this._explodeX('RotorSideFlangeCover', -1);
    this._explodeX('Flange', -1.2);
    this._explodeX('FrameSideFlangeCover', -1.4);
    this._explodeX('StubAxleShaft', -1.6);

    const frameExplosionFactor = -2.5;
    this._explodeX('Frame', frameExplosionFactor);
    this._explodeX('StatorMountingStuds', frameExplosionFactor);

    this._explodeX('YawBearing', -3.4);
    this._explodeX('TailHinge', -4.3);
    this._explodeX('TailBoom', -5);
    this._explodeX('TailVane', -7);
  }

  _explodeX(property, explosionFactor) {
    const explode = this._explosionController.Explode;
    if (this._windTurbine[property]) {
      this._windTurbine[property].position.x = explode * explosionFactor;
    }
  }
}

function createGuiContainer(guiDomElement) {
  const autoPlaceContainer = window.document.createElement('div');
  const datGuiCssNamespace = guiDomElement.classList[0];
  autoPlaceContainer.classList.add(datGuiCssNamespace);
  autoPlaceContainer.classList.add(GUI.CLASS_AUTO_PLACE_CONTAINER);
  guiDomElement.classList.add(GUI.CLASS_AUTO_PLACE);
  autoPlaceContainer.appendChild(guiDomElement);
  return autoPlaceContainer;
}

function createCamera(width, height) {
  const fieldOfView = 55;
  const aspectRatio = width / height;
  const near = 0.1;
  const far = 8000;
  const camera = new THREE.PerspectiveCamera(
    fieldOfView,
    aspectRatio,
    near,
    far,
  );
  camera.position.set(1000, 150, -2000);
  return camera;
}

function createRenderer(width, height) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  return renderer;
}

function createOrbitControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.maxDistance = 5000;
  controls.minDistance = 250;
  controls.target.set(DEFAULT_ORBIT_CONTROLS_X, 0, 0);
  return controls;
}

function createLightByName() {
  return {
    cameraLight: createCameraLight(),
    ambientLight: createAmbientLight(),
    sunLight: createSunLight(),
  };
}

function createCameraLight() {
  const color = 0xFFFFFF;
  const directionalLightIntensity = 0.15;
  const cameraLight = new THREE.DirectionalLight(color, directionalLightIntensity);
  cameraLight.target.position.set(0, 0, 0);
  return cameraLight;
}

function createSunLight() {
  const color = 0xFFFFFF;
  const directionalLightIntensity = 0.1;
  const sunLight = new THREE.DirectionalLight(color, directionalLightIntensity);
  sunLight.position.set(-1000, 1000, -1000);
  sunLight.target.position.set(0, 0, 0);
  return sunLight;
}

function createAmbientLight() {
  const color = 0xffffff;
  const intensity = 0.3;
  return new THREE.AmbientLight(color, intensity);
}

function createMaterialByPartName() {
  return {
    StatorResinCast: Material.RESIN,
    StatorMountingStuds: Material.STEEL,
    Coils: Material.COPPER,
    BottomRotorResinCast: Material.RESIN,
    BottomRotorDisk: Material.STEEL,
    BottomMagnets: Material.MAGNET,
    TopRotorResinCast: Material.RESIN,
    TopRotorDisk: Material.STEEL,
    TopMagnets: Material.MAGNET,
    Frame: Material.STEEL,
    Flange: Material.STEEL,
    RotorSideFlangeCover: Material.STEEL,
    FrameSideFlangeCover: Material.STEEL,
    StubAxleShaft: Material.STEEL,
    HubThreads: Material.STEEL,
    YawBearing: Material.STEEL,
    TailHinge: Material.STEEL,
    TailBoom: Material.STEEL,
    TailVane: Material.WOOD,
  };
}

function createGUI(orbitControls, windTurbine, explosionController) {
  const gui = new GUI({ autoPlace: false });
  gui.closed = true;

  const obj = {
    'Reset View': () => {
      orbitControls.reset();
      orbitControls.target.set(DEFAULT_ORBIT_CONTROLS_X, 0, 0);
    },
  };
  gui.add(obj, 'Reset View');

  const guiConfiguration = {
    'Stator Resin Cast': ['StatorResinCast'],
    Studs: ['StatorMountingStuds'],
    Coils: ['Coils'],
    'Rotor Resin Cast': ['BottomRotorResinCast', 'TopRotorResinCast'],
    'Rotor Disk': ['BottomRotorDisk', 'TopRotorDisk'],
    'Rotor Magnets': ['BottomMagnets', 'TopMagnets'],
    Hub: {
      Flange: ['Flange'],
      'Rotor Side Flange Cover': ['RotorSideFlangeCover'],
      'Frame Side Flange Cover': ['FrameSideFlangeCover'],
      'Stub Axle Shaft': ['StubAxleShaft'],
    },
    Threads: ['HubThreads'],
    Frame: ['Frame'],
    'Yaw Bearing': ['YawBearing'],
    'Tail Hinge': ['TailHinge'],
    'Tail Boom': ['TailBoom'],
    'Tail Vane': ['TailVane'],
  };

  const partNamesByVisibilityLabel = flattenObject(guiConfiguration);

  const visibilityLabels = Object.keys(partNamesByVisibilityLabel);
  const visibilityController = visibilityLabels.reduce((acc, visibilityLabel) => (
    { ...acc, [visibilityLabel]: true }
  ), {});

  const entries = Object.entries(partNamesByVisibilityLabel);
  const changeHandlerByVisibilityLabel = entries.reduce((accumulator, entry) => {
    const [visibilityLabel, partNames] = entry;
    return {
      ...accumulator,
      [visibilityLabel]: (value) => {
        partNames.forEach((partName) => {
          windTurbine[partName].visible = value;
        });
      },
    };
  }, {});
  Object.entries(guiConfiguration).forEach(([key, value]) => {
    const changeHandler = changeHandlerByVisibilityLabel[key];
    if (changeHandler) {
      gui.add(visibilityController, key).onChange(changeHandler);
    } else {
      const subgui = gui.addFolder(key);
      const subVisibilityLabels = Object.keys(value);
      subVisibilityLabels.forEach((visibilityLabel) => {
        const ch = changeHandlerByVisibilityLabel[visibilityLabel];
        subgui.add(visibilityController, visibilityLabel).onChange(ch);
      });
    }
  });
  gui.add(explosionController, 'Explode', 0, 100);
  return gui;
}

function loadObj(url) {
  return new Promise((resolve, reject) => {
    const objLoader = new OBJLoader();
    objLoader.load(url, resolve, handleProgress, reject);
  });
}

function handleProgress(xhr) {
  const url = new URL(xhr.target.responseURL);
  const filename = url.pathname.slice(1);
  const progressPercentage = (xhr.loaded / xhr.total) * 100;
  if (DEBUG) {
    console.log(`index.js: ${filename} ${progressPercentage}% loaded.`);
  }
}

function separatePascalCaseBySpaces(pascalCaseWord) {
  return pascalCaseWord.replace(/([A-Z])/g, ' $1').trim();
}

function flattenObject(object) {
  return Object.entries(object).reduce((acc, entry) => {
    const [key, value] = entry;
    if (!isObject(value)) {
      return { ...acc, [key]: value };
    }
    return { ...acc, ...value };
  }, {});
}

function isObject(value) {
  return typeof value === 'object' && !Array.isArray(value);
}

/**
 * Create wire mesh.
 *
 * WebGL cannot render lines wider than 1px due to browser limitations.
 * Thus, Line2 used.
 * {@link https://threejs.org/examples/?q=fat#webgl_lines_fat}
 * {@link https://jsfiddle.net/brLk6aud/1/}
 *
 */
function createWireMesh(importedMesh, material) {
  const importedPositions = importedMesh.geometry.attributes.position.array;
  const geometry = createWireGeometry(importedPositions);

  const mesh = new Line2(geometry, material);
  mesh.name = importedMesh.name;
  return mesh;
}

function createWireGeometry(positions) {
  const geometry = new LineGeometry();
  geometry.setPositions(positions);
  return geometry;
}

/**
 * {@link https://github.com/mrdoob/three.js/blob/r132/examples/jsm/lines/LineMaterial.js}
 */
function createWireMaterial(width, height) {
  const material = new LineMaterial({
    color: 0x000000,
    linewidth: 1.5, // in pixels
    dashed: false,
    dashScale: 3,
    dashSize: 1,
    gapSize: 1,
  });
  material.resolution.set(width, height);
  return material;
}

function findNumberOfWires(object, name) {
  return object.children.filter((child) => child.name.startsWith(`${name}Wire`)).length;
}

function findOldestAncestor(object) {
  if (object.parent && object.parent.type !== 'Scene') {
    return findOldestAncestor(object.parent);
  }
  return object;
}

module.exports = OpenAfpmCadVisualization;
