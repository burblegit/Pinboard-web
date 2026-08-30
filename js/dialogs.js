'use strict';

var modalRoot = document.getElementById('modal-root');
var fileInput = document.getElementById('file-input');

function openDialog(html) {
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  var box = document.createElement('div');
  box.className = 'modal-box';
  box.innerHTML = html;
  overlay.appendChild(box);
  modalRoot.appendChild(overlay);
  return {
    overlay: overlay,
    box: box,
    close: function () { overlay.remove(); }
  };
}

function closeTopDialog() {
  var last = modalRoot.lastElementChild;
  if (last) last.remove();
}

function alertDialog(title, message) {
  return new Promise(function (resolve) {
    var d = openDialog(
      '<h3>' + esc(title) + '</h3>' +
      '<div class="dlg-message">' + esc(message) + '</div>' +
      '<div class="dlg-actions"><button type="button" class="dlg-btn" data-act="ok">OK</button></div>'
    );
    d.box.querySelector('[data-act="ok"]').addEventListener('click', function () {
      d.close();
      resolve();
    });
    d.box.querySelector('.dlg-input, input, select, button').focus();
  });
}

function confirmDialog(message, buttons) {
  return new Promise(function (resolve) {
    var btns = buttons.map(function (b) {
      return '<button type="button" class="dlg-btn' + (b.danger ? ' danger' : '') + '" data-val="' + b.value + '">' + esc(b.label) + '</button>';
    }).join('');
    var d = openDialog(
      '<h3>Confirm</h3>' +
      '<div class="dlg-message">' + esc(message) + '</div>' +
      '<div class="dlg-actions">' + btns + '</div>'
    );
    d.box.querySelectorAll('[data-val]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        d.close();
        resolve(btn.getAttribute('data-val'));
      });
    });
    d.box.querySelector('button').focus();
  });
}

function priorityOptionsHtml(current) {
  var parts = model.getAllPriorities().map(function (p) {
    return '<option value="' + esc(p) + '">' + esc(p) + '</option>';
  });
  parts.push('<option disabled>\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500</option>');
  parts.push('<option value="__custom">+ Custom...</option>');
  parts.push('<option value="__manage">Manage Priorities...</option>');
  return parts.join('');
}

function wirePrioritySelect(select, initial) {
  select.innerHTML = priorityOptionsHtml(initial);
  select.value = initial;
  var current = initial;
  select.addEventListener('change', function () {
    var v = select.value;
    if (v === '__custom') {
      customPriorityDialog().then(function (res) {
        if (res && res.name) {
          model.addCustomPriority(res.name, res.color);
          select.innerHTML = priorityOptionsHtml(res.name);
          select.value = res.name;
          current = res.name;
        } else {
          select.value = current;
        }
      });
    } else if (v === '__manage') {
      managePrioritiesDialog().then(function () {
        select.innerHTML = priorityOptionsHtml(current);
        select.value = current;
      });
    } else {
      current = v;
    }
  });
  return function () { return select.value; };
}

function typeOptionsHtml(current) {
  var types = ['Text', 'List', 'Image', 'Code', 'Sketch'];
  return types.map(function (t) {
    return '<option value="' + t + '"' + (t === current ? ' selected' : '') + '>' + t + '</option>';
  }).join('');
}

function customPriorityDialog() {
  return new Promise(function (resolve) {
    var color = '#CC8899';
    var d = openDialog(
      '<h3>Custom Priority</h3>' +
      '<label class="dlg-label">Priority Name:</label>' +
      '<input class="dlg-input" id="cp-name" placeholder="e.g. Critical, Optional...">' +
      '<div class="dlg-row">' +
      '  <label class="dlg-label">Color:</label>' +
      '  <div class="swatch" id="cp-swatch" style="background:' + color + '"></div>' +
      '  <label class="pick-btn">Pick<input type="color" id="cp-color" value="' + color + '" hidden></label>' +
      '</div>' +
      '<div class="dlg-actions">' +
      '  <button type="button" class="dlg-btn" data-act="cancel">Cancel</button>' +
      '  <button type="button" class="dlg-btn" data-act="create">Create</button>' +
      '</div>'
    );
    var nameInput = d.box.querySelector('#cp-name');
    var swatch = d.box.querySelector('#cp-swatch');
    d.box.querySelector('#cp-color').addEventListener('input', function (e) {
      color = e.target.value;
      swatch.style.background = color;
    });
    function create() {
      var name = nameInput.value.trim();
      if (!name) {
        alertDialog('Invalid', 'Name cannot be empty.');
        return;
      }
      d.close();
      resolve({ name: name, color: color });
    }
    d.box.querySelector('[data-act="create"]').addEventListener('click', create);
    d.box.querySelector('[data-act="cancel"]').addEventListener('click', function () {
      d.close();
      resolve(null);
    });
    nameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); create(); }
    });
    nameInput.focus();
  });
}

