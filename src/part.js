/**
 * Represents a part in a larger assembly.
 */
export default class Part {
  constructor(mesh, wire = null) {
    this.mesh = mesh;
    this.wire = wire;
  }

  set visible(value) {
    this.mesh.visible = value;
    if (this.wire) {
      this.wire.visible = value;
    }
  }

  get visible() {
    return this.mesh.visible;
  }

  get x() {
    return this.mesh.position.x;
  }

  get y() {
    return this.mesh.position.y;
  }

  get z() {
    return this.mesh.position.z;
  }

  set x(value) {
    this._setPosition('x', value);
  }

  set y(value) {
    this._setPosition('y', value);
  }

  set z(value) {
    this._setPosition('z', value);
  }

  _setPosition(axis, value) {
    this.mesh.position[axis] = value;
    if (this.wire) {
      this.wire.position[axis] = value;
    }
  }
}
