/**
 * Defines the interface of a Visualizer class.
 *
 * Each Visualizer must have a no-arg constructor.
 *
 * Note, a few functions are optional (i.e. nullable)
 * denoted by a question mark in front of "function".
 *
 * @typedef {Object} Visualizer
 * @property {function} createCamera
 * @property {function} createCameraControls
 * @property {function} getInitialController
 * @property {function} getViewCubeFaces
 * @property {function} createLights
 * @property {function} setup
 * @property {?function} getGroupConfigurations
 * @property {?function} handleRender
 * @property {function} explode
 * @property {function} getMaterial
 * @property {?function} setupGui
 * @property {function} getPartNamesByVisibilityLabel
 *
 * The two implementing subclasses are
 * (1) WindTurbineVisualizer and (2) ToolVisualizer.
 */
