/* eslint-env browser */
/* global DEBUG */
// TODO: Remove global debug variable in order to reduce coupling with esbuild
//       and make code more flexible. debug can be passed in options.
//       Should this be named development?
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { GUI } from 'three/examples/jsm/libs/dat.gui.module';
import CameraControls from 'camera-controls';
import { CancelablePromise } from 'cancelable-promise';

import makeGroupWiresTogether from './makeGroupWiresTogether';
import debounce from './debounce';
import createTooltip from './tooltip';
import createLoadingScreen from './loading';
import ViewCube from './viewCube';
import WindTurbineVisualizer from './windTurbineVisualizer';
import ToolVisualizer from './toolVisualizer';
import makeGroupParts from './makeGroupParts';
import findMeshes from './findMeshes';
import setupVisibilityFolder from './setupVisibilityFolder';

CameraControls.install({ THREE });

class OpenAfpmCadVisualization {
  constructor(options) {
    const {
      rootDomElement,
      width,
      height,
    } = options;
    this._rootDomElement = rootDomElement;
    this._width = width;
    this._height = height;

    this._renderer = createRenderer(width, height);
  }

  visualize(objUrl, type, transformsByName = {}) {
    this._cleanUpVisualization();
    this._visualizer = type === 'WindTurbine'
      ? new WindTurbineVisualizer()
      : new ToolVisualizer();
    // must be PerspectiveCamera because aspect is set in resize
    // https://threejs.org/docs/?q=ca#api/en/cameras/PerspectiveCamera
    this._camera = this._visualizer.createCamera(this._width, this._height);
    this._cameraControls = this._visualizer.createCameraControls(
      this._camera,
      this._renderer.domElement,
      () => this._render(),
    );
    this._clock = new THREE.Clock();

    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();
    this._tooltip = createTooltip();
    this.handleMouseMove = debounce(this._handleMouseMove, 15);

    const rotateCameraTo = ({ azimuthAngle, polarAngle }) => {
      const enableTransition = false;
      this._cameraControls.rotateTo(azimuthAngle, polarAngle, enableTransition);
      this._render();
    };
    const faces = this._visualizer.getViewCubeFaces();
    this._viewCube = new ViewCube(this._camera, rotateCameraTo, faces);

    this._scene = new THREE.Scene();
    // Use mutable array to keep track of visible meshes for tooltip performance.
    this._visibleMeshes = [];
    this._isModelLoaded = false;
    // must return controller with Explode key
    const initialController = this._visualizer.getInitialController();
    this._controller = initialController;
    this._resetController = () => {
      Object.assign(this._controller, initialController);
    };

    const lights = this._visualizer.createLights();
    lights.forEach((light) => {
      this._scene.add(light);
      if (light.target) {
        light.target.name = `${light.name}Target`;
        light.target.updateMatrixWorld();
        this._scene.add(light.target);
      }
      if (DEBUG && light.type === 'DirectionalLight') {
        const lightHelper = new THREE.DirectionalLightHelper(
          light, 100, 0x000000,
        );
        this._scene.add(lightHelper);
      }
    });

    if (DEBUG) {
      const axesHelper = new THREE.AxesHelper(1000);
      axesHelper.name = 'Axes';
      this._scene.add(axesHelper);
    }
    const opacityDuration = 200; // in milliseconds
    const { showLoadingScreen, hideLoadingScreen } = createLoadingScreen(
      this._rootDomElement, opacityDuration, this._height,
    );
    showLoadingScreen();
    const groupWiresTogether = makeGroupWiresTogether(this._width, this._height);
    const groupConfigurations = this._visualizer.getGroupConfigurations
      ? this._visualizer.getGroupConfigurations(transformsByName)
      : [];
    const groupParts = makeGroupParts(groupConfigurations);
    this._previousPromise = loadObj(objUrl)
      .then(groupWiresTogether)
      .then(groupParts)
      .then(hideLoadingScreen)
      .then((parts) => {
        parts.forEach((part) => {
          const meshes = findMeshes(part);
          meshes.forEach((mesh) => {
            this._visibleMeshes.push(mesh);
            const material = this._visualizer.getMaterial(mesh.parent.name);
            mesh.material = material;
          });
          this._scene.add(part);
        });

        const setupContext = {
          transformsByName,
          camera: this._camera,
          cameraControls: this._cameraControls,
          width: this._width,
          height: this._height,
        };
        this._visualizer.setup(parts, setupContext);
        const updateCameraControls = false;
        const handleControllerChange = debounce(() => this._render(updateCameraControls), 5);
        const gui = initializeGui(this._cameraControls, this._controller, handleControllerChange);
        if (this._visualizer.setupGui) {
          this._visualizer.setupGui(
            gui,
            this._controller,
            handleControllerChange,
          );
        }
        this._cleanUpGui = setupVisibilityFolder(
          gui,
          this._visualizer.getPartNamesByVisibilityLabel(parts),
          parts,
          this._visibleMeshes,
          handleControllerChange,
        );

        // Must append container to root DOM element before this._mount()
        const container = createAppContainer(opacityDuration);
        this._rootDomElement.appendChild(container);
        this._mount(container, gui.domElement);
        container.style.opacity = '1';
        this._cameraControls.update();
        this._isModelLoaded = true;
        this._render();
      })
      .catch(console.error);
  }

