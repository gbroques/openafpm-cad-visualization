/* eslint-env browser */
/* global DEBUG */
// TODO: Remove global debug variable in order to reduce coupling with esbuild
//       and make code more flexible. debug can be passed in options.
//       Should this be named development?
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import CameraControls from 'camera-controls';
import { cancelable } from 'cancelable-promise';

import makeGroupWiresTogether from './makeGroupWiresTogether';
import debounce from './debounce';
import createTooltip from './tooltip';
import createLoadingScreen, { OPACITY_DURATION } from './loadingScreen';
import createErrorScreen from './errorScreen';
import ViewCube from './viewCube';
import WindTurbineVisualizer from './windTurbineVisualizer';
import ToolVisualizer from './toolVisualizer';
import makeGroupParts from './makeGroupParts';
import findMeshes from './findMeshes';
import setupTransparencyFolder from './setupTransparencyFolder';
import cssModuleInjector from './cssModuleInjector';
import theme from './theme';

cssModuleInjector.set('root', theme);

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

    // Add theme styles.
    const classes = cssModuleInjector.getClasses('root');
    rootDomElement.classList.add(classes.root);
    cssModuleInjector.inject();
  }

  visualize(loadObj, assembly, furlTransformPromise = Promise.resolve(null)) {
    this._cleanUpVisualization();
    this._visualizer = assembly === 'WindTurbine'
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
    const { showLoadingScreen, hideLoadingScreen } = createLoadingScreen(
      this._rootDomElement,
    );
    showLoadingScreen();
    const groupWiresTogether = makeGroupWiresTogether(this._width, this._height);
    const groupParts = makeGroupParts(
      furlTransformPromise, this._visualizer.getGroupConfigurations,
    );
    const objTextPromise = cancelable(loadObj());
    this._previousPromise = objTextPromise
      .then(parseObjText)
      .then(groupWiresTogether)
      .then(groupParts)
      .then(hideLoadingScreen)
      .then(([parts, furlTransform]) => {
        parts.forEach((part) => {
          const meshes = findMeshes(part);
          meshes.forEach((mesh) => {
            // fix issue where magnets and coils disappear with only their wire remaining
            // see: https://stackoverflow.com/a/17648548
            if (mesh.parent.name.toLowerCase().includes('resin')) {
              mesh.renderOrder = 0.1;
            }
            this._visibleMeshes.push(mesh);
            const material = this._visualizer.createMaterial(mesh.parent.name);
            mesh.material = material;
          });
          this._scene.add(part);
        });

        const setupContext = {
          furlTransform,
          camera: this._camera,
          cameraControls: this._cameraControls,
          width: this._width,
          height: this._height,
          sortOverrideArray: getSortOverrideArray(assembly),
        };
        const sortedParts = this._visualizer.setup(parts, setupContext);
        const updateCameraControls = false;
        const handleControllerChange = debounce(() => this._render(updateCameraControls), 5);
        this._guiContainer = window.document.createElement('div');
        const gui = initializeGui(this._guiContainer, this._cameraControls, this._controller, handleControllerChange);
        if (this._visualizer.setupGui) {
          this._visualizer.setupGui(
            gui,
            this._controller,
            handleControllerChange,
            setupContext,
          );
        }
        this._cleanUpGui = setupTransparencyFolder(
          gui,
          this._visualizer.getPartNamesByTransparencyLabel(sortedParts),
          sortedParts,
          this._visibleMeshes,
          handleControllerChange,
        );

        // Must append container to root DOM element before this._mount()
        const container = createAppContainer(OPACITY_DURATION);
        this._rootDomElement.appendChild(container);
        this._setGuiContainerStyle();
        this._mount(container);
        container.style.opacity = '1';
        this._cameraControls.update();
        this._isModelLoaded = true;
        this._render();
      })
      .catch((error) => {
        console.error(error);
        const { showErrorScreen } = createErrorScreen(this._rootDomElement);
        hideLoadingScreen()
          .then(() => showErrorScreen(error.message));
      });
  }

  resize(width, height) {
    this._width = width;
    this._height = height;
    if (this._camera) {
      const aspectRatio = width / height;
      if (this._camera.isOrthographicCamera) {
        const { viewSize } = this._camera;
        this._camera.left = -(aspectRatio * viewSize) / 2;
        this._camera.right = (aspectRatio * viewSize) / 2;
      } else {
        this._camera.aspect = aspectRatio;
      }
      this._camera.updateProjectionMatrix();
    }
    if (this._cameraControls) {
      this._cameraControls.setViewport(0, 0, width, height);
    }
    this._setGuiContainerStyle();
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

  _mount(rootDomElement) {
    rootDomElement.appendChild(this._guiContainer);
    rootDomElement.appendChild(this._renderer.domElement);
    rootDomElement.appendChild(this._tooltip);
    rootDomElement.appendChild(this._viewCube.domElement);
  }

  _setGuiContainerStyle() {
    if (this._guiContainer) {
      // Based on lil-gui autoPlace styles:
      // https://github.com/georgealways/lil-gui/blob/v0.20.0/style/base.scss#L109-L115
      this._guiContainer.style.position = 'fixed';
      const { top } = this._rootDomElement.getBoundingClientRect();
      this._guiContainer.style.top = `${top}px`;
      this._guiContainer.style.right = '15px';
      this._guiContainer.style.zIndex = '1001';
    }
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
    if (this._cameraControls && updateCameraControls) {
      const delta = this._clock.getDelta();
      this._cameraControls.update(delta);
    }
    if (this._isModelLoaded) {
      // allow subclasses to optionally implement extra render functionality
      // such as furl in the case of the wind turbine visualization.
      if (this._visualizer.handleRender) this._visualizer.handleRender(this._controller);
      this._visualizer.explode(this._controller);
    }
    if (this._scene && this._camera) {
      this._renderer.render(this._scene, this._camera);
    }
    if (this._viewCube) this._viewCube.update();
  }
}