function managePrioritiesDialog() {
  return new Promise(function (resolve) {
    var d = openDialog(
      '<h3>Manage Custom Priorities</h3>' +
      '<div class="mg-header">Custom Priorities:</div>' +
      '<div class="mg-list"></div>' +
      '<div class="dlg-actions"><button type="button" class="dlg-btn" data-act="close">Close</button></div>'
    );
    var listEl = d.box.querySelector('.mg-list');

    function rebuild() {
      listEl.innerHTML = '';
      var names = Object.keys(model.custom_priorities).sort();
      if (!names.length) {
        var empty = document.createElement('div');
        empty.className = 'mg-empty';
        empty.textContent = 'No custom priorities defined.';
        listEl.appendChild(empty);
        return;
      }
      names.forEach(function (name) {
        var row = document.createElement('div');
        row.className = 'mg-row';
        var swatch = document.createElement('div');
        swatch.className = 'swatch';
        swatch.style.background = model.custom_priorities[name];
        var lbl = document.createElement('span');
        lbl.className = 'mg-name';
        lbl.textContent = name;
        var del = document.createElement('button');
        del.className = 'dlg-btn small danger';
        del.textContent = 'Delete';
        del.addEventListener('click', function () { deletePriority(name); });
        row.appendChild(swatch);
        row.appendChild(lbl);
        row.appendChild(del);
        listEl.appendChild(row);
      });
    }

    function deletePriority(name) {
      var ids = model.getTaskIdsByPriority(name);
      var msg = ids.length
        ? 'Delete custom priority "' + name + '"?\n\n\u26A0\uFE0F  ' + ids.length + ' note(s) with this priority will also be deleted.\nThis cannot be undone.'
        : 'Delete custom priority "' + name + '"?';
      confirmDialog(msg, [
        { label: 'No', value: 'no' },
        { label: 'Yes', value: 'yes', danger: true }
      ]).then(function (ans) {
        if (ans !== 'yes') return;
        model.removeTasksByPriority(name);
        ids.forEach(function (id) { removeNoteEl(id); });
        model.removeCustomPriority(name);
        if (linkSource && ids.indexOf(linkSource) !== -1) {
          linkSource = null;
          setLinkHint(true);
        }
        rebuild();
        updateStatus();
      });
    }

    rebuild();
    d.box.querySelector('[data-act="close"]').addEventListener('click', function () {
      d.close();
      resolve();
    });
  });
}

