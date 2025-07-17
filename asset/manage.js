class App {
  constructor() {
    this.config = Core.instance().config(); // console.log(this.config);
    let namespace = 'cmap';
    let options = {
      host: this.config.get('collabhost'),
      port: this.config.get('collabport'),
      path: this.config.get('collabpath')
    };
    App.manager = CollabManager.instance(namespace, options);
    App.manager.on('event', this.onManagerEvent.bind(this));
    this.manager = App.manager;
    App.clientIds = new Set();
    this.handleEvent();
  }

  static instance() {
    return new App();
  }

  handleEvent() {
    const drake = new dragula([
      document.querySelector('#all-client-list'),
      document.querySelector('#room-socket-list')
    ], {
      moves: function (el, container, handle) {
        return handle.classList.contains('handle');
      },
      copy: (el, source) => {
        return source === document.getElementById('all-client-list');
      },
      accepts: (el, target) => {
        return target !== document.getElementById('all-client-list');
      },
      removeOnSpill: true
    });
    
    drake.on('drag', (el, container) => {
      // console.log(el, container, $(el).attr(`data-socketid`));
    });
    drake.on('over', (el, container) => {
      // console.log(el, container, $(container).children(`.client[data-socketid]`));
    });
    drake.on('drop', (el, target, source, sibling) => {
      // console.log('drop', el, target, source, sibling);
      let t = $(target).attr('id');
      let s = $(source).attr('id');
      let socketId = $(el).attr('data-socketid');
      let room = $('#room-socket-list').attr('data-room');
      switch(t) {
        case 'room-socket-list':
          let exists = $(target)
            .children(`.client[data-socketid="${socketId}"]`)
            .length > 1; // one is for the shadow
          // console.log(target, socketId, $(target)
          //   .children(`.client[data-socketid="${socketId}"]`), exists);
          if (exists) {
            UI.warning('User already in room.').show();
            drake.cancel(true);
            return;
          }
          if (!room) {
            UI.warning('Invalid room to invite.').show();
            drake.cancel(true);
            return;
          }
          App.manager.inviteUserToRoom(socketId, room).then(({result, message}) => {
            if (result) {
              $('#room-socket-list').find(`.client[data-socketid="${socketId}"] .bt-invite`).removeClass('btn-outline-primary').addClass('btn-success');
            } else $('#room-socket-list').find(`.client[data-socketid="${socketId}"]`).fadeOut('fast', function() { this.remove(); });
            console.log(result, message);
          });
          break;
      }
    });
    drake.on('remove', (el, container, source, target) => {
      console.log("remove", el, container, source, target);
      let socketId = $(el).attr('data-socketid');
      let room = $('#room-socket-list').attr('data-room');
      if (room && socketId) {
        if (socketId && room) {
          App.manager.letUserLeaveRoom(socketId, room).then(result => {
            if (result) UI.info(`User has been removed from room <strong>${room}</strong>.`).show();
          }, e => {
            UI.error(e).show();
            $('#room-socket-list').append(el);
          });
        } else {
          UI.warning('Invalid socket ID or room name.').show();
          $('#room-socket-list').append(el);
        }
      }
    });
    $('#bt-connect').on('click', e => {
      App.manager.connect();
    });
    $('#bt-disconnect').on('click', e => {
      App.manager.disconnect();
    });
    $('.bt-refresh-clients').on('click', e => {
      let cnt = Loading.load(e.currentTarget, "");
      App.manager.getAllClientSockets().then(clientIds => { 
        this.updateClientList(clientIds);
        Loading.done(e.currentTarget, cnt);
      }, e => UI.error(e).show());
    });
    $('.bt-refresh-sockets').on('click', e => {
      let cnt = '<i class="bi bi-arrow-repeat"></i>';
      let room = $(e.currentTarget).attr('data-room');
      if (!room) {
        Loading.done(e.currentTarget, cnt);
        return;
      }
      App.manager.getRoomSockets(room).then(sockets => {  // console.warn(sockets);
        this.updateSocketList(sockets);
      }, e => UI.error(e).show()).finally(() => Loading.done(e.currentTarget, cnt));
    });
    $('#room-socket-list').on('click', '.bt-x', e => {
      let socketId = $(e.currentTarget).attr('data-socketid');
      let room = $('#room-socket-list').attr('data-room');
      if (socketId && room) {
        App.manager.letUserLeaveRoom(socketId, room).then(result => {
          if (result) {
            $(`#room-socket-list [data-socketid="${socketId}"]`).fadeOut('fast', () => {
              $(`#room-socket-list [data-socketid="${socketId}"]`).remove();
            });
          }
        }, e => UI.error(e).show());
      } else UI.warning('Invalid socket ID or room name.').show();
    });
    $('.bt-refresh-rooms').on('click', (e) => {
      App.manager.getAllRooms()
        .then(rooms => { // console.error(rooms);
          this.updateRoomList(rooms);
        })
        .catch(e => UI.error(e).show());
    });
    $('#all-room-list').on('click', '.bt-room', e => {
      let room = $(e.currentTarget).attr('data-room');
      $('.bt-refresh-sockets').attr('data-room', room);
      $('#room-section .room-name').html(`${room}`);
      let cnt = Loading.load(e.currentTarget, room);
      App.manager.getRoomSockets(room).then(sockets => { // console.log(sockets);
        this.updateSocketList(sockets);
        Loading.done(e.currentTarget, cnt);
        $('#room-socket-list').attr('data-room', room);
      }, e => UI.error(e).show());
    });
    $('#room-list-section .input-room-name').on('keyup', e => {
      if (e.key == "Enter") 
        $('#room-list-section .bt-create-room').trigger('click');
    });
    $('#room-list-section .bt-create-room').on('click', () => {
      let name = $('#room-list-section .input-room-name').val().trim();
      if (name.length == 0) {
        UI.warning("Please enter a room name.").show();
        return;
      } 
      App.manager.createRoom(`PK/${name}`).then(
        room => {
          $(`#all-room-list .room[data-room="PK/${name}"]`).trigger('click');
          // UI.success('Room has successfully created.').show();
        }, 
        e => UI.error(e).show()
      );
    });
    $('#room-tools .bt-push-mapid').on('click', (e) => {
      let room = $('#room-socket-list').attr('data-room');
      let mapid = $('#room-tools .input-mapid').val().trim();
      // App.manager.pushMapId(mapId, room);
      
      let currentLabel = Loading.load(e.currentTarget, "Retrieving data...");
      // let remember = $('#concept-map-open-dialog input#inputrememberme:checked').val();
      // let userid = $('#concept-map-open-dialog input[name="userid"]').val().trim();
      // let mapid = $('#concept-map-open-dialog input[name="mapid"]').val().trim();
      let url = Core.instance().config('baseurl') + `mapApi/get/${mapid}`;
      if (mapid.length == 0) {
        UI.warningDialog("Please enter Kit-Build kit ID to open.").show();
        return;
      }
      console.log(url);
      Core.instance().ajax().post(url).then(result => { console.log(result);
        // let data = App.parseIni(result.mapdata);
        console.log(result, result.mapdata)
        App.manager.pushMapkit(result, room).then(
          result => UI.info(result).show(), 
          error => UI.error(error).show()
        );
      }).catch(error => {
        console.error(error);
        UI.errorDialog(error).show();
        return;
      }).finally(()=>{
        Loading.done(e.currentTarget, currentLabel);
      });


    });


    let manageRoomDialog = UI.modal("#manage-room-dialog", {
      hideElement: ".bt-close",
      backdrop: false,
      get height() {
        return ($("body").height() * 0.7) | 0;
      },
      get offset() {
        return { left: ($("body").width() * 0.15) | 0 };
      },
      draggable: true,
      dragHandle: ".drag-handle",
      resizable: true,
      resizeHandle: ".resize-handle",
      minWidth: 275,
      minHeight: 200,
      width: 350,
      onShow: () => {
        $('.bt-refresh-pair').trigger('click');
      },
    });
    $('.bt-manage-room').on('click', (e) => {
      manageRoomDialog.show();
    });
    $('.bt-refresh-pair').on('click', async (e) => {
      let pairs = await Core.instance().ajax().post('collabApi/getAll');
      let html = '';
      for(const pair of pairs) {
      html += `<li class="list-group-item list-group-item-action pair-item d-flex 
                justify-content-between p-0" role="button">
                <span class="room-name text-primary"><small contenteditable="true" class="p-2 py-1 m-1 d-block editable-room" data-id="${pair.id}">${pair.room}</small></span>
                <span class="room-userid"><span class="d-flex align-items-center flex-nowrap"><code contenteditable="true" class="p-2 py-1 m-1 d-block editable-userid" data-id="${pair.id}">${pair.userid}</code><span class="badge rounded-pill text-bg-danger me-2 bt-delete-pair" data-id="${pair.id}">Del</span></span></span>
                </li>`;
      }
      $('ul.pair-list').html(html);
    });
    $('ul.pair-list').on('keydown', '.editable-room', async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        let id = $(e.currentTarget).attr('data-id');
        let result = await Core.instance().ajax().post('collabApi/updateRoom', {
          id: id,
          room: $(e.currentTarget).html().trim()
        });
        if (result) {
          $(e.currentTarget).parents('li').addClass('bg-success-subtle');
          setTimeout(() => {
            $(e.currentTarget).parents('li').removeClass('bg-success-subtle');
          }, 2000);
        }
        console.log('Update!', result);
        $(e.currentTarget).trigger('blur');
      }
    });
    $('ul.pair-list').on('keydown', '.editable-userid', async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        let id = $(e.currentTarget).attr('data-id');
        let result = await Core.instance().ajax().post('collabApi/updateUserId', {
          id: id,
          userid: $(e.currentTarget).html().trim()
        });
        if (result) {
          $(e.currentTarget).parents('li').addClass('bg-success-subtle');
          setTimeout(() => {
            $(e.currentTarget).parents('li').removeClass('bg-success-subtle');
          }, 2000);
        }
        console.log('Update!', result);
        $(e.currentTarget).trigger('blur');
      }
    });
    $('ul.pair-list').on('click', '.bt-delete-pair', async (e) => {
      let id = $(e.currentTarget).attr('data-id');
      let confirm = UI.confirm('Delete user room information?<br>This action is <span class="text-danger">NOT</span> undoable.').positive(async () => {
        let result = await Core.instance().ajax().post('collabApi/deletePair', {
          id: id
        });
        if (result) 
          $(e.currentTarget).parents('li').slideUp('fast', function (r) { 
            $(this).remove(); 
          });
      }).negative(() => confirm.hide()).show();
    });
    $('#form-pair').on('submit', async (e) => {
      e.preventDefault();
      const userid = $('#form-pair input[name="pair-userid"]').val();
      const room = $('#form-pair input[name="pair-room"]').val();
      let id = await Core.instance().ajax().post('collabApi/createUserRoom', {
          userid: userid.trim(),
          room: room.trim()
        });
      let html = '';
      html += `<li class="list-group-item list-group-item-action pair-item d-flex 
                justify-content-between p-0" role="button">
                <span class="room-name text-primary"><small contenteditable="true" class="p-2 py-1 m-1 d-block editable-room" data-id="${id}">${room}</small></span>
                <span class="room-userid"><span class="d-flex align-items-center flex-nowrap"><code contenteditable="true" class="p-2 py-1 m-1 d-block editable-userid" data-id="${id}">${userid}</code><span class="badge rounded-pill text-bg-danger me-2 bt-delete-pair" data-id="${id}">Del</span></span></span>
                </li>`;
      $('ul.pair-list').append(html);
      $('ul.pair-list').animate({
        scrollTop: $(`ul.pair-list [data-id="${id}"]`).offset().top
      }, 800);
      if (id)
        $('#form-pair input[name="pair-userid"]').val('');
      // $.scrollTo(`ul.pair-list [data-id="${id}"]`, 800);
    });
    
  }

  onManagerEvent(event, ...data) { 
    console.warn("Consuming event on app: ", event, data);
    switch(event) {
      case 'connect':
        // $('.bt-refresh-rooms').trigger('click');
        break;
      case 'client-disconnect':
        let socketId = data.shift();
        let roomEl = $('#all-room-list').find(`.room[data-room="${socketId}"]`);
        roomEl.fadeOut('fast', () => roomEl.remove());
        break;
      case 'clients-updated':
        this.updateClientList(data.shift());
        break;
      case 'user-registered':
        let user = data.shift();
        let rooms = data.shift();
        this.updateClient(user);
        this.sortSocketList('#all-client-list');
        for(let room of rooms) this.updateRoom(room);
        break;
      case 'user-join-room': {
          let user = data.shift();
          let room = data.shift();
          // console.log(user.name, room.name);
          this.updateRoom(room);
          $('.bt-refresh-sockets').trigger('click');
        } break;
      case 'user-leave-room': {
          let user = data.shift();
          let room = data.shift();
          // console.log(user.name, room.name);
          let roomEl = $('#all-room-list').find(`.room[data-room="${room.name}"]`);
          let name = $('#room-socket-list').attr('data-room');
          App.manager.getRoomSockets(room.name).then(sockets => { // console.log(sockets);
            if (sockets.length == 0) 
              roomEl.fadeOut('fast', () => roomEl.remove());
            $('#all-room-list')
              .find(`.room[data-room="${room.name}"] .room-users-count`)
              .html(sockets.length);
            if (name == room.name) 
              this.removeUser('#room-socket-list', user);
          }, e => UI.error(e).show());
        } break;
      case 'join-room-request-rejected': {
        let room = data.shift();
        let user = data.shift();
        let name = $('#room-socket-list').attr('data-room');
        // console.log(room, user, name);
        if (room == name)
          this.removeUser('#room-socket-list', user);
        UI.warning(`Join room requested has been rejected.<br>User ${user.name} of room ${room}.`).show();
      } break;
      case 'get-map-state': {
        console.log("Somebody is requesting map state here...", data);
        let callback = data.pop();
        if (typeof callback == "function") callback(false);
      } break;
    }
  }


  updateClientList(users) { console.log(users);
    App.users = new Set(users);
    let clientEls = $('#all-client-list .client[data-socketid]');
    let listedSids = new Set();
    let updatedSids = new Set();
    for(let el of clientEls) 
      listedSids.add($(el).attr('data-socketid'));
    for(let user of users) { // console.log(user);
      updatedSids.add(user.socketId);
      if (!listedSids.has(user.socketId))
        this.addUser('#all-client-list', user);
    }
    // console.warn(listedSids, updatedSids);
    for(let sid of listedSids) {
      if (!updatedSids.has(sid))
        $(`#all-client-list .client[data-socketid="${sid}"]`).fadeOut('fast', function() {
          $(this).remove();
      });
    }
    this.sortSocketList('#all-client-list');
  }

  updateClient(user) {
    $(`#all-client-list .client[data-socketid="${user.socketId}"]`).attr(`data-name`, encodeURIComponent(user.name))
    $('#all-client-list').find(`.client-name[data-socketid="${user.socketId}"]`).removeClass('bg-secondary').html(user.name);
  }

  updateRoomList(rooms) { // console.log(rooms);
    App.rooms = new Set(rooms);
    let roomEls = $('#all-room-list .room[data-room]');
    let privateRoomEls = $('#private-room-list .room[data-room]');
    let listedRooms = new Set();
    let privateListedRooms = new Set();
    let updatedRooms = new Set();

    // console.log(roomEls);
    for(let el of roomEls) 
      listedRooms.add($(el).attr('data-room'));
    for(let el of privateRoomEls)
      privateListedRooms.add($(el).attr('data-room'));
    
    // add missing rooms
    for(let room of rooms) { // console.log(room);
      updatedRooms.add(room.name);
      if (!listedRooms.has(room.name))
        this.addRoom(room);
    }
    // console.log(listedRooms, privateListedRooms, updatedRooms);
    // remove obsolete rooms
    for(let room of listedRooms) {
      if (!updatedRooms.has(room))
        $(`#all-room-list .room[data-room="${room}"]`).fadeOut('fast', function() {
          $(this).remove();
      });
    }
    for(let room of privateListedRooms) {
      if (!updatedRooms.has(room))
        $(`#private-room-list .room[data-room="${room}"]`).fadeOut('fast', function() {
          $(this).remove();
      });
    }
    // sort rooms
    this.sortRoomList();
  }

  sortRoomList() {
    let sorter = (a, b) => {
      if ($(a).attr('data-room') < $(b).attr('data-room')) return -1;
      if ($(a).attr('data-room') > $(b).attr('data-room')) return 1;
      return 0;
    }
    // sort non-private rooms
    let roomEls = $('#all-room-list .room[data-room]');
    roomEls.sort(sorter);
    $('#all-room-list').html('');
    $(roomEls).appendTo('#all-room-list');
    // sort private rooms
    roomEls = $('#private-room-list .room[data-room]');
    roomEls.sort(sorter);
    $('#private-room-list').html('');
    $(roomEls).appendTo('#private-room-list');
  }

  addRoom(room) { // console.log("Add room", room, room.name, room.users[0]?.socketId);
    let isPrivateRoom = (room.name == room.users[0]?.socketId || room.users.length == 0);
    let privateClass = isPrivateRoom ? 'btn-outline-danger bg-danger-subtle' : 'btn-outline-secondary';
    let html = '';
    html += `<div class="d-inline-block">`;
    html += `<div class="room btn btn-sm ${privateClass} bt-room me-1 mt-1" data-room="${room.name}" data-private="${isPrivateRoom ? 1 : 0}">`;
    html += `<span class="room-name">${room.name}</span>`;
    if (!isPrivateRoom) {
      html += `<span class="room-users-count badge text-bg-primary ms-1">${room.users.length}</span>`;
    }
    html += `</div>`;
    html += `</div>`;
    if (isPrivateRoom) {
      if ($(`#private-room-list .room[data-room="${room.name}"]`).length == 0)
        $(html).hide().appendTo('#private-room-list').fadeIn('fast');
    } else $(html).hide().appendTo('#all-room-list').fadeIn('fast');
  }
  
  sortSocketList(container = '') { // console.log("sort", container);
    let sorter = (a, b) => {
      if ($(a).attr('data-name') < $(b).attr('data-name')) return -1;
      if ($(a).attr('data-name') > $(b).attr('data-name')) return 1;
      return 0;
    }
    let roomEls = $(`${container} .client[data-socketid]`);
    roomEls.sort(sorter);
    $(container).html('');
    $(roomEls).appendTo(container);
  }

  updateSocketList(users) {

    let listedSockets = new Set();
    let updatedSockets = new Set();

    let els = $('#room-socket-list .client[data-socketid]');
    for (let el of els) listedSockets.add($(el).attr('data-socketid'));

    for(let user of users) {
      updatedSockets.add(user.socketId);
      if (!listedSockets.has(user.socketId))
        this.addUser('#room-socket-list', user);
    }
    for(let socket of listedSockets) {
      if (!updatedSockets.has(socket))
        $(`#room-socket-list .client[data-socketid="${socket}"]`).fadeOut('fast', function() {
          $(this).remove();
      });
    }
    // sort sockets
    this.sortSocketList('#room-socket-list');


      // html += `<div><span class="me-2">${socket.user?.name ?? ''}</span><code>${socket.id}</code></div>`;
  }

  updateRoom(room) { console.warn("Update Room", room);
    let roomEl = $('#all-room-list').find(`.room[data-room="${room.name}"]`);
    if (roomEl.length == 0) this.addRoom(room);
    else {  
      $('#all-room-list')
        .find(`.room[data-room="${room.name}"] .room-users-count`)
        .html(room.users.length);
    }
    $('.bt-refresh-rooms').trigger('click');
  }

  addUser(container, user) { console.log("Add user:", user);
    let el = $(container)
      .find(`.client[data-socketid="${user.socketId}"]`);
    // console.log(user, el);
    if (el.length > 0) {
      $(el).find('.client-name').html(user.name);
      $(el).find('.client-name')
        .addClass('bg-success-subtle');
      setTimeout(() => {
        $(el).find('.client-name')
          .removeClass('bg-success-subtle');
      }, 2000);
      return;
    }

    // skipping "check" connection
    if (!user) return;

    console.log("User to add:", user.name);

    let html = '';
    html += `<div data-socketid="${user.socketId}" `;
    html += `  data-name="${encodeURIComponent(user.name)}" `
    html += `  class="client p-1 border rounded d-inline-flex mt-1 me-1 `;
    html += `    flex-nowrap mw-100">`;
    html += `<span class="d-flex text-truncate">`;
    html += `  <span class="client-name btn btn-sm `;
    html += `    ${user?.name ? '' : 'bg-outline-secondary'} text-truncate" `;
    html += `    data-bs-toggle="dropdown" aria-expanded="false" `;
    html += `    data-socketid="${user.socketId}">`;
    html += `  ${user?.name ?? '<small class="text-primary"><i class="bi bi-person-fill"></i></small>'}`;
    html += `  </span>`;
    html += `  <ul class="dropdown-menu"><li class="px-2"><small>`;
    html += `  <code>${user.socketId}</code></small></li></ul>`;
    html += `</span>`;
    html += `<span class="bt-x btn btn-sm btn-outline-danger ms-1" `;
    html += `  data-socketid="${user.socketId}"><i class="bi bi-x-lg"></i>`;
    html += `</span>`;
    html += `<span class="handle btn btn-sm btn-warning ms-1" `;
    html += `  data-socketid="${user.socketId}"><i class="bi bi-arrows-move handle"></i>`;
    html += `</span>`;
    html += `</div>`;
    $(html).hide().appendTo(container).fadeIn('fast');
  }

  removeUser(container, user) {
    let el = $(container).find(`.client[data-socketid="${user.socketId}"]`);
    el.fadeOut('fast', ()=>el.remove());
  }

}

$(() => App.instance());