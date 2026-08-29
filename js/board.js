'use strict';

var WORLD = 4000;
var OFFSET = 2000;
var NOTE_W = 200;
var NOTE_H = 150;
var PRIORITY_COLORS = {
  Low: ['#FFF3CD', '#FFE082'],
  Normal: ['#FFE082', '#FFB300'],
  High: ['#FF8F00', '#E65100']
};

var boardEl = document.getElementById('board');
var worldEl = document.getElementById('world');
var linkLayer = document.getElementById('link-layer');
var statusLabel = document.getElementById('status-label');
var debugHud = document.getElementById('debug-hud');
var debugMarker = document.getElementById('debug-marker');

var zoom = 1;
var pan = { x: 0, y: 0 };
var linkMode = false;
var linkSource = null;
var noteEls = {};
var lastMouse = null;
var lastAnchor = null;
var debugOn = true;

function applyTransform() {
  worldEl.style.transform = 'translate(' + pan.x + 'px, ' + pan.y + 'px) scale(' + zoom + ')';
  updateHud();
}

function viewToWorld(clientX, clientY) {
  var rect = boardEl.getBoundingClientRect();
  return {
    x: (clientX - rect.left - pan.x) / zoom - OFFSET,
    y: (clientY - rect.top - pan.y) / zoom - OFFSET
  };
}

function zoomAt(factor) {
  var sx = pan.x + OFFSET * zoom;
  var sy = pan.y + OFFSET * zoom;
  zoom = Math.max(0.05, Math.min(8, zoom * factor));
  pan.x = sx - OFFSET * zoom;
  pan.y = sy - OFFSET * zoom;
  lastAnchor = { x: 0, y: 0 };
  applyTransform();
  updateHud();
}

function updateHud() {
  if (!debugOn) return;
  var m = lastMouse || { x: 0, y: 0 };
  var w = viewToWorld(m.x, m.y);
  var rect = boardEl.getBoundingClientRect();
  var c = viewToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
  var lines = [
    'zoom=' + zoom,
    'pan=(' + pan.x.toFixed(1) + ', ' + pan.y.toFixed(1) + ')',
    'mouse=(' + Math.round(m.x) + ', ' + Math.round(m.y) + ')',
    'world=(' + w.x.toFixed(1) + ', ' + w.y.toFixed(1) + ')',
    'center=(' + c.x.toFixed(1) + ', ' + c.y.toFixed(1) + ')'
  ];
  if (lastAnchor) {
    lines.push('anchor=(' + lastAnchor.x.toFixed(1) + ', ' + lastAnchor.y.toFixed(1) + ')');
    lines.push('offset=(' + (w.x - lastAnchor.x).toFixed(1) + ', ' + (w.y - lastAnchor.y).toFixed(1) + ')');
    debugMarker.style.left = (lastAnchor.x + OFFSET) + 'px';
    debugMarker.style.top = (lastAnchor.y + OFFSET) + 'px';
  }
  debugHud.textContent = lines.join('\n');
}

function zoomIn() { zoomAt(1.15); }
function zoomOut() { zoomAt(1 / 1.15); }

function zoomReset() {
  zoom = 1;
  var rect = boardEl.getBoundingClientRect();
  pan.x = rect.width / 2;
  pan.y = rect.height / 2;
  lastAnchor = { x: 0, y: 0 };
  applyTransform();
  updateHud();
}

function fitRect(minX, minY, w, h) {
  var rect = boardEl.getBoundingClientRect();
  var vw = rect.width, vh = rect.height;
  var scale = Math.min((vw - 80) / w, (vh - 80) / h);
  scale = Math.max(0.05, Math.min(1.5, scale));
  zoom = scale;
  pan.x = (vw - w * scale) / 2 - (minX + OFFSET) * scale;
  pan.y = (vh - h * scale) / 2 - (minY + OFFSET) * scale;
  applyTransform();
}

function fitContent() {
  var tasks = model.getAll();
  if (!tasks.length) { zoomReset(); return; }
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  tasks.forEach(function (t) {
    minX = Math.min(minX, t.x);
    minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x + NOTE_W);
    maxY = Math.max(maxY, t.y + NOTE_H);
  });
  fitRect(minX, minY, maxX - minX, maxY - minY);
}

function fitScene() { fitRect(-OFFSET, -OFFSET, WORLD, WORLD); }

