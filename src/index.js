/* eslint-env browser */
/* global DEBUG */
// TODO: Remove global debug variable in order to reduce coupling with esbuild
//       and make code more flexible. debug can be passed in options.
//       Should this be named development?
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { GUI } from 'three/examples/jsm/libs/dat.gui.module';
import makeGroupWiresTogether from './makeGroupWiresTogether';
import Material from './material';
import debounce from './debounce';
import createTooltip from './tooltip';
import flattenObject from './flattenObject';
import createLoadingScreen from './loading';
import transformsToMatrix4 from './transformsToMatrix4';
import findMeshes from './findMeshes';

const DEFAULT_ORBIT_CONTROLS_X = -1100;

const TAIL_PARTS = new Set([
  'OuterTailHinge',
  'TailBoom',
  'TailVane',
]);

class OpenAfpmCadVisualization {
  constructor(options) {
    const {
      objUrl,
      rootDomElement,
      width,
      height,
      furlTransforms,
    } = options;

    this._camera = createCamera(width, height);
    this._renderer = createRenderer(width, height);
    this._orbitControls = createOrbitControls(
      this._camera,
      this._renderer.domElement,
      () => this._render(),
    );
    this._windTurbine = {};
    this._controller = { Explode: 0, Furl: 0 };
    this._furlTransforms = furlTransforms;

    const lightByName = createLightByName();

    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();
    this._tooltip = createTooltip();
    this._get_label = compose(removePositionalWords, separatePascalCaseBySpaces);
    this.handleMouseMove = debounce(this._handleMouseMove, 15);
    // Use mutable array to keep track of visible meshes for tooltip performance.
    this._visibleMeshes = [];

    this._scene = new THREE.Scene();

    const lights = Object.values(lightByName);
    lights.forEach((light) => {
      this._scene.add(light);
      if (light.target) {
        light.target.name = `${light.name}Target`;
        light.target.updateMatrixWorld();
        this._scene.add(light.target);
      }
      // Uncomment below lines when debugging lights.
      // if (DEBUG && light.type === 'DirectionalLight') {
      //   const lightHelper = new THREE.DirectionalLightHelper(
      //     light, 100, 0x000000,
      //   );
      //   this._scene.add(lightHelper);
      // }
    });

    if (DEBUG) {
      const axesHelper = new THREE.AxesHelper(1000);
      axesHelper.name = 'Axes';
      this._scene.add(axesHelper);
    }

    const materialByPartName = createMaterialByPartName();

    const groupWiresTogether = makeGroupWiresTogether(width, height);

    const opacityDuration = 200; // in milliseconds
    const loadingScreen = createLoadingScreen(opacityDuration, height);
    rootDomElement.appendChild(loadingScreen);

    const tailMatrix = transformsToMatrix4(furlTransforms);
    this._tail = initializeTail(tailMatrix);

    this._tailCenter = new THREE.Vector3()
      .setFromMatrixPosition(tailMatrix);

    const tailMatrixInverse = new THREE.Matrix4()
      .copy(tailMatrix)
      .invert();

    loadObj(objUrl)
      .then(groupWiresTogether)
      .then((parts) => {
        loadingScreen.style.opacity = 0;
        setTimeout(() => {
          rootDomElement.removeChild(loadingScreen);
          const container = createAppContainer(opacityDuration);
          parts.forEach((part) => {
            const material = materialByPartName[part.name];
            const mesh = part.children.find((c) => c.name.endsWith('Mesh'));
            this._visibleMeshes.push(mesh);
            mesh.material = material;
            if (TAIL_PARTS.has(part.name)) {
              part.matrix = tailMatrixInverse;
              part.matrixAutoUpdate = false;
              this._tail.add(part);
            } else {
              this._scene.add(part);
              this._windTurbine[part.name] = part;
            }
          });
          this._scene.add(this._tail);
          this._windTurbine.Tail = this._tail;

          const handleExplode = debounce(() => this._render(), 5);
          const gui = createGUI(
            this._orbitControls,
            this._windTurbine,
            this._visibleMeshes,
            this._controller,
            handleExplode,
          );
          // Must append container to root DOM element before this._mount()
          rootDomElement.appendChild(container);
          this._mount(container, gui.domElement);
          container.style.opacity = '1';
          this._orbitControls.update();
          this._render();
        }, opacityDuration);
      }).catch(console.error);
  }

