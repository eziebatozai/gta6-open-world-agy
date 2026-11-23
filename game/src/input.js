// Keyboard and mouse input state manager with edge-triggered action helpers.

export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = window.innerWidth * 0.5;
    this.mouseY = window.innerHeight * 0.5;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.wheelDelta = 0;

    this._onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!this.keys.has(e.code)) {
        this.pressed.add(e.code);
      }
      this.keys.add(e.code);
    };

    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };

    this._onBlur = () => {
      this.keys.clear();
      this.pressed.clear();
      this.mouseDown = false;
    };

    this._onMouseMove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
    };

    this._onMouseDown = (e) => {
      if (e.button !== 0) return;
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
      this.mouseDown = true;
      this.mouseClicked = true;
    };

    this._onMouseUp = (e) => {
      if (e.button === 0) this.mouseDown = false;
    };

    this._onWheel = (e) => {
      this.wheelDelta += Math.sign(e.deltaY);
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('wheel', this._onWheel, { passive: true });
  }

  down(code) {
    return this.keys.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  anyDown(codes) {
    for (const c of codes) {
      if (this.keys.has(c)) return true;
    }
    return false;
  }

  anyPressed(codes) {
    for (const c of codes) {
      if (this.pressed.has(c)) return true;
    }
    return false;
  }

  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
    this.wheelDelta = 0;
  }
}