function getNoteColors(task) {
  var base, border;
  if (task.color) {
    base = task.color;
    border = darken(base, 60);
  } else if (PRIORITY_COLORS[task.priority]) {
    base = PRIORITY_COLORS[task.priority][0];
    border = PRIORITY_COLORS[task.priority][1];
  } else {
    base = PRIORITY_COLORS.Normal[0];
    border = PRIORITY_COLORS.Normal[1];
  }
  return { base: base, border: border };
}

function createNoteBase(task, colors) {
  var el = document.createElement('div');
  el.className = 'note ' + (task.type || 'Text').toLowerCase();
  el.style.background = task.completed ? hexToRgba(colors.base, 0.63) : colors.base;
  el.style.border = '1.5px solid ' + (task.completed ? hexToRgba(colors.border, 0.63) : colors.border);
  if (task.completed) el.classList.add('completed');

  var pin = document.createElement('div');
  pin.className = 'pin';
  el.appendChild(pin);

  var cb = document.createElement('div');
  cb.className = 'checkbox';
  cb.textContent = task.completed ? '\u2713' : '';
  cb.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (!linkMode) toggleCompleted(task.id);
  });
  el.appendChild(cb);

  var title = document.createElement('div');
  title.className = 'title';
  title.textContent = task.title;
  el.appendChild(title);

  var tag = document.createElement('div');
  tag.className = 'priority-tag';
  tag.textContent = '[' + task.priority + ']';
  el.appendChild(tag);

  if (task.completed) {
    var done = document.createElement('div');
    done.className = 'done-overlay';
    var line = document.createElement('div');
    line.className = 'line';
    var txt = document.createElement('span');
    txt.textContent = 'DONE';
    done.appendChild(line);
    done.appendChild(txt);
    el.appendChild(done);
  }

  return el;
}

function renderTextContent(task, el) {
  if (task.content) {
    var contentDiv = document.createElement('div');
    contentDiv.className = 'note-body';
    contentDiv.textContent = task.content;
    el.appendChild(contentDiv);
  }
}

function renderListContent(task, el) {
  var ul = document.createElement('ul');
  ul.className = 'note-list';
  (task.listItems || [{ text: '', completed: false }]).forEach(function (item, idx) {
    ul.appendChild(createListItem(task, item, idx));
  });
  el.appendChild(ul);
}

function createListItem(task, item, idx) {
  var li = document.createElement('li');
  li.dataset.idx = idx;

  var cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = !!item.completed;
  cb.addEventListener('change', function () {
    var currentIdx = parseInt(li.dataset.idx, 10);
    task.listItems[currentIdx].completed = cb.checked;
    model.updateListItems(task.id, task.listItems);
    updateStatus();
  });
  li.appendChild(cb);

  var span = document.createElement('span');
  span.textContent = item.text;
  span.contentEditable = true;
  span.addEventListener('blur', function () {
    var currentIdx = parseInt(li.dataset.idx, 10);
    task.listItems[currentIdx].text = span.textContent;
    model.updateListItems(task.id, task.listItems);
  });
  span.addEventListener('keydown', function (e) {
    var currentIdx = parseInt(li.dataset.idx, 10);
    if (e.key === 'Enter') {
      e.preventDefault();
      span.blur();
      var newItem = { text: '', completed: false };
      task.listItems.splice(currentIdx + 1, 0, newItem);
      var newLi = createListItem(task, newItem, currentIdx + 1);
      var ul = li.parentNode;
      ul.insertBefore(newLi, li.nextSibling);
      updateIndices(ul);
      model.updateListItems(task.id, task.listItems);
    } else if (e.key === 'Backspace' && !span.textContent && task.listItems.length > 1) {
      e.preventDefault();
      task.listItems.splice(currentIdx, 1);
      var ul = li.parentNode;
      li.remove();
      updateIndices(ul);
      model.updateListItems(task.id, task.listItems);
    }
  });
  li.appendChild(span);

  var del = document.createElement('button');
  del.className = 'list-del';
  del.textContent = '\u2715';
  del.title = 'Delete item';
  del.addEventListener('click', function (e) {
    e.stopPropagation();
    var currentIdx = parseInt(li.dataset.idx, 10);
    task.listItems.splice(currentIdx, 1);
    var ul = li.parentNode;
    li.remove();
    updateIndices(ul);
    model.updateListItems(task.id, task.listItems);
  });
  li.appendChild(del);

  return li;
}

