/**
 * Represents a part in a larger assembly.
 */
export default class Part {
  constructor(mesh, lineSegments) {
    this.mesh = mesh;
    this.lineSegments = lineSegments;
  }

  set visible(value) {
    this.mesh.visible = value;
    this.lineSegments.visible = value;
  }

  get visible() {
    return this.mesh.visible && this.lineSegments.visible;
  }

  set x(value) {
    this.mesh.position.x = value;
    this.lineSegments.position.x = value;
  }

  set y(value) {
    this.mesh.position.y = value;
    this.lineSegments.position.y = value;
  }

  set z(value) {
    this.mesh.position.z = value;
    this.lineSegments.position.z = value;
  }
}