function buildTypeFields(type, task) {
  switch (type) {
    case 'List':
      var items = (task && task.listItems) || [{ text: '', completed: false }];
      return '<div class="dlg-label">List Items (one per line):</label>' +
        '<textarea class="dlg-input" id="td-list-items" rows="6" placeholder="Item 1&#10;Item 2&#10;...">' + esc(items.map(function (it) { return it.text; }).join('\n')) + '</textarea>';
    case 'Image':
      return '<div class="dlg-label">Image:</label>' +
        '<div class="dlg-row">' +
        '  <label class="pick-btn">Choose File<input type="file" id="td-image-file" accept="image/*" hidden></label>' +
        '  <span id="td-image-name" style="color:#B8A878;font-size:12px;">No file selected</span>' +
        '</div>' +
        '<div class="dlg-label">Caption (optional):</label>' +
        '<input class="dlg-input" id="td-image-caption" placeholder="Image caption...">' +
        (task && task.imageData ? '<div class="dlg-label">Preview:</label><img src="' + esc(task.imageData) + '" style="max-width:100%;max-height:150px;border-radius:4px;margin-top:8px;">' : '');
    case 'Code':
      return '<div class="dlg-label">Code:</label>' +
        '<textarea class="dlg-input" id="td-code-content" rows="8" spellcheck="false" style="font-family:monospace;font-size:12px;" placeholder="Enter code...">' + esc(task && task.codeContent ? task.codeContent : '') + '</textarea>' +
        '<div class="dlg-row">' +
        '  <label class="dlg-label">Language:</label>' +
        '  <select class="dlg-select" id="td-code-lang">' +
        '    <option value="plaintext"' + (task && task.language === 'plaintext' ? ' selected' : '') + '>Plain Text</option>' +
        '    <option value="javascript"' + (task && task.language === 'javascript' ? ' selected' : '') + '>JavaScript</option>' +
        '    <option value="python"' + (task && task.language === 'python' ? ' selected' : '') + '>Python</option>' +
        '    <option value="html"' + (task && task.language === 'html' ? ' selected' : '') + '>HTML</option>' +
        '    <option value="css"' + (task && task.language === 'css' ? ' selected' : '') + '>CSS</option>' +
        '    <option value="json"' + (task && task.language === 'json' ? ' selected' : '') + '>JSON</option>' +
        '    <option value="sql"' + (task && task.language === 'sql' ? ' selected' : '') + '>SQL</option>' +
        '    <option value="cpp"' + (task && task.language === 'cpp' ? ' selected' : '') + '>C++</option>' +
        '    <option value="java"' + (task && task.language === 'java' ? ' selected' : '') + '>Java</option>' +
        '    <option value="rust"' + (task && task.language === 'rust' ? ' selected' : '') + '>Rust</option>' +
        '    <option value="go"' + (task && task.language === 'go' ? ' selected' : '') + '>Go</option>' +
        '  </select>' +
        '</div>';
    case 'Sketch':
      return '<div class="dlg-label">Sketch:</label>' +
        '<div class="dlg-message">Draw on the note after creation. Use the sketch toolbar on the note.</div>';
    default:
      return '<div class="dlg-label">Content:</label>' +
        '<textarea class="dlg-input" id="td-text-content" rows="4" placeholder="Enter note text...">' + esc(task && task.content ? task.content : '') + '</textarea>';
  }
}

function buildDueDateSelects(dueDate) {
  var date = dueDate ? new Date(dueDate) : new Date();
  date.setHours(date.getHours() + 1);
  var year = date.getFullYear();
  var month = date.getMonth();
  var day = date.getDate();
  var hour = date.getHours();
  var minute = date.getMinutes();

  var years = [];
  for (var y = year; y <= year + 5; y++) years.push(y);
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var days = [];
  for (var d = 1; d <= 31; d++) days.push(d);
  var hours = [];
  for (var h = 0; h < 24; h++) hours.push(h);
  var minutes = ['00', '15', '30', '45'];

  var yearOpts = years.map(function(y) { return '<option value="' + y + '"' + (y === year ? ' selected' : '') + '>' + y + '</option>'; }).join('');
  var monthOpts = months.map(function(m, i) { return '<option value="' + i + '"' + (i === month ? ' selected' : '') + '>' + m + '</option>'; }).join('');
  var dayOpts = days.map(function(d) { return '<option value="' + d + '"' + (d === day ? ' selected' : '') + '>' + d + '</option>'; }).join('');
  var hourOpts = hours.map(function(h) { return '<option value="' + h + '"' + (h === hour ? ' selected' : '') + '>' + String(h).padStart(2, '0') + '</option>'; }).join('');
  var minuteOpts = minutes.map(function(m) { return '<option value="' + m + '"' + (m === String(minute).padStart(2, '0') ? ' selected' : '') + '>' + m + '</option>'; }).join('');

  return '<div class="dlg-row">' +
    '<label class="dlg-label">Due Date:</label>' +
    '<select class="dlg-select" id="td-due-year" style="width:70px;">' + yearOpts + '</select>' +
    '<select class="dlg-select" id="td-due-month" style="width:70px;">' + monthOpts + '</select>' +
    '<select class="dlg-select" id="td-due-day" style="width:60px;">' + dayOpts + '</select>' +
    '<label class="dlg-label" style="margin-left:8px;">Time:</label>' +
    '<select class="dlg-select" id="td-due-hour" style="width:60px;">' + hourOpts + '</select>' +
    '<span>:</span>' +
    '<select class="dlg-select" id="td-due-minute" style="width:60px;">' + minuteOpts + '</select>' +
    '</div>';
}

