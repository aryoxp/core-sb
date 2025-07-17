<div class="d-flex flex-column vh-100">
  <div class="app-navbar d-flex align-items-center p-2 pe-2">
    <div class="btn-group">
      <button class="btn btn-success" id="bt-connect"><i class="bi bi-plug-fill"></i> Connect</button>
      <button class="btn btn-danger visually-hidden" id="bt-disconnect"><i class="bi bi-power"></i> Disconnect</button>
      <span class="btn btn-disabled border"><span class="text-secondary client-status">Client is disconnected</span></span>
    </div>
    <div class="flex-fill">&nbsp;</div>
    <div class="flex-fill">&nbsp;</div>
    <span class="fw-bold badge rounded-pill text-bg-secondary px-3 py-2">Concept Map</span>
  </div>
  <div class="d-flex flex-fill align-items-stretch p-2 border border-dark-subtle rounded m-2 gx-2">
    <div class="row g-2 flex-fill">
      <div class="col-4 d-flex flex-column">
        <div class="d-flex px-2">
          <div class="text-truncate flex-grow-1">
            <span class="h4">All Clients</span>
            <span class="text-primary"></span>
          </div> 
          <div class="input-group input-group-sm w-auto flex-nowrap ms-2">
            <button class="btn btn-sm btn-outline-secondary bt-refresh-clients"><i class="bi bi-arrow-repeat"></i></button>
            <button class="btn btn-sm btn-danger text-nowrap"><i class="bi bi-door-open"></i><i class="bi bi-arrow-right"></i> Disconnect All</button>
          </div>
        </div>
        <div id="all-client-list" class="border rounded flex-fill mt-2 px-1 overflow-y-auto" style="height:0vh;"></div>
      </div>
      <div id="room-section" class="col-4 d-flex flex-column">
        <div class="d-flex px-2">
          <div class="text-truncate flex-grow-1">
            <span class="h4">Room</span>
            <span class="room-name text-primary"></span>
          </div>
          <div class="input-group input-group-sm w-auto flex-nowrap ms-2">
            <button class="btn btn-sm btn-outline-secondary bt-refresh-sockets"><i class="bi bi-arrow-repeat"></i></button>
            <button class="btn btn-sm btn-danger text-nowrap"><i class="bi bi-door-open"></i><i class="bi bi-arrow-right"></i> Disconnect All</button>
          </div>
        </div>
        <!-- <div id="room-drop-zone" class="rounded text-bg-danger p-3 mt-2 text-center float-end"> <i class="bi bi-door-open"></i><i class="bi bi-arrow-right"></i> Leave Room </div> -->
        <div id="room-socket-list" class="border rounded flex-fill mt-2 px-1 overflow-y-auto" style="height:0vh;"></div>
        <div id="room-tools">
          <input type="text" class="input-mapid form-control form-control-sm mt-2" placeholder="" aria-label="Example text with button addon" aria-describedby="button-addon1">
          <div class="btn-group btn-group-sm d-flex flex-nowrap mt-2 mx-auto">
            <button class="btn btn-outline-secondary" disabled><i class="bi bi-send"></i> Send Map</button>
            <button class="bt-push-mapid btn btn-outline-primary text-nowrap" type="button">
              <i class="bi bi-hash"></i> Map ID</button>
            <button class="bt-push-url btn btn-outline-primary text-nowrap" type="button" disabled>
              <i class="bi bi-link-45deg"></i> URL</button>
            <button class="bt-push-file btn btn-outline-primary text-nowrap" type="button" disabled>
              <i class="bi bi-file"></i> File</button>
          </div>
        </div>
      </div>
      <div id="room-list-section" class="col-4 d-flex flex-column">
        <div class="d-flex px-2">
          <div class="text-truncate flex-grow-1">
            <span class="h4">Rooms</span>
            <span class="text-primary"></span>
          </div> 
          <div class="input-group input-group-sm w-auto flex-nowrap ms-2">
            <button class="btn btn-sm btn-outline-secondary bt-refresh-rooms"><i class="bi bi-arrow-repeat"></i></button>
            <input type="text" class="input-room-name form-control border-secondary" placeholder="Room Name" aria-describedby="button-addon1">
            <button class="bt-create-room btn btn-primary text-nowrap" type="button" id="button-addon1">
              <i class="bi bi-plus-lg"></i> Create</button>
          </div>
        </div>
        <div id="all-room-list" class="border rounded flex-fill mt-2 px-1 overflow-y-auto" style="height:0vh;"></div>
        <div id="private-room-list" class="border rounded flex-fill mt-2 px-1 overflow-y-auto" style="height:0vh;"></div>
        <div class="flex-shrink-1 mt-2"><button class="btn btn-sm btn-secondary bt-manage-room"><i class="bi bi-door-open me-1"></i> Room Management</button></div>
      </div>
    </div>
  </div>
  <div class="d-flex">
    <div class="status-panel flex-fill m-2 mt-0 d-flex" style="overflow-x: auto"></div>
    <div class="status-control text-end m-2 mt-0"><button class="btn btn-primary btn-sm opacity-0">&nbsp;</button></div>
  </div>
</div>

<div id="manage-room-dialog" class="d-none bg-white rounded rounded-3 border border-secondary-subtle">
  <div class="d-flex flex-column h-100">
    <div class="d-flex justify-content-between align-items-center m-3 drag-handle">
      <h5 class="d-flex align-items-center m-0"><span>Group Room</span><button class="btn btn-sm btn-outline-primary ms-2 bt-refresh-pair"><i class="bi bi-arrow-repeat"></i></button></h5>
      <button class="btn btn-sm bt-close"><i class="bi bi-x-lg"></i></button>
    </div>
    <!-- <hr> -->
    <ul class="flex-fill list-group list-group-flush pair-list mx-3 overflow-y-auto mb-3">
      <!-- <li class="list-group-item list-group-item-action pair-item d-flex justify-content-between p-0">
        <span class="room-name text-primary"><small contenteditable="true" class="p-2 m-1 d-block editable-room" data-id="">Room A</small></span>
        <span class="room-userid"><span><code contenteditable="true" class="p-2 m-1 d-block editable-userid" data-id="">00000123450000/Djoko</code></span></span>
      </li> -->
    </ul>
    <div class="flex-shrink-1 p-2">
      <form id="form-pair" class="input-group">
        <input type="text" name="pair-userid" aria-label="User ID" class="form-control" placeholder="User ID">
        <input type="text" name="pair-room" aria-label="Room" class="form-control" placeholder="Room">
        <button class="btn btn-primary bt-save-pair"><i class="bi bi-download"></i></button>
      </form>
    </div>
  </div>
</div>