  resize(width, height) {
    this._width = width;
    this._height = height;
    const aspectRatio = width / height;
    if (this._camera.isOrthographicCamera) {
      const { viewSize } = this._camera;
      this._camera.left = -(aspectRatio * viewSize) / 2;
      this._camera.right = (aspectRatio * viewSize) / 2;
    } else {
      this._camera.aspect = aspectRatio;
    }
    this._camera.updateProjectionMatrix();
    this._cameraControls.setViewport(0, 0, width, height);
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
    if (!this._visibleMeshes) return;
    const intersects = this._raycaster.intersectObjects(this._visibleMeshes, recursive);

    if (!intersects.length) {
      this._tooltip.style.display = 'none';
    } else {
      this._tooltip.style.display = 'block';

      const intersected = intersects[0];

      const label = this._visualizer.getTooltipLabel(intersected.object.parent.name);
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
    rootDomElement.appendChild(this._viewCube.domElement);
  }

  /**
   * @see https://threejs.org/docs/#manual/en/introduction/How-to-dispose-of-objects
   */
  _cleanUpVisualization() {
    if (this._previousPromise) this._previousPromise.cancel();

    if (this._cleanUpGui) this._cleanUpGui();

    if (this._scene) {
      this._scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.material.dispose();
          object.geometry.dispose();
        }
      });
    }
    if (this._cameraControls) this._cameraControls.dispose();
  }

  cleanUp() {
    this._cleanUpVisualization();
    this._renderer.dispose();
  }

  _render(updateCameraControls = true) {
    // update camera controls conditionally to avoid
    // visual jumping when toggling the visibility of parts.
    if (updateCameraControls) {
      const delta = this._clock.getDelta();
      this._cameraControls.update(delta);
    }
    if (this._isModelLoaded) {
      // allow subclasses to optionally implement extra render functionality
      // such as furl in the case of the wind turbine visualization.
      if (this._visualizer.handleRender) this._visualizer.handleRender(this._controller);
      this._visualizer.explode(this._controller, this._cameraControls);
    }
    this._renderer.render(this._scene, this._camera);
    this._viewCube.update();
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

/**
 * Initializes GUI with 'Reset View' and 'Explode' functions.
 */
function initializeGui(cameraControls, controller, onControllerChange) {
  const gui = new GUI({ autoPlace: false });
  gui.closed = false;

  const initialCameraPosition = new THREE.Vector3();
  cameraControls.getPosition(initialCameraPosition);

  const obj = {
    'Reset View': () => {
      const enableTransition = false;
      cameraControls.reset(enableTransition);
      cameraControls.setPosition(
        initialCameraPosition.x,
        initialCameraPosition.y,
        initialCameraPosition.z,
      );
      cameraControls.update();
      onControllerChange();
    },
  };
  gui.add(obj, 'Reset View');
  gui.add(controller, 'Explode', 0, 100)
    .onChange(onControllerChange);
  return gui;
}

function createRenderer(width, height) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    logarithmicDepthBuffer: true,
  });
  renderer.setSize(width, height);
  return renderer;
}

function loadObj(url) {
  return new CancelablePromise((resolve, reject) => {
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

function createAppContainer(opacityDuration) {
  const container = window.document.createElement('div');
  container.style = 'opacity: 0;'
    + `transition: opacity ${opacityDuration}ms ease-in-out;`
    + 'position: relative';
  return container;
}

module.exports = OpenAfpmCadVisualization;
