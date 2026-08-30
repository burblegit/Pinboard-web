'use strict';

var NOTE_TYPES = ['Text', 'List', 'Image', 'Code', 'Sketch'];

function darken(hex, amount) {
  amount = amount || 60;
  var c = hexToRgb(hex);
  return '#' + Math.max(0, c[0] - amount).toString(16).padStart(2, '0') +
              Math.max(0, c[1] - amount).toString(16).padStart(2, '0') +
              Math.max(0, c[2] - amount).toString(16).padStart(2, '0');
}

function hexToRgb(hex) {
  var h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
}

function hexToRgba(hex, a) {
  var c = hexToRgb(hex);
  return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
}

function esc(s) {
  return String(s).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
}

var STORAGE_KEY = 'pinboardNotes.data';

function debounceSave() {
  clearTimeout(model._saveTimer);
  model._saveTimer = setTimeout(function(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(model.toJSON())); } catch(e){} }, 300);
}

function BoardModel() {
  this.tasks = {};
  this.links = new Set();
  this.custom_priorities = {};
}

BoardModel.prototype.addTask = function (title, priority, x, y, color, type, typeData, dueDate) {
  var task = {
    id: Math.random().toString(16).substr(2, 8),
    title: title,
    priority: priority || 'Normal',
    completed: false,
    x: x === undefined ? 50 : x,
    y: y === undefined ? 50 : y,
    color: color || null,
    type: type || 'Text',
    created_at: new Date().toISOString(),
    dueDate: dueDate || null
  };
  if (type === 'List') {
    task.listItems = (typeData && typeData.items) || [{ text: '', completed: false }];
  } else if (type === 'Image') {
    task.imageData = typeData && typeData.imageData ? typeData.imageData : null;
    task.caption = typeData && typeData.caption ? typeData.caption : '';
  } else if (type === 'Code') {
    task.codeContent = typeData && typeData.codeContent ? typeData.codeContent : '';
    task.language = typeData && typeData.language ? typeData.language : 'plaintext';
  } else if (type === 'Sketch') {
    task.sketchData = typeData && typeData.sketchData ? typeData.sketchData : null;
  } else {
    task.content = typeData && typeData.textContent ? typeData.textContent : '';
  }
  this.tasks[task.id] = task;
  debounceSave();
  return task;
};

BoardModel.prototype.removeTask = function (id) {
  var task = this.tasks[id];
  if (task) {
    delete this.tasks[id];
    var self = this;
    this.links.forEach(function (link) {
      var parts = link.split('|');
      if (parts[0] === id || parts[1] === id) self.links.delete(link);
    });
    debounceSave();
  }
  return task;
};

BoardModel.prototype.toggleCompleted = function (id) {
  if (this.tasks[id]) {
    this.tasks[id].completed = !this.tasks[id].completed;
    debounceSave();
    return true;
  }
  return false;
};

BoardModel.prototype.updatePosition = function (id, x, y) {
  if (this.tasks[id]) {
    this.tasks[id].x = x;
    this.tasks[id].y = y;
    debounceSave();
  }
};

BoardModel.prototype.updateListItems = function (id, items) {
  if (this.tasks[id] && this.tasks[id].type === 'List') {
    this.tasks[id].listItems = items;
    debounceSave();
    return true;
  }
  return false;
};

BoardModel.prototype.updateImageData = function (id, imageData, caption) {
  if (this.tasks[id] && this.tasks[id].type === 'Image') {
    this.tasks[id].imageData = imageData;
    if (caption !== undefined) this.tasks[id].caption = caption;
    debounceSave();
    return true;
  }
  return false;
};

BoardModel.prototype.updateCodeContent = function (id, codeContent, language) {
  if (this.tasks[id] && this.tasks[id].type === 'Code') {
    this.tasks[id].codeContent = codeContent;
    if (language !== undefined) this.tasks[id].language = language;
    debounceSave();
    return true;
  }
  return false;
};

BoardModel.prototype.updateSketchData = function (id, sketchData) {
  if (this.tasks[id] && this.tasks[id].type === 'Sketch') {
    this.tasks[id].sketchData = sketchData;
    debounceSave();
    return true;
  }
  return false;
};

BoardModel.prototype.updateContent = function (id, content) {
  if (this.tasks[id] && this.tasks[id].type === 'Text') {
    this.tasks[id].content = content;
    debounceSave();
    return true;
  }
  return false;
};

BoardModel.prototype.updateDueDate = function (id, dueDate) {
  if (this.tasks[id]) {
    this.tasks[id].dueDate = dueDate;
    debounceSave();
    return true;
  }
  return false;
};



BoardModel.prototype.changeType = function (id, newType, typeData) {
  var task = this.tasks[id];
  if (!task) return false;
  task.type = newType;
  if (newType === 'List') {
    task.listItems = (typeData && typeData.items) || [{ text: '', completed: false }];
  } else if (newType === 'Image') {
    task.imageData = typeData && typeData.imageData ? typeData.imageData : null;
    task.caption = typeData && typeData.caption ? typeData.caption : '';
  } else if (newType === 'Code') {
    task.codeContent = typeData && typeData.codeContent ? typeData.codeContent : '';
    task.language = typeData && typeData.language ? typeData.language : 'plaintext';
  } else if (newType === 'Sketch') {
    task.sketchData = typeData && typeData.sketchData ? typeData.sketchData : null;
  } else {
    delete task.listItems;
    delete task.imageData;
    delete task.caption;
    delete task.codeContent;
    delete task.language;
    delete task.sketchData;
    task.content = typeData && typeData.textContent ? typeData.textContent : '';
  }
  return true;
};