  resize(width, height) {
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
    this._orbitControls.update();
    this._renderer.setSize(width, height);
    this._render();
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

    this._raycaster.setFromCamera(this._mouse, this._camera);

    const recursive = false;
    const intersects = this._raycaster.intersectObjects(this._visibleMeshes, recursive);

    if (!intersects.length) {
      this._tooltip.style.display = 'none';
    } else {
      this._tooltip.style.display = 'block';

      const intersected = intersects[0];

      const label = this._get_label(intersected.object.parent.name);
      this._tooltip.textContent = label;
    }
  }

  _mount(rootDomElement, guiDomElement) {
    const { top } = rootDomElement.getBoundingClientRect();
    const guiContainer = createGuiContainer(guiDomElement);
    guiContainer.style.top = `${top}px`;

    rootDomElement.appendChild(guiContainer);
    rootDomElement.appendChild(this._renderer.domElement);
    rootDomElement.appendChild(this._tooltip);
  }

  _animate() {
    this._orbitControls.update();
    this._render();
    this._animationFrameRequestId = window.requestAnimationFrame(() => this._animate());
  }

  cleanUp() {
    this._scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.material.dispose();
        object.geometry.dispose();
      }
    });
    window.cancelAnimationFrame(this._animationFrameRequestId);
  }

  _render() {
    if (this._isWindTurbineLoaded()) {
      const tailHingeExplosionFactor = -4.3;
      this._furl(tailHingeExplosionFactor);
      this._explode(tailHingeExplosionFactor);
    }
    this._renderer.render(this._scene, this._camera);
  }

  _isWindTurbineLoaded() {
    return Object.keys(this._windTurbine).length > 0;
  }

  _furl(tailHingeExplosionFactor) {
    const furlAngle = this._controller.Furl * (Math.PI / 180);
    this._furlTransforms[1].angle = furlAngle;
    const transform = transformsToMatrix4(this._furlTransforms);
    const explode = this._controller.Explode;
    const explodeVector = new THREE.Vector3(
      explode * tailHingeExplosionFactor, 0, 0,
    );
    explodeVector.add(this._tailCenter);
    transform.setPosition(explodeVector);
    this._tail.matrix = transform;
  }

  _explode(tailHingeExplosionFactor) {
    const statorExlosionFactor = 0;
    this._explodeX('StatorResinCast', statorExlosionFactor);
    this._explodeX('Coils', statorExlosionFactor);

    const rotorExlosionFactor = 0.5;
    this._explodeX('FrontRotorResinCast', rotorExlosionFactor);
    this._explodeX('FrontRotorDisk', rotorExlosionFactor);
    this._explodeX('FrontMagnets', rotorExlosionFactor);
    this._explodeX('BackRotorResinCast', -rotorExlosionFactor);
    this._explodeX('BackRotorDisk', -rotorExlosionFactor);
    this._explodeX('BackMagnets', -rotorExlosionFactor);

    this._explodeX('HubThreads', -0.7);
    this._explodeX('RotorSideFlangeCover', -1);
    this._explodeX('Flange', -1.2);
    this._explodeX('FrameSideFlangeCover', -1.4);
    this._explodeX('StubAxleShaft', -1.6);

    const frameExplosionFactor = -2.5;
    this._explodeX('Frame', frameExplosionFactor);
    this._explodeX('StatorMountingStuds', frameExplosionFactor);

    this._explodeX('YawBearing', -3.4);
    this._explodeX('TailHinge', tailHingeExplosionFactor);
  }

  _explodeX(property, explosionFactor) {
    const explode = this._controller.Explode;
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

function createOrbitControls(camera, domElement, onChange) {
  const controls = new OrbitControls(camera, domElement);
  controls.maxDistance = 5000;
  controls.minDistance = 250;
  controls.target.set(DEFAULT_ORBIT_CONTROLS_X, 0, 0);
  controls.addEventListener('change', onChange);
  return controls;
}

function createLightByName() {
  return {
    ambientLight: createAmbientLight(),
    frontLight: createFrontLight(),
    backLight: createBackLight(),
  };
}

function createFrontLight() {
  const color = 0xFFFFFF;
  const directionalLightIntensity = 0.1;
  const light = new THREE.DirectionalLight(color, directionalLightIntensity);
  light.position.set(800, 100, -1000);
  light.target.position.set(-1000, 0, -150);
  light.name = 'FrontLight';
  return light;
}

function createBackLight() {
  const color = 0xFFFFFF;
  const directionalLightIntensity = 0.1;
  const light = new THREE.DirectionalLight(color, directionalLightIntensity);
  light.position.set(-2000, -100, 0);
  light.target.position.set(0, 0, 0);
  light.name = 'BackLight';
  return light;
}

function createAmbientLight() {
  const color = 0xFFFFFF;
  const intensity = 0.50;
  return new THREE.AmbientLight(color, intensity);
}

function createMaterialByPartName() {
  return {
    StatorResinCast: Material.RESIN,
    StatorMountingStuds: Material.STEEL,
    Coils: Material.COPPER,
    FrontRotorResinCast: Material.RESIN,
    FrontRotorDisk: Material.STEEL,
    FrontMagnets: Material.MAGNET,
    BackRotorResinCast: Material.RESIN,
    BackRotorDisk: Material.STEEL,
    BackMagnets: Material.MAGNET,
    Frame: Material.STEEL,
    Flange: Material.STEEL,
    RotorSideFlangeCover: Material.STEEL,
    FrameSideFlangeCover: Material.STEEL,
    StubAxleShaft: Material.STEEL,
    HubThreads: Material.STEEL,
    YawBearing: Material.STEEL,
    TailHinge: Material.STEEL,
    OuterTailHinge: Material.STEEL,
    TailBoom: Material.STEEL,
    TailVane: Material.WOOD,
  };
}

function createGUI(
  orbitControls,
  windTurbine,
  visibleMeshes,
  controller,
  onControllerChange,
) {
  const gui = new GUI({ autoPlace: false });
  gui.closed = false;

  const obj = {
    'Reset View': () => {
      orbitControls.target.set(DEFAULT_ORBIT_CONTROLS_X, 0, 0);
      orbitControls.object.position.set(1000, 150, -2000);
      orbitControls.update();
    },
  };
  gui.add(obj, 'Reset View');
  gui.add(controller, 'Explode', 0, 100)
    .onChange(onControllerChange);
  gui.add(controller, 'Furl', 0, 105)
    .onChange(onControllerChange);

  const guiConfiguration = {
    'Resin Cast': [
      'StatorResinCast',
      'FrontRotorResinCast',
      'BackRotorResinCast',
    ],
    Coils: ['Coils'],
    'Rotor Disk': ['FrontRotorDisk', 'BackRotorDisk'],
    Magnets: ['FrontMagnets', 'BackMagnets'],
    Hub: [
      'Flange',
      'RotorSideFlangeCover',
      'FrameSideFlangeCover',
      'StubAxleShaft',
      'HubThreads',
    ],
    Frame: ['Frame', 'StatorMountingStuds'],
    'Yaw Bearing': ['YawBearing'],
    'Tail Hinge': ['TailHinge'],
    Tail: ['Tail'],
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
          const part = windTurbine[partName];
          part.visible = value;
          if (value) {
            const meshes = findMeshes(part);
            if (!meshes) {
              console.warn(`No meshes found for part '${partName}'`);
            } else {
              visibleMeshes.push(...meshes);
            }
          } else {
            const removeVisibleMesh = (meshName) => {
              const index = visibleMeshes.findIndex((m) => m.name === `${meshName}Mesh`);
              if (index < 0) {
                console.warn(`No mesh found for part '${meshName}'`);
              } else {
                visibleMeshes.splice(index, 1);
              }
            };
            const meshNamesByPartName = {
              Tail: TAIL_PARTS,
            };
            if (meshNamesByPartName[partName]) {
              meshNamesByPartName[partName].forEach(removeVisibleMesh);
            } else {
              removeVisibleMesh(partName);
            }
          }
          onControllerChange();
        });
      },
    };
  }, {});
  const visibilityGui = gui.addFolder('Visibility');
  Object.entries(guiConfiguration).forEach(([key, value]) => {
    const changeHandler = changeHandlerByVisibilityLabel[key];
    if (changeHandler) {
      visibilityGui.add(visibilityController, key).onChange(changeHandler);
    } else {
      const subgui = visibilityGui.addFolder(key);
      const subVisibilityLabels = Object.keys(value);
      subVisibilityLabels.forEach((visibilityLabel) => {
        const ch = changeHandlerByVisibilityLabel[visibilityLabel];
        subgui.add(visibilityController, visibilityLabel).onChange(ch);
      });
    }
  });
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

function removePositionalWords(partName) {
  return partName.replace(/^(Front|Back)/, '');
}

function compose(f, g) {
  return (...args) => g(f(...args));
}

function createAppContainer(opacityDuration) {
  const container = window.document.createElement('div');
  container.style = `opacity: 0; transition: opacity ${opacityDuration}ms ease-in-out;`;
  return container;
}

function initializeTail(tailMatrix) {
  const tail = new THREE.Group();
  tail.name = 'Tail';
  tail.matrix = tailMatrix;
  tail.matrixAutoUpdate = false;
  return tail;
}

module.exports = OpenAfpmCadVisualization;
