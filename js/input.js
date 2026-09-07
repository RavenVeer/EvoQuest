/* Keyboard + mouse input management with just-pressed detection */
const Input = (() => {
  const keys = {};
  const pressedQueue = [];

  const mouse = {
    x: 0,
    y: 0,
    down: false,
    // set true on mousedown, consumed by Game.endFrame
    clicked: false
  };

  function keyDown(e) {
    if (!keys[e.code]) {
      // newly pressed this frame
      pressedQueue.push(e.code);
    }
    keys[e.code] = true;
    if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyD') {
      e.preventDefault();
    }
  }

  function keyUp(e) {
    keys[e.code] = false;
  }

  function mouseMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }

  function mouseDown(e) {
    if (e.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  }

  function mouseUp(e) {
    if (e.button === 0) mouse.down = false;
  }

  function contextMenu(e) { e.preventDefault(); }

  // end of frame: consume just-pressed
  function endFrame() {
    pressedQueue.length = 0;
    mouse.clicked = false;
  }

  function anyKey() { return Object.values(keys).some(v => v); }

  function init() {
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('mousemove', mouseMove);
    window.addEventListener('mousedown', mouseDown);
    window.addEventListener('mouseup', mouseUp);
    window.addEventListener('contextmenu', contextMenu);
  }

  function destroy() {
    window.removeEventListener('keydown', keyDown);
    window.removeEventListener('keyup', keyUp);
    window.removeEventListener('mousemove', mouseMove);
    window.removeEventListener('mousedown', mouseDown);
    window.removeEventListener('mouseup', mouseUp);
    window.removeEventListener('contextmenu', contextMenu);
  }

  function isDown(code) { return !!keys[code]; }

  // returns true only in the frame the key was pressed
  function wasPressed(code) { return pressedQueue.includes(code); }

  // true if mouse was clicked this frame
  function wasClicked() { return mouse.clicked; }

  return { init, destroy, isDown, wasPressed, wasClicked, anyKey, mouse, endFrame };
})();