/**
 * Initializes GUI with 'Reset View' and 'Explode' functions.
 */
function initializeGui(container, cameraControls, controller, onControllerChange) {
  const gui = new GUI({ container });
  gui.closed = false;

  const initialCameraPosition = new THREE.Vector3();
  cameraControls.getPosition(initialCameraPosition);

  const initialCameraTarget = new THREE.Vector3();
  cameraControls.getTarget(initialCameraTarget);

  const obj = {
    'Reset View': () => {
      const enableTransition = false;
      cameraControls.reset(enableTransition);
      cameraControls.setPosition(
        initialCameraPosition.x,
        initialCameraPosition.y,
        initialCameraPosition.z,
      );
      cameraControls.setTarget(
        initialCameraTarget.x,
        initialCameraTarget.y,
        initialCameraTarget.z,
      );
      cameraControls.update();
      onControllerChange();
    },
  };
  gui.add(obj, 'Reset View');
  gui.add(controller, 'Explode', 0, 100, 1)
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

function parseObjText(objText) {
  const objLoader = new OBJLoader();
  return objLoader.parse(objText);
}

function createAppContainer(opacityDuration) {
  const container = window.document.createElement('div');
  container.style = 'opacity: 0;'
    + `transition: opacity ${opacityDuration}ms ease-in-out;`
    + 'position: relative';
  return container;
}

function getSortOverrideArray(assembly) {
  const sortOverrideArrayByAssembly = {
    RotorMold: [
      'Rotor_Mold_Surround',
      'Screws',
      'Rotor_Disk_Back',
      'Rotor_Magnets',
      'Rotor_ResinCast',
    ],
  };
  return sortOverrideArrayByAssembly[assembly]
    ? sortOverrideArrayByAssembly[assembly]
    : [];
}

export default OpenAfpmCadVisualization;