function buildTimeTrackingCheckbox(timeTracked) {
  var hours = Math.floor(timeTracked / 60);
  var mins = timeTracked % 60;
  var display = hours > 0 ? hours + 'h ' + mins + 'm' : mins + 'm';
  return '<div class="dlg-row">' +
    '<label class="dlg-label">Time Tracking:</label>' +
    '<input type="checkbox" id="td-time-track" ' + (timeTracked > 0 ? 'checked' : '') + ' style="width:auto;margin-right:6px;">' +
    '<span id="td-time-display" style="font-family:monospace;color:#8B6914;">' + display + '</span>' +
    '</div>';
}

function taskDialog(mode, task) {
  return new Promise(function (resolve) {
    var initialPriority = task ? task.priority : 'Normal';
    var initialType = task ? task.type : 'Text';
    var isAdd = mode === 'add';
    var currentType = initialType;
    var imageFile = null;
    var initialDueDate = task ? task.dueDate : null;
    var initialTimeTracked = task ? (task.timeTracked || 0) : 0;

    var d = openDialog(
      '<h3>' + (isAdd ? 'New Note' : 'Edit Note') + '</h3>' +
      '<label class="dlg-label">Title:</label>' +
      '<input class="dlg-input" id="td-title" placeholder="Enter note title...">' +
      '<div class="dlg-row">' +
      '  <label class="dlg-label">Type:</label>' +
      '  <select class="dlg-select" id="td-type">' + typeOptionsHtml(initialType) + '</select>' +
      '</div>' +
      '<div class="dlg-row">' +
      '  <label class="dlg-label">Priority:</label>' +
      '  <select class="dlg-select" id="td-priority"></select>' +
      '</div>' +
      '<button type="button" class="dlg-btn small" id="td-more-toggle" style="margin:4px 0 8px;padding:4px 12px;background:#3E2710;border-color:#8B6914;">\u25BC More options</button>' +
      '<div id="td-more-fields" style="display:none;">' +
      buildDueDateSelects(initialDueDate) +
      buildTimeTrackingCheckbox(initialTimeTracked) +
      '</div>' +
      '<div id="td-type-fields"></div>' +
      '<div class="dlg-actions">' +
      '  <button type="button" class="dlg-btn" data-act="cancel">Cancel</button>' +
      '  <button type="button" class="dlg-btn" data-act="ok">' + (isAdd ? 'Add' : 'Save') + '</button>' +
      '</div>'
    );

    var titleInput = d.box.querySelector('#td-title');
    if (task) titleInput.value = task.title;

    var typeSelect = d.box.querySelector('#td-type');
    var typeFields = d.box.querySelector('#td-type-fields');
    var prioritySelect = d.box.querySelector('#td-priority');
    var getPriority = wirePrioritySelect(prioritySelect, initialPriority);

    function updateTypeFields() {
      var t = typeSelect.value;
      typeFields.innerHTML = buildTypeFields(t, (t === initialType && task) ? task : null);
      if (t === 'Image') {
        var fileInputEl = typeFields.querySelector('#td-image-file');
        var nameEl = typeFields.querySelector('#td-image-name');
        if (fileInputEl) {
          fileInputEl.addEventListener('change', function (e) {
            var file = e.target.files[0];
            if (!file) return;
            imageFile = file;
            nameEl.textContent = file.name;
            var reader = new FileReader();
            reader.onload = function () {
              var preview = typeFields.querySelector('img');
              if (preview) preview.src = reader.result;
              else {
                var img = document.createElement('img');
                img.src = reader.result;
                img.style.maxWidth = '100%';
                img.style.maxHeight = '150px';
                img.style.borderRadius = '4px';
                img.style.marginTop = '8px';
                typeFields.appendChild(img);
              }
            };
            reader.readAsDataURL(file);
          });
        }
      }
    }

    typeSelect.addEventListener('change', function () {
      currentType = typeSelect.value;
      updateTypeFields();
    });

    updateTypeFields();

    var moreToggle = d.box.querySelector('#td-more-toggle');
    var moreFields = d.box.querySelector('#td-more-fields');
    var moreOpen = false;
    moreToggle.addEventListener('click', function () {
      moreOpen = !moreOpen;
      moreFields.style.display = moreOpen ? 'block' : 'none';
      moreToggle.textContent = (moreOpen ? '\u25B2' : '\u25BC') + ' ' + (moreOpen ? 'Less options' : 'More options');
    });

    var dueYearSelect = d.box.querySelector('#td-due-year');
    var dueMonthSelect = d.box.querySelector('#td-due-month');
    var dueDaySelect = d.box.querySelector('#td-due-day');
    var dueHourSelect = d.box.querySelector('#td-due-hour');
    var dueMinuteSelect = d.box.querySelector('#td-due-minute');
    var timeTrackCheckbox = d.box.querySelector('#td-time-track');
    var timeDisplay = d.box.querySelector('#td-time-display');
    var currentTimeTracked = initialTimeTracked;

    timeTrackCheckbox.addEventListener('change', function() {
      if (!timeTrackCheckbox.checked) {
        currentTimeTracked = 0;
        if (timeDisplay) timeDisplay.textContent = '0m';
      }
    });

    function submit() {
      var title = titleInput.value.trim();
      if (!title) {
        alertDialog('Empty Note', 'Title cannot be empty!');
        return;
      }
      var priority = getPriority();
      var color = model.custom_priorities[priority] || null;
      var dueDate = null;
      var year = parseInt(dueYearSelect.value, 10);
      var month = parseInt(dueMonthSelect.value, 10);
      var day = parseInt(dueDaySelect.value, 10);
      var hour = parseInt(dueHourSelect.value, 10);
      var minute = parseInt(dueMinuteSelect.value, 10);
      var dt = new Date(year, month, day, hour, minute, 0, 0);
      if (!isNaN(dt.getTime())) dueDate = dt.toISOString();
      var timeTracked = timeTrackCheckbox.checked ? currentTimeTracked : 0;
      var typeData = {};
      if (currentType === 'List') {
        var text = typeFields.querySelector('#td-list-items').value;
        typeData.items = text.split('\n').filter(function (l) { return l.trim(); }).map(function (l) {
          return { text: l.trim(), completed: false };
        });
        if (!typeData.items.length) typeData.items = [{ text: '', completed: false }];
      } else if (currentType === 'Image') {
        if (imageFile) {
          var reader = new FileReader();
          reader.onload = function () {
            typeData.imageData = reader.result;
            typeData.caption = typeFields.querySelector('#td-image-caption').value.trim();
            d.close();
            resolve({ title: title, priority: priority, color: color, type: currentType, typeData: typeData, dueDate: dueDate, timeTracked: timeTracked });
          };
          reader.readAsDataURL(imageFile);
          return;
        } else if (task && task.imageData) {
          typeData.imageData = task.imageData;
          typeData.caption = typeFields.querySelector('#td-image-caption').value.trim();
        }
      } else if (currentType === 'Code') {
        typeData.codeContent = typeFields.querySelector('#td-code-content').value;
        typeData.language = typeFields.querySelector('#td-code-lang').value;
      } else if (currentType === 'Sketch') {
        typeData.sketchData = null;
      } else {
        typeData.textContent = typeFields.querySelector('#td-text-content').value;
      }
      d.close();
      resolve({ title: title, priority: priority, color: color, type: currentType, typeData: typeData, dueDate: dueDate, timeTracked: timeTracked });
    }

    d.box.querySelector('[data-act="ok"]').addEventListener('click', submit);
    d.box.querySelector('[data-act="cancel"]').addEventListener('click', function () {
      d.close();
      resolve(null);
    });
    titleInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    });
    titleInput.focus();
  });
}