function updateIndices(ul) {
  var items = ul.querySelectorAll('li');
  items.forEach(function (li, i) {
    li.dataset.idx = i;
  });
}

function renderImageContent(task, el) {
  var wrapper = document.createElement('div');
  wrapper.className = 'note-image-wrapper';
  if (task.imageData) {
    var img = document.createElement('img');
    img.className = 'note-image';
    img.src = task.imageData;
    img.alt = task.caption || 'Image note';
    img.addEventListener('click', function (e) {
      e.stopPropagation();
      openImageModal(task.imageData, task.caption || '');
    });
    wrapper.appendChild(img);
  } else {
    var placeholder = document.createElement('div');
    placeholder.className = 'note-image-placeholder';
    placeholder.textContent = '\uD83D\uDCC7 No image';
    wrapper.appendChild(placeholder);
  }
  if (task.caption) {
    var cap = document.createElement('div');
    cap.className = 'note-caption';
    cap.textContent = task.caption;
    wrapper.appendChild(cap);
  }
  el.appendChild(wrapper);
}

function renderCodeContent(task, el) {
  var pre = document.createElement('pre');
  pre.className = 'note-code';
  var code = document.createElement('code');
  code.textContent = task.codeContent || '';
  code.spellcheck = false;
  pre.appendChild(code);
  el.appendChild(pre);
  var copyBtn = document.createElement('button');
  copyBtn.className = 'code-copy';
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    navigator.clipboard.writeText(task.codeContent || '');
    copyBtn.textContent = 'Copied!';
    setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1500);
  });
  el.appendChild(copyBtn);
}

function renderSketchContent(task, el) {
  var canvas = document.createElement('canvas');
  canvas.className = 'note-sketch';
  canvas.width = NOTE_W - 20;
  canvas.height = NOTE_H - 60;
  if (task.sketchData) {
    var ctx = canvas.getContext('2d');
    var img = new Image();
    img.onload = function () { ctx.drawImage(img, 0, 0); };
    img.src = task.sketchData;
  }
  el.appendChild(canvas);
  var toolbar = document.createElement('div');
  toolbar.className = 'sketch-toolbar';
  var colors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FF00FF', '#FFFF00'];
  colors.forEach(function (c) {
    var btn = document.createElement('button');
    btn.className = 'sketch-color' + (c === '#000000' ? ' active' : '');
    btn.style.background = c;
    btn.title = c;
    btn.addEventListener('click', function () {
      toolbar.querySelectorAll('.sketch-color').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      canvas.dataset.strokeColor = c;
    });
    toolbar.appendChild(btn);
  });
  var eraser = document.createElement('button');
  eraser.className = 'sketch-eraser';
  eraser.textContent = '\u232B';
  eraser.title = 'Eraser';
  eraser.addEventListener('click', function () {
    toolbar.querySelectorAll('.sketch-color').forEach(function (b) { b.classList.remove('active'); });
    eraser.classList.add('active');
    canvas.dataset.strokeColor = 'eraser';
  });
  toolbar.appendChild(eraser);
  var clear = document.createElement('button');
  clear.className = 'sketch-clear';
  clear.textContent = '\uD83D\uDDD1\uFE0F';
  clear.title = 'Clear';
  clear.addEventListener('click', function () {
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    model.updateSketchData(task.id, null);
  });
  toolbar.appendChild(clear);
  el.appendChild(toolbar);

  var drawing = false;
  var lastPt = null;
  canvas.addEventListener('pointerdown', function (e) {
    e.stopPropagation();
    drawing = true;
    var rect = canvas.getBoundingClientRect();
    lastPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  });
  window.addEventListener('pointermove', function (e) {
    if (!drawing) return;
    var rect = canvas.getBoundingClientRect();
    var pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    var ctx = canvas.getContext('2d');
    var color = canvas.dataset.strokeColor || '#000000';
    if (color === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = 20;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
    }
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPt.x, lastPt.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPt = pt;
  });
  window.addEventListener('pointerup', function () {
    if (drawing) {
      drawing = false;
      model.updateSketchData(task.id, canvas.toDataURL());
    }
  });
}