BoardModel.prototype.linkKey = function (id1, id2) {
  return id1 < id2 ? id1 + '|' + id2 : id2 + '|' + id1;
};

BoardModel.prototype.addLink = function (id1, id2) {
  if (id1 !== id2 && this.tasks[id1] && this.tasks[id2]) {
    this.links.add(this.linkKey(id1, id2));
    debounceSave();
    return true;
  }
  return false;
};

BoardModel.prototype.removeLink = function (id1, id2) {
  var ok = this.links.delete(this.linkKey(id1, id2));
  if (ok) debounceSave();
  return ok;
};

BoardModel.prototype.hasLink = function (id1, id2) {
  return this.links.has(this.linkKey(id1, id2));
};

BoardModel.prototype.getLinks = function () {
  var out = [];
  this.links.forEach(function (link) { out.push(link.split('|')); });
  return out;
};

BoardModel.prototype.getRemaining = function () {
  var n = 0;
  for (var id in this.tasks) if (!this.tasks[id].completed) n++;
  return n;
};

BoardModel.prototype.clear = function () {
  this.tasks = {};
  this.links.clear();
  debounceSave();
};

BoardModel.prototype.getAll = function () {
  var out = [];
  for (var id in this.tasks) out.push(this.tasks[id]);
  return out;
};

BoardModel.prototype.getAllPriorities = function () {
  return ['Low', 'Normal', 'High'].concat(Object.keys(this.custom_priorities));
};

BoardModel.prototype.addCustomPriority = function (name, color) {
  this.custom_priorities[name] = color;
  debounceSave();
};

BoardModel.prototype.removeCustomPriority = function (name) {
  delete this.custom_priorities[name];
  debounceSave();
};

BoardModel.prototype.getTaskIdsByPriority = function (name) {
  var out = [];
  for (var id in this.tasks) if (this.tasks[id].priority === name) out.push(id);
  return out;
};

BoardModel.prototype.removeTasksByPriority = function (name) {
  var ids = this.getTaskIdsByPriority(name);
  for (var i = 0; i < ids.length; i++) this.removeTask(ids[i]);
  return ids;
};

BoardModel.prototype.toJSON = function () {
  var tasks = [];
  for (var id in this.tasks) {
    var t = this.tasks[id];
    var d = {
      id: t.id, title: t.title, priority: t.priority, completed: t.completed,
      x: t.x, y: t.y, type: t.type, created_at: t.created_at
    };
    if (t.color) d.color = t.color;
    if (t.dueDate) d.dueDate = t.dueDate;
    if (t.type === 'List' && t.listItems) d.listItems = t.listItems;
    if (t.type === 'Image') {
      if (t.imageData) d.imageData = t.imageData;
      if (t.caption) d.caption = t.caption;
    }
    if (t.type === 'Code') {
      if (t.codeContent) d.codeContent = t.codeContent;
      if (t.language) d.language = t.language;
    }
    if (t.type === 'Sketch' && t.sketchData) d.sketchData = t.sketchData;
    if (t.type === 'Text' && t.content) d.content = t.content;
    tasks.push(d);
  }
  var links = [];
  this.links.forEach(function (link) { links.push(link.split('|')); });
  return { tasks: tasks, links: links, custom_priorities: this.custom_priorities };
};

BoardModel.prototype.loadFromJSON = function (data) {
  this.tasks = {};
  this.links = new Set();
  this.custom_priorities = {};
  if (!data) return false;
(data.tasks || []).forEach(function (t) {
      if (!t || !t.id) return;
      var task = {
        id: t.id,
        title: t.title || '',
        priority: t.priority || 'Normal',
        completed: !!t.completed,
        x: typeof t.x === 'number' ? t.x : 50,
        y: typeof t.y === 'number' ? t.y : 50,
        color: t.color || null,
        type: t.type || 'Text',
        created_at: t.created_at || new Date().toISOString(),
        dueDate: t.dueDate || null
      };
    if (t.type === 'List' && Array.isArray(t.listItems)) {
      task.listItems = t.listItems.map(function (it) {
        return { text: it.text || '', completed: !!it.completed };
      });
    }
    if (t.type === 'Image') {
      if (t.imageData) task.imageData = t.imageData;
      if (t.caption) task.caption = t.caption;
    }
    if (t.type === 'Code') {
      if (t.codeContent) task.codeContent = t.codeContent;
      if (t.language) task.language = t.language;
    }
    if (t.type === 'Sketch' && t.sketchData) task.sketchData = t.sketchData;
    if (t.type === 'Text' && t.content) task.content = t.content;
    this.tasks[t.id] = task;
  }, this);
  (data.links || []).forEach(function (pair) {
    if (pair && pair.length === 2 && this.tasks[pair[0]] && this.tasks[pair[1]]) {
      this.links.add(this.linkKey(pair[0], pair[1]));
    }
  }, this);
  if (data.custom_priorities) {
    for (var name in data.custom_priorities) this.custom_priorities[name] = data.custom_priorities[name];
  }
  return true;
};

BoardModel.prototype.save = function() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.toJSON())); } catch(e){} };
BoardModel.prototype.load = function() { try { var raw = localStorage.getItem(STORAGE_KEY); if(!raw) return false; return this.loadFromJSON(JSON.parse(raw)); } catch(e){ return false; } };

var model = new BoardModel();
try { var _raw = localStorage.getItem(STORAGE_KEY); if(_raw) model.loadFromJSON(JSON.parse(_raw)); } catch(e){}
// Start with empty board if nothing saved