function addNoteFlow() {
  taskDialog('add', null).then(function (data) {
    if (data) addTaskFlow(data.title, data.priority, data.color, data.type, data.typeData, data.dueDate, data.timeTracked);
  });
}

function editNoteFlow(task) {
  taskDialog('edit', task).then(function (data) {
    if (!data) return;
    var changedType = data.type !== task.type;
    if (changedType) {
      model.changeType(task.id, data.type, data.typeData);
    } else {
      task.title = data.title;
      task.priority = data.priority;
      task.color = data.color;
      if (data.dueDate !== undefined) model.updateDueDate(task.id, data.dueDate);
      if (data.timeTracked !== undefined) model.updateTimeTracked(task.id, data.timeTracked);
      if (data.type === 'List' && data.typeData) model.updateListItems(task.id, data.typeData.items);
      else if (data.type === 'Image' && data.typeData) model.updateImageData(task.id, data.typeData.imageData, data.typeData.caption);
      else if (data.type === 'Code' && data.typeData) model.updateCodeContent(task.id, data.typeData.codeContent, data.typeData.language);
      else if (data.type === 'Text' && data.typeData) model.updateContent(task.id, data.typeData.textContent);
    }
    refreshNoteEl(task.id);
    updateStatus();
  });
}

function deleteNoteFlow(id) {
  model.removeTask(id);
  removeNoteEl(id);
  if (linkSource === id) {
    linkSource = null;
    setLinkHint(true);
  }
  updateStatus();
}