function refreshNoteEl(id) {
  var el = noteEls[id];
  if (!el) return;
  var t = model.tasks[id];
  if (!t) return;
  var colors = getNoteColors(t);
  el.style.background = t.completed ? hexToRgba(colors.base, 0.63) : colors.base;
  el.style.border = '1.5px solid ' + (t.completed ? hexToRgba(colors.border, 0.63) : colors.border);
  el.classList.toggle('completed', !!t.completed);
  el.className = 'note ' + (t.type || 'Text').toLowerCase();

  var content = el.querySelector('.note-content');
  if (content) content.remove();

  var contentDiv = document.createElement('div');
  contentDiv.className = 'note-content';
  el.insertBefore(contentDiv, el.querySelector('.priority-tag'));

  switch (t.type) {
    case 'List': renderListContent(t, contentDiv); break;
    case 'Image': renderImageContent(t, contentDiv); break;
    case 'Code': renderCodeContent(t, contentDiv); break;
    case 'Sketch': renderSketchContent(t, contentDiv); break;
    default: renderTextContent(t, contentDiv);
  }

  var tag = el.querySelector('.priority-tag');
  if (tag) tag.textContent = '[' + t.priority + ']';
  var cb = el.querySelector('.checkbox');
  if (cb) cb.textContent = t.completed ? '\u2713' : '';

  var done = el.querySelector('.done-overlay');
  if (t.completed && !done) {
    var d = document.createElement('div');
    d.className = 'done-overlay';
    var line = document.createElement('div');
    line.className = 'line';
    var txt = document.createElement('span');
    txt.textContent = 'DONE';
    d.appendChild(line);
    d.appendChild(txt);
    el.appendChild(d);
  } else if (!t.completed && done) {
    done.remove();
  }
}

function setNotePos(id) {
  var el = noteEls[id];
  if (!el) return;
  var t = model.tasks[id];
  el.style.left = (t.x + OFFSET) + 'px';
  el.style.top = (t.y + OFFSET) + 'px';
}

function updateStatus() {
  var remaining = model.getRemaining();
  var total = model.getAll().length;
  var links = model.getLinks().length;
  statusLabel.textContent = 'Remaining: ' + remaining + '  |  Total: ' + total + '  |  Links: ' + links;
}

function redrawLinks() {
  while (linkLayer.firstChild) linkLayer.removeChild(linkLayer.firstChild);
  var ns = 'http://www.w3.org/2000/svg';
  model.getLinks().forEach(function (pair) {
    var t1 = model.tasks[pair[0]];
    var t2 = model.tasks[pair[1]];
    if (!t1 || !t2) return;
    var p1 = { x: t1.x + 100 + OFFSET, y: t1.y + 4 + OFFSET };
    var p2 = { x: t2.x + 100 + OFFSET, y: t2.y + 4 + OFFSET };
    var dx = p2.x - p1.x;
    var c1x = p1.x + dx * 0.4, c2x = p2.x - dx * 0.4;
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M ' + p1.x + ' ' + p1.y + ' C ' + c1x + ' ' + p1.y + ', ' + c2x + ' ' + p2.y + ', ' + p2.x + ' ' + p2.y);
    linkLayer.appendChild(path);
  });
}

function toggleCompleted(id) {
  model.toggleCompleted(id);
  refreshNoteEl(id);
  updateStatus();
}

function onNoteClicked(id) {
  if (!linkMode) return;
  if (linkSource === null) {
    linkSource = id;
    if (noteEls[id]) noteEls[id].classList.add('link-source');
    setLinkHint(true);
  } else if (linkSource === id) {
    if (noteEls[id]) noteEls[id].classList.remove('link-source');
    linkSource = null;
    setLinkHint(true);
  } else {
    if (model.hasLink(linkSource, id)) model.removeLink(linkSource, id);
    else model.addLink(linkSource, id);
    [linkSource, id].forEach(function (tid) {
      if (noteEls[tid]) noteEls[tid].classList.remove('link-source');
    });
    linkSource = null;
    setLinkHint(true);
    redrawLinks();
    updateStatus();
  }
}

function setLinkMode(active) {
  linkMode = active;
  linkSource = null;
  boardEl.classList.toggle('linking', active);
  for (var id in noteEls) noteEls[id].classList.remove('link-source');
  setLinkHint(active);
}

function setLinkHint(active) {
  if (!active) { updateStatus(); return; }
  if (linkSource) {
    var t = model.tasks[linkSource];
    var name = t ? t.title : '?';
    if (name.length > 30) name = name.substr(0, 30) + '...';
    statusLabel.textContent = '\uD83D\uDD17 Linking: ' + name + '  \u2192  click another note';
  } else {
    statusLabel.textContent = '\uD83D\uDD17 Link mode  \u2014  click a note to start';
  }
}

