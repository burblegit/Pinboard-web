'use strict';

var menubar = document.getElementById('menubar');
var filterSelect = document.getElementById('filter-select');

var menuData = {
  file: [
    { label: '\uD83D\uDCC4 New Board', kbd: 'Ctrl+N', action: newBoardFlow },
    { label: '\uD83D\uDCC2 Load...', kbd: 'Ctrl+O', action: loadBoard },
    'sep',
    { label: '\uD83D\uDCBE Save As...', kbd: 'Ctrl+S', action: saveAsBoard },
    'sep',
    { label: '\uD83D\uDEAA Exit', kbd: null, action: exitApp }
  ],
  note: [
    { label: '\uD83D\uDCCC New Note', kbd: 'Ctrl+Shift+N', action: addNoteFlow }
  ],
  view: [
    { label: '\uD83D\uDD04 Reset View', kbd: 'Ctrl+R', action: resetView }
  ]
};

function buildMenus() {
  var keys = Object.keys(menuData);
  keys.forEach(function (key) {
    var menu = document.createElement('div');
    menu.className = 'menu';
    var btn = document.createElement('button');
    btn.className = 'menu-btn';
    btn.textContent = key.charAt(0).toUpperCase() + key.slice(1);
    var dropdown = document.createElement('div');
    dropdown.className = 'dropdown';
    menuData[key].forEach(function (item) {
      if (item === 'sep') {
        var s = document.createElement('div');
        s.className = 'dropdown-sep';
        dropdown.appendChild(s);
        return;
      }
      var it = document.createElement('div');
      it.className = 'dropdown-item';
      var lbl = document.createElement('span');
      lbl.textContent = item.label;
      it.appendChild(lbl);
      if (item.kbd) {
        var kbd = document.createElement('span');
        kbd.className = 'kbd';
        kbd.textContent = item.kbd;
        it.appendChild(kbd);
      }
      it.addEventListener('click', function () {
        closeMenus();
        item.action();
      });
      dropdown.appendChild(it);
    });
    menu.appendChild(btn);
    menu.appendChild(dropdown);
    menubar.appendChild(menu);
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = menu.classList.contains('open');
      closeMenus();
      if (!open) menu.classList.add('open');
    });
  });
}

function closeMenus() {
  menubar.querySelectorAll('.menu.open').forEach(function (m) { m.classList.remove('open'); });
}

document.addEventListener('click', function () {
  closeMenus();
  hideContextMenu();
});

boardEl.addEventListener('pointerdown', function (e) {
  if (linkMode) return;
  if (e.button !== 0) return;
  if (e.target !== boardEl && !e.target.closest('#world')) return;
  e.preventDefault();
  var rect = boardEl.getBoundingClientRect();
  var startPX = pan.x, startPY = pan.y;
  var startX = e.clientX, startY = e.clientY;
  var moved = false;
  boardEl.classList.add('panning');

  function onMove(ev) {
    pan.x = startPX + (ev.clientX - startX);
    pan.y = startPY + (ev.clientY - startY);
    if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 2) moved = true;
    applyTransform();
  }

  function onUp() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    boardEl.classList.remove('panning');
  }

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
});

window.addEventListener('wheel', function (e) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    return;
  }
  if (!(e.target.closest && e.target.closest('.mg-list'))) e.preventDefault();
}, { passive: false });

document.addEventListener('wheel', function (e) {
  if (e.ctrlKey || e.metaKey) e.preventDefault();
}, { capture: true, passive: false });

document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

boardEl.addEventListener('contextmenu', function (e) {
  if (!e.target.closest('.note')) e.preventDefault();
});

window.addEventListener('pointermove', function (e) {
  lastMouse = { x: e.clientX, y: e.clientY };
  updateHud();
});

document.getElementById('btn-new-note').addEventListener('click', addNoteFlow);
document.getElementById('btn-link').addEventListener('click', function () {
  setLinkMode(!linkMode);
  this.classList.toggle('checked', linkMode);
});
document.getElementById('btn-zoom-in').addEventListener('click', zoomIn);
document.getElementById('btn-zoom-out').addEventListener('click', zoomOut);
document.getElementById('btn-fit').addEventListener('click', zoomReset);
document.getElementById('btn-rgb').addEventListener('click', function () {
  document.body.classList.toggle('rgb-mode');
  this.classList.toggle('checked', document.body.classList.contains('rgb-mode'));
});

document.getElementById('btn-debug').addEventListener('click', function () {
  debugOn = !debugOn;
  document.body.classList.toggle('debug-mode', debugOn);
  this.classList.toggle('checked', debugOn);
  if (debugOn) updateHud();
  else debugHud.textContent = '';
});

['btn-new-note', 'btn-link', 'btn-zoom-in', 'btn-zoom-out', 'btn-fit', 'btn-rgb', 'btn-debug'].forEach(function (id) {
  document.getElementById(id).addEventListener('mousedown', function (e) { e.preventDefault(); });
});

filterSelect.addEventListener('change', function () {
  applyFilter(this.value);
});

fileInput.addEventListener('change', function () {
  var file = this.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var data = JSON.parse(reader.result);
      if (!model.loadFromJSON(data)) throw new Error('bad');
      zoomReset();
      setLinkMode(false);
      renderAll();
      filterSelect.value = 'All';
      updateStatus();
    } catch (err) {
      alertDialog('Load Failed', 'Could not load the selected file.');
    }
  };
  reader.readAsText(file);
});

window.addEventListener('keydown', function (e) {
  var typing = /INPUT|SELECT|TEXTAREA/.test(e.target.tagName);
  if (e.key === 'Escape') {
    if (modalRoot.childElementCount) {
      closeTopDialog();
      return;
    }
    hideContextMenu();
    if (linkMode) {
      setLinkMode(false);
      document.getElementById('btn-link').classList.remove('checked');
    }
    return;
  }
  if (e.ctrlKey || e.metaKey) {
    var k = e.key.toLowerCase();
    if (k === '=' || k === '+') {
      e.preventDefault();
      zoomIn();
      return;
    }
    if (k === '-' || k === '_') {
      e.preventDefault();
      zoomOut();
      return;
    }
    if (k === '0') {
      e.preventDefault();
      zoomReset();
      return;
    }
  }
  if (typing) return;
  if (e.key === 'l' || e.key === 'L') {
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      setLinkMode(!linkMode);
      document.getElementById('btn-link').classList.toggle('checked', linkMode);
    }
    return;
  }
  if (e.key === 'd' || e.key === 'D') {
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      document.getElementById('btn-debug').click();
    }
    return;
  }
  if (e.ctrlKey || e.metaKey) {
    var k = e.key.toLowerCase();
    if (k === 'n') {
      e.preventDefault();
      if (e.shiftKey) addNoteFlow();
      else newBoardFlow();
    } else if (k === 's') {
      e.preventDefault();
      saveAsBoard();
    } else if (k === 'o') {
      e.preventDefault();
      loadBoard();
    } else if (k === 'r') {
      e.preventDefault();
      resetView();
    }
  }
});

buildMenus();
document.getElementById('btn-debug').classList.add('checked');
document.body.classList.add('debug-mode');
lastMouse = { x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) };
renderAll();
fitContent();
updateStatus();
updateHud();