function showNoteContextMenu(clientX, clientY, id) {
  var task = model.tasks[id];
  if (!task) return;
  hideContextMenu();
  var menu = document.createElement('div');
  menu.className = 'context-menu';

  var edit = document.createElement('div');
  edit.className = 'context-item';
  edit.textContent = 'Edit Note';
  edit.addEventListener('click', function () { hideContextMenu(); editNoteFlow(task); });
  menu.appendChild(edit);

  menu.appendChild(sep());

  var changeType = document.createElement('div');
  changeType.className = 'context-item';
  changeType.textContent = 'Change Type \u25B6';
  changeType.addEventListener('click', function () {
    hideContextMenu();
    var submenu = document.createElement('div');
    submenu.className = 'context-menu';
    var types = ['Text', 'List', 'Image', 'Code', 'Sketch'];
    types.forEach(function (t) {
      if (t === task.type) return;
      var item = document.createElement('div');
      item.className = 'context-item';
      item.textContent = t;
      item.addEventListener('click', function () {
        hideContextMenu();
        model.changeType(id, t);
        refreshNoteEl(id);
        updateStatus();
      });
      submenu.appendChild(item);
    });
    submenu.style.left = Math.min(clientX + 180, window.innerWidth - 200) + 'px';
    submenu.style.top = Math.min(clientY, window.innerHeight - 180) + 'px';
    document.body.appendChild(submenu);
  });
  menu.appendChild(changeType);

  menu.appendChild(sep());

  var toggle = document.createElement('div');
  toggle.className = 'context-item';
  toggle.textContent = task.completed ? 'Reopen' : 'Mark Done';
  toggle.addEventListener('click', function () { hideContextMenu(); toggleCompleted(id); });
  menu.appendChild(toggle);

  var del = document.createElement('div');
  del.className = 'context-item';
  del.textContent = 'Delete Note';
  del.addEventListener('click', function () { hideContextMenu(); deleteNoteFlow(id); });
  menu.appendChild(del);

  menu.appendChild(sep());

  var info = document.createElement('div');
  info.className = 'context-item disabled';
  info.textContent = 'ID: ' + id + ' | ' + task.priority + ' | ' + task.type;
  menu.appendChild(info);

  menu.style.left = Math.min(clientX, window.innerWidth - 200) + 'px';
  menu.style.top = Math.min(clientY, window.innerHeight - 180) + 'px';
  document.body.appendChild(menu);
  menu.dataset.active = '1';
}

function sep() {
  var s = document.createElement('div');
  s.className = 'context-sep';
  return s;
}

function hideContextMenu() {
  var menu = document.querySelector('.context-menu');
  if (menu) menu.remove();
}

function newBoardFlow() {
  confirmDialog('Save current board before creating a new one?', [
    { label: 'Cancel', value: 'cancel' },
    { label: 'Discard', value: 'discard', danger: true },
    { label: 'Save As...', value: 'saveas' }
  ]).then(function (ans) {
    if (ans === 'cancel') return;
    if (ans === 'saveas') saveAsBoard();
    model.clear();
    zoomReset();
    setLinkMode(false);
    renderAll();
    updateStatus();
  });
}

function saveAsBoard() {
  var blob = new Blob([JSON.stringify(model.toJSON(), null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'auto_save.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

function loadBoard() {
  fileInput.value = '';
  fileInput.click();
}

function resetView() {
  fitScene();
}

function exitApp() {
  window.close();
}