function notePointerDown(e, id) {
  if (linkMode) {
    e.preventDefault();
    onNoteClicked(id);
    return;
  }
  if (e.button !== 0) return;
  if (e.target.closest('.checkbox') || e.target.closest('.note-list input') || e.target.closest('.note-sketch') || e.target.closest('.sketch-toolbar') || e.target.closest('.code-copy')) return;
  e.preventDefault();
  e.stopPropagation();
  var t = model.tasks[id];
  if (!t) return;
  var startClientX = e.clientX;
  var startClientY = e.clientY;
  var startX = t.x;
  var startY = t.y;
  var moved = false;
  var el = noteEls[id];

  function onMove(ev) {
    var nx = startX + (ev.clientX - startClientX) / zoom;
    var ny = startY + (ev.clientY - startClientY) / zoom;
    if (!moved && Math.abs(ev.clientX - startClientX) + Math.abs(ev.clientY - startClientY) > 2) moved = true;
    model.updatePosition(id, nx, ny);
    el.style.left = (nx + OFFSET) + 'px';
    el.style.top = (ny + OFFSET) + 'px';
    redrawLinks();
  }

  function onUp() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  }

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function addNoteEl(task) {
  var colors = getNoteColors(task);
  var el = createNoteBase(task, colors);

  var contentDiv = document.createElement('div');
  contentDiv.className = 'note-content';
  el.insertBefore(contentDiv, el.querySelector('.priority-tag'));

  switch (task.type) {
    case 'List': renderListContent(task, contentDiv); break;
    case 'Image': renderImageContent(task, contentDiv); break;
    case 'Code': renderCodeContent(task, contentDiv); break;
    case 'Sketch': renderSketchContent(task, contentDiv); break;
    default: renderTextContent(task, contentDiv);
  }

  el.addEventListener('pointerdown', function (e) { notePointerDown(e, task.id); });
  el.addEventListener('dblclick', function (e) {
    if (!linkMode && !e.target.closest('.checkbox') && !e.target.closest('.note-list input') && !e.target.closest('.note-sketch') && !e.target.closest('.sketch-toolbar') && !e.target.closest('.code-copy')) toggleCompleted(task.id);
  });
  el.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    showNoteContextMenu(e.clientX, e.clientY, task.id);
  });

  worldEl.appendChild(el);
  noteEls[task.id] = el;
  setNotePos(task.id);
}

function removeNoteEl(id) {
  var el = noteEls[id];
  if (el) el.remove();
  delete noteEls[id];
  redrawLinks();
}

function renderAll() {
  for (var id in noteEls) {
    noteEls[id].remove();
    delete noteEls[id];
  }
  model.getAll().forEach(addNoteEl);
  redrawLinks();
}

function addTaskFlow(title, priority, color, type, typeData) {
  var task = model.addTask(title, priority,
    50 + Math.random() * 650,
    50 + Math.random() * 350,
    color, type, typeData);
  addNoteEl(task);
  updateStatus();
}

function applyFilter(text) {
  var visible = 0;
  for (var id in noteEls) {
    var t = model.tasks[id];
    var show;
    if (text === 'All') show = true;
    else if (text === 'Incomplete') show = !t.completed;
    else if (text === 'Completed') show = t.completed;
    else if (text === 'Low Priority') show = t.priority === 'Low';
    else if (text === 'High Priority') show = t.priority === 'High';
    else show = true;
    noteEls[id].style.display = show ? '' : 'none';
    if (show) visible++;
  }
  statusLabel.textContent = 'Showing: ' + visible + ' notes';
}

function openImageModal(src, caption) {
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '1000';
  var img = document.createElement('img');
  img.src = src;
  img.style.maxWidth = '90vw';
  img.style.maxHeight = '90vh';
  img.style.borderRadius = '4px';
  img.style.boxShadow = '0 8px 30px rgba(0,0,0,0.6)';
  overlay.appendChild(img);
  if (caption) {
    var cap = document.createElement('div');
    cap.textContent = caption;
    cap.style.color = '#F5E6C8';
    cap.style.marginTop = '10px';
    cap.style.textAlign = 'center';
    overlay.appendChild(cap);
  }
  overlay.addEventListener('click', function () { overlay.remove(); });
  document.body.appendChild(overlay);
}