$(() => {
  // jQuery onReady callback
  let app = App.instance();
});

class L {
  static log(action, data, extra, options) {
    Logger.logsc(action, data, extra, options);
  }
  static dataMap(cmid) {
    let map = new Map([["cmid", cmid]]);
    let room = KitBuildCollab?.getPersonalRoom()?.name; // console.log(room);
    if (room) map.set('room', room);
    return map;
  }
  static canvas(dataMap, appCanvas) {
    // Remove attribute of image binary data 
    let attrs = ['image', 'bug'];
    let canvas = appCanvas.cy.elements().jsons(); // console.log(canvas);
    for(let el of canvas) {
      for (let attr of attrs) { // console.log(el, el.data[attr])
        if (el.data.image) delete el.data[attr];
      }
    }
    // console.log(canvas);
    dataMap.set('canvas', Core.compress(canvas));
    return dataMap;
  }
  static proposition(dataMap, appCanvas) {
    let learnerMapData = KitBuildUI.buildConceptMapData(appCanvas);
    let proposition = Analyzer.composePropositions(learnerMapData);
    // console.warn(learnerMapData, proposition);
    dataMap.set('concept', JSON.stringify(appCanvas.cy.elements('node[type="concept"]').jsons()));
    dataMap.set('link', JSON.stringify(appCanvas.cy.elements('node[type="link"]').jsons()));
    dataMap.set('proposition', JSON.stringify(proposition));
    dataMap.set('nc', appCanvas.cy.elements('node[type="concept"]').length);
    dataMap.set('nl', appCanvas.cy.elements('node[type="link"]').length);
    dataMap.set('np', proposition.length);
    return dataMap; 
  }
}

class Timer {
  constructor(element) {
    this.element = element;
    this.startTimestamp = Math.floor(Date.now()/1000);
    this.ts = 0;
    
    this.off();
  }

  on() {
    Timer.interval = setInterval(() => {
      let ts = Math.floor(Date.now()/1000) - this.startTimestamp;
      let duration = App.time(ts);
      $(this.element).html(duration);
      this.ts = ts;
    }, 1000);
    return this;
  }

  off() {
    if (Timer.interval) clearInterval(Timer.interval);
    Timer.interval = null;

    let ts = Math.floor(Date.now()/1000) - this.startTimestamp;
    let duration = App.time(ts);
    $(this.element).html(duration);
    
    return this; 
  }
}

CDM = {};
CDM.cookieid = 'CORESID-mgm__sb';
CDM.options = {};

class App {
  constructor() {
    
    // Main data
    this.fileName;
    this.fileData;
    this.conceptMap;

    this.kbui = KitBuildUI.instance(App.canvasId);
    let canvas = this.kbui.canvases.get(App.canvasId);
    canvas.addToolbarTool(KitBuildToolbar.UNDO_REDO, { priority: 3 });
    canvas.addToolbarTool(KitBuildToolbar.NODE_CREATE, { priority: 2 });
    canvas.addToolbarTool(KitBuildToolbar.UTILITY, { priority: 5 });
    canvas.addToolbarTool(KitBuildToolbar.CAMERA, { priority: 4 });
    // canvas.addToolbarTool(KitBuildToolbar.SHARE, { priority: 6 })
    canvas.addToolbarTool(KitBuildToolbar.LAYOUT, { priority: 7 });
    canvas.toolbar.render();

    canvas.addCanvasTool(KitBuildCanvasTool.DELETE);
    canvas.addCanvasTool(KitBuildCanvasTool.DUPLICATE);
    canvas.addCanvasTool(KitBuildCanvasTool.EDIT);
    canvas.addCanvasTool(KitBuildCanvasTool.SWITCH);
    canvas.addCanvasTool(KitBuildCanvasTool.DISCONNECT);
    canvas.addCanvasTool(KitBuildCanvasTool.CENTROID);
    canvas.addCanvasTool(KitBuildCanvasTool.CREATE_CONCEPT);
    canvas.addCanvasTool(KitBuildCanvasTool.CREATE_LINK);
    canvas.addCanvasTool(KitBuildCanvasTool.IMAGE);
    canvas.addCanvasTool(KitBuildCanvasTool.REMOVE_IMAGE);
    canvas.addCanvasTool(KitBuildCanvasTool.LOCK); // also UNLOCK toggle

    canvas.addCanvasMultiTool(KitBuildCanvasTool.DELETE);
    canvas.addCanvasMultiTool(KitBuildCanvasTool.DUPLICATE);
    canvas.addCanvasMultiTool(KitBuildCanvasTool.LOCK);
    canvas.addCanvasMultiTool(KitBuildCanvasTool.UNLOCK);

    this.resizeTool = new ResizeTool(canvas);
    canvas.toolCanvas.addTool('TOOL_RESIZE', this.resizeTool);
    KitBuildCanvasKonva.instance.addListener(this.resizeTool);

    this.canvas = canvas;

    this.ajax    = Core.instance().ajax();
    this.runtime = Core.instance().runtime();
    this.config  = Core.instance().config();
    this.session = Core.instance().session();
    
    // Enable tooltip;
    $('[data-bs-toggle="tooltip"]').tooltip();

    this.handleEvent();
    this.handleRefresh().then( (sessions) => { console.log(sessions);
      Core.instance().session().getId().then(async (sessid) => {
        sessions.id = sessid
        if (this.config.get('enablecollab')) {
          let collab = await this.startCollab(sessions);
          collab?.connectIfPreviouslyConnected();
          if (sessions.userid) {
            collab?.setData('userid', sessions.userid);
            CDM.userid = sessions.userid;
          }
        }
      });
      
    });

  }

  static instance() {
    App.inst = new App();
    return App.inst;
  }

  setConceptMap(conceptMap = null) {
    console.warn("CONCEPT MAP SET:", conceptMap);
    this.conceptMap = conceptMap;
    if (conceptMap) {
      this.canvas.direction = conceptMap.map.direction;
      let status =
        `<span class="mx-2 d-flex align-items-center status-cmap">` +
        `<span class="badge rounded-pill bg-secondary">ID: ${conceptMap.map.cmid}</span>` +
        `</span>`;
      StatusBar.instance().remove(".status-cmap").append(status);
    } else {
      StatusBar.instance().remove(".status-cmap");
    }
  }

  handleEvent() {

    /**
     * Concept Map reader 
     * */

    const fileInput = $('.file-input');
    const droparea = $('.file-drop-area');
    const deleteButton = $('.item-delete');
    
    fileInput.on('dragenter focus click', () => { droparea.addClass('is-active') });
    fileInput.on('dragleave blur drop', () => { droparea.removeClass('is-active') });
    fileInput.on('change', () => {
      let filesCount = $(fileInput)[0].files.length;
      let textContainer = $(fileInput).prev();
      if (filesCount === 1) {
        let file = $(fileInput)[0].files[0];
        let reader = new FileReader();
        reader.onload = (event) => {
          let content = event.target.result;
          console.log(content);
          let data = App.parseIni(content);
          console.log(data);
          try {
            $('textarea.encoded-data').val(data.conceptMap);
            let conceptMap = Core.decompress(data.conceptMap.replaceAll('"',''));
            console.log(conceptMap);
            CDM.conceptMap = conceptMap;
            CDM.conceptMapId = conceptMap.map.cmid;
          } catch(e) {
            textContainer.html(`<span class="text-truncate d-inline-block me-2 flex-fill">${fileName}</span><span class="badge rounded-pill text-bg-danger fw-bold px-3 py-2">File is invalid.</span>`);
            return;
          }
        };
        // console.log(file);
        reader.readAsText(file);
        let fileName = $(fileInput).val().split('\\').pop();
        textContainer.html(fileName);
        $('.item-delete').css('display', 'inline-block');
      } else if (filesCount === 0) {
        textContainer.text('or drop files here');
        $('.item-delete').css('display', 'none');
      } else {
        textContainer.text(filesCount + ' files selected');
        $('.item-delete').css('display', 'inline-block');
      }
    });
    deleteButton.on('click', () => {
      $('.file-input').val(null);
      $('.file-msg').text('or drop files here');
      $('.item-delete').css('display', 'none');
    });

    /**
     *
     * New Map
     *
     **/

    $(".app-navbar .bt-new").on("click", () => {

      App.newDialog = (new CoreWindow('#concept-map-new-dialog', {
        draggable: true,
        width: '650px',
        closeBtn: '.bt-cancel'
      })).show();
      $('#concept-map-new-dialog .bt-generate-uuid').trigger('click');

      const userid = decodeURIComponent(App.getCookie('userid'));
      if (userid == "undefined") userid = null;
      $('input[name="userid"]').val(userid);
      return;

      let proceed = () => {
        this.canvas.reset();
        App.inst.setConceptMap(null);
        this.fileName = undefined;
        UI.info("Canvas has been reset").show();
        L.log(
          "reset-concept-map",
          this.conceptMap ? this.conceptMap.map.cmid : null
        );
      };
      if (this.canvas.cy.elements().length > 0 || App.inst.conceptMap) {
        let confirm = new CoreConfirm(
          "Discard this map and create a new concept map from scratch?"
        )
          .positive(() => {
            proceed();
            confirm.hide();
            return;
          })
          .show();
        return;
      }
      proceed();
    });

    $('#concept-map-new-dialog .bt-generate-uuid').on('click', e => {
      $('input[name="cmid"]').val(App.uuidv4());
    });

    $('#concept-map-new-dialog .bt-new').on('click', e => {
      e.preventDefault();
      let remember = $('#concept-map-new-dialog input#inputrememberme:checked').val();
      let userid = $('#concept-map-new-dialog input[name="userid"]').val().trim();
      let title = $('#concept-map-new-dialog input[name="title"]').val().trim();
      let cmid = $('#concept-map-new-dialog input[name="cmid"]').val().trim();

      if (!userid) {
        UI.warningDialog("Please enter your name or a user ID.").show();
        return;
      }

      let proceed = () => {
        this.canvas.reset();

        if (remember) Core.instance().cookie().set('userid', userid);
        else Core.instance().cookie().unset('userid');
        App.newDialog.hide();
  
        CDM.conceptMapId = cmid;
        CDM.userid = userid;
        CDM.title = title;
        Logger.userid = CDM.userid;

        console.log(CDM);
        this.session.set('map', {
          cmid: cmid,
          title: title
        });
        this.session.set('userid', userid);
  
        let canvasJsons = this.canvas.cy.elements().jsons();
        let dataMap = new Map([
          ['cmid', CDM.conceptMapId],
          ['canvas', Core.compress(canvasJsons)]
        ]);
        App.inst.session.regenerateId().then(sessid => {
          Logger.sessid = App.getCookie(CDM.cookieid);
          Logger.seq = 1;
          L.log("new-concept-map", CDM.conceptMapId, dataMap);
        });
  
        App.timer = new Timer('.app-navbar .timer');
        App.timer.on();
        App.lastFeedback = App.timer.ts;

        UI.info("Canvas has been reset").show();
        this.enable();
        // L.log("reset-concept-map", CDM.conceptMapId);
      };

      if (this.canvas.cy.elements().length > 0) {
        UI.confirm('Create a new concept map from scratch?').positive(e => {
          // this.canvas.cy.elements().remove();
          proceed();
        }).show();
      } else proceed();



    });


    /**
     * Save Load Concept Map
     * */

    $(".app-navbar").on("click", ".bt-save", async () => {

      // console.log(CDM); return;
      // if(!CDM.kit) new CoreDialog('Please open a kit').show();

      // let {d, lmapdata} = this.buildLearnerMapData(); // console.log(canvas);
      // data.id = CDM.kit.map.id;
      
      // save to database
      const saveResult = await this.saveMap('draft');
      let dataMap = L.dataMap(CDM.conceptMapId);
      L.canvas(dataMap, this.canvas);
      L.proposition(dataMap, this.canvas);
      L.log('save-draft', saveResult, dataMap);

      // save to session
      let data = {};
      data.cmid = CDM.conceptMapId;
      data.userid = CDM.userid;
      data.title = CDM.title;
      data.data = this.canvas.cy.elements().jsons();
      data.sessid = App.getCookie(CDM.cookieid);
      // console.warn(data);
      this.session.set('draft-map', Core.compress(data)).then((result) => {
        // console.warn(result);
        UI.success("Concept map has been saved successfully.").show();
        let dataMap = L.dataMap(CDM.conceptMapId);
        L.canvas(dataMap, App.inst.canvas);
        L.proposition(dataMap, App.inst.canvas);
        L.log('save-draft', {
          id: data.id,
          cmid: data.cmid,
          userid: data.userid,
          sessid: data.sessid
        }, dataMap);
      });
    });
    $(".app-navbar").on("click", ".bt-load", () => {

      // if(!CDM.kit) new CoreDialog('Please open a kit').show();
      this.session.get('draft-map').then(result => {
        let lmapdata = Core.decompress(result);

        console.warn(lmapdata, App.getCookie(CDM.cookieid));

        CDM.title = lmapdata.title?.length > 0 ? lmapdata.title : CDM.title;
        // CDM.conceptMapId = lmapdata.cmid;

        if (!lmapdata.data) {
          UI.error('Invalid data.').show();
          return;
        }
        if(lmapdata.userid != CDM.userid) {
          UI.error('Invalid draft.').show();
          return;
        }

        UI.confirm('Replace current concept map with the saved one?')
          .positive(e => {
            // console.log(lmapdata);
            // lmapdata.data.canvas.conceptMap = CDM.conceptMap.canvas;
            // let lmap = KitBuildUI.composeLearnerMap(lmapdata.data.canvas);
            // console.log(lmap);
            this.canvas.cy.elements().remove();
            this.canvas.cy.add(lmapdata.data);
            this.canvas.applyElementStyle();
            this.canvas.toolbar.tools
              .get(KitBuildToolbar.CAMERA)
              .fit(null, { duration: 0 });
            KitBuildUI.showBackgroundImage(this.canvas);

            let sessid = App.getCookie(CDM.cookieid); 
            // console.log(sessid, lmapdata.sessid);

            let dataMap = L.dataMap(CDM.conceptMapId);
            L.canvas(dataMap, App.inst.canvas);
            L.proposition(dataMap, App.inst.canvas);
            L.log('load-draft', {
              sessid: sessid,
              psessid: lmapdata.sessid,
              pcmid: lmapdata.cmid
            }, dataMap);

            this.generateMapState()
              .then(mapState => { // console.log(mapState);
                // console.log(mapState, CDM.room);
                App.collab.send("push-map-state", mapState, CDM.room);
                let dataMap = L.dataMap(CDM.kitId, CDM.conceptMapId, CDM.room);
                L.canvas(dataMap, App.inst.canvas);
                // L.compare(dataMap, App.inst.canvas, CDM.conceptMap?.canvas);
                L.log("send-map-state", {requesterSocketId: requesterSocketId}, dataMap);
              });
            // App.lastFeedback = App.timer.ts;
          }).show();
      });
    });



    // $(".app-navbar .bt-save").on("click", () => {
    //   if (!this.conceptMap) {
    //     (new CoreInfo('Please open a concept map to save')).show();
    //     return;
    //   }
    //   // console.log(this.conceptMap);
    //   $('input[name="fid"]').val(this.conceptMap.map.id);
    //   $('input[name="title"]').val(this.conceptMap.map.title);
    //   let mapdata = {};
    //   mapdata.canvas = KitBuildUI.buildConceptMapData(this.canvas);
    //   mapdata.map = {
    //     cmid: this.conceptMap.map.cmid,
    //     direction: this.canvas.direction,
    //   };
    //   let data = {
    //     id: this.conceptMap.map.cmid,
    //     title: this.conceptMap.title,
    //     data: Core.compress(mapdata)
    //   }; // console.log(data, mapdata);
    //   // return;
    //   (new CoreConfirm("Save concept map?")).positive(() => {
    //     this.ajax.post('m/x/kb/kitBuildApi/save', data).then(conceptMap => { 
    //       // console.warn(conceptMap);
    //       conceptMap = Object.assign(conceptMap, Core.decompress(conceptMap.data));
    //       new CoreInfo('Concept map has been saved.').show();
    //       this.setConceptMap(conceptMap);
    //       // App.saveAsDialog.hide();
    //     }, error => {
    //       new CoreError(`An error has occurred. ${error}`).show();
    //       console.error(error);
    //     });
    //   }).show();
    // });

    // $(".app-navbar .bt-save-as").on("click", (e) => {
    //   if (this.canvas.cy.elements().length == 0) {
    //     UI.warning("Nothing to save. Canvas is empty.").show();
    //     return;
    //   }
    //   (new CoreConfirm("Save concept map on a new file?")).positive((e) => {
    //     let data = {};
    //     data.canvas = KitBuildUI.buildConceptMapData(this.canvas);
    //     data.map = {
    //       cmid: App.uuidv4(),
    //       direction: this.canvas.direction,
    //     };
    //     data.fileName = null;

    //     App.saveAsDialog = (new CoreWindow('#concept-map-save-as-dialog', {
    //       draggable: true,
    //       width: '650px',
    //       // height: '600px',
    //       closeBtn: '.bt-cancel'
    //     })).show();
    //   }).show();
    // });

    // $('#concept-map-save-as-dialog').on('click', '.bt-generate-fid', () => {
    //   $('input[name="fid"]').val(App.uuidv4);
    // });
    // $('#concept-map-save-as-dialog').on('click', '.bt-save', () => {
    //   let mapdata = {};
    //   mapdata.canvas = KitBuildUI.buildConceptMapData(this.canvas);
    //   mapdata.map = {
    //     cmid: $('input[name="fid"]').val(),
    //     direction: this.canvas.direction,
    //   };
    //   let data = {
    //     id: $('input[name="fid"]').val(),
    //     title: $('input[name="title"]').val(),
    //     data: Core.compress(mapdata)
    //   }; // console.log(data); 
    //   this.ajax.post('m/x/kb/kitBuildApi/save', data).then(conceptMap => { 
    //     if (conceptMap) { 
    //       conceptMap = Object.assign(conceptMap, Core.decompress(conceptMap.data));
    //       this.setConceptMap(conceptMap);
    //     } 
    //     // console.warn(conceptMap);
    //     new CoreInfo('Concept map has been saved.').show();
    //     App.saveAsDialog.hide();
    //   }, error => {
    //     new CoreError(`An error has occurred. ${error}`).show();
    //     console.error(error);
    //   });
    // });

    /**
     *
     * Open
     *
     **/

    // $(".app-navbar .bt-open").on("click", (e) => { // console.log(e);
    //   App.dialogOpen = (new CoreWindow('#concept-map-open-dialog', {
    //     draggable: true,
    //     width: '650px',
    //     height: '600px',
    //     closeBtn: '.bt-cancel'
    //   })).show();
    //   $('.bt-refresh-cmap-list').trigger('click');
    // });
    // $('.bt-refresh-cmap-list').on('click', (e) => {
    //   this.ajax.get(`m/x/kb/kitBuildApi/searchConceptMaps/`).then(cmaps => { // console.log(cmaps)
    //     let conceptMapsHtml = '';
    //     cmaps.forEach(t => { // console.log(t);
    //       conceptMapsHtml += `<span class="cmap list-item" data-cmid="${t.id}">`
    //        + `<span class="d-flex align-items-center">`
    //        + `<span class="text-truncate" style="font-size:0.9rem">${t.title}</span> <code class="bg-danger-subtle rounded mx-2 px-2 text-danger">${t.id}</code> <span class="badge text-bg-warning">${t.created}</span></span>`
    //        + `<i class="bi bi-check-lg text-primary d-none"></i></span>`
    //     });
    //     $('#concept-map-open-dialog .list-concept-map').slideUp({
    //       duration: 100,
    //       complete: () => {
    //         $('#concept-map-open-dialog .list-concept-map .list-item').not('.default').remove();
    //         $('#concept-map-open-dialog .list-concept-map').append(conceptMapsHtml).slideDown({
    //           duration: 100,
    //           complete: () => {
    //             if (this.conceptMap && this.conceptMap.map) {
    //               // console.log(this.conceptMap);
    //               $(`#concept-map-open-dialog .list-concept-map .list-item[data-cmid="${this.conceptMap.map.cmid}"]`).trigger('click');
    //             }
    //           }
    //         });
    //         $('#concept-map-open-dialog .list-kit').html('');
    //         delete App.dialogOpen.kid;
    //       }
    //     });
    //   });
    // });
    // $('#concept-map-open-dialog .list-concept-map').on('click', '.list-item', (e) => {
    //   let cmid = $(e.currentTarget).attr('data-cmid');
    //   App.dialogOpen.cmid = cmid;
    //   $('#concept-map-open-dialog .list-concept-map .list-item').removeClass('active');
    //   $('#concept-map-open-dialog .list-concept-map .bi-check-lg').addClass('d-none');
    //   $(e.currentTarget).addClass('active').find('i.bi-check-lg').removeClass('d-none');
    // });
    // $("#concept-map-open-dialog").on("click", ".bt-paste", async (e) => {
    //   let encoded = await navigator.clipboard.readText();
    //   $('#decode-textarea').val(encoded);
    // });
    // $("#concept-map-open-dialog").on("click", ".bt-open", async (e) => {
    //   if (App.dialogOpen.cmid) {
    //     this.ajax.get(`m/x/kb/kitBuildApi/openConceptMap/${App.dialogOpen.cmid}`).then(conceptMap => { 
    //       // console.log(conceptMap);
    //       conceptMap = Object.assign(conceptMap, this.decodeMap(conceptMap.data));
    //       this.setConceptMap(conceptMap);
    //       this.showConceptMap(conceptMap);
    //       App.dialogOpen.hide();
    //     });
    //     return;
    //   }
    //   this.decodeMap(App.dialogOpen, $('#decode-textarea').val());
    // });

    /**
     *
     * Export
     * 
     **/

    $(".app-navbar .bt-export").on("click", (e) => {
      // console.log(this.conceptMap);
      let data = {};
      data.canvas = KitBuildUI.buildConceptMapData(this.canvas);
      data.map = {
        cmid: this.conceptMap ? this.conceptMap.map.cmid : App.uuidv4(),
        direction: this.canvas.direction,
      };
      // console.log(data);
      $("#concept-map-export-dialog .encoded-data").val(
        `conceptMap=${Core.compress(data)}`
      );
      App.dialogExport = (new CoreWindow('#concept-map-export-dialog', {
        draggable: true,
        width: '650px',
        height: '600px',
        closeBtn: '.bt-cancel'
      })).show();
    });

    $("#concept-map-export-dialog").on("click", ".bt-clipboard", async (e) => { // console.log(e);
      navigator.clipboard.writeText($("#concept-map-export-dialog .encoded-data").val().trim());
      $(e.currentTarget).html('<i class="bi bi-clipboard"></i> Data has been copied to Clipboard!');
      setTimeout(() => {
        $(e.currentTarget).html('<i class="bi bi-clipboard"></i> Copy to Clipboard');
      }, 3000);
      let dataMap = L.dataMap(CDM.conceptMapId);
      L.canvas(dataMap, App.inst.canvas);
      L.proposition(dataMap, App.inst.canvas);
      L.log('concept-map-export', {duration: App.timer.ts}, dataMap);
    });

    $("#concept-map-export-dialog").on("click", ".bt-download-cmap", async (e) => { // console.log(e);
      let cmapdata = $("#concept-map-export-dialog .encoded-data").val().trim();
      App.download(`${CDM.conceptMapId ?? 'untitled'}.cmap`, cmapdata);
      let dataMap = L.dataMap(CDM.conceptMapId);
      L.canvas(dataMap, App.inst.canvas);
      L.proposition(dataMap, App.inst.canvas);
      L.log('concept-map-download-cmap', {duration: App.timer.ts}, dataMap);
    });

    /**
     *  
     * Import
     *
     **/  

    $(".app-navbar .bt-import").on("click", (e) => {
      App.dialogImport = UI.modal('#concept-map-import-dialog', {
        backdrop: false,
        draggable: true,
        width: '650px',
        hideElement: '.bt-cancel'
      }).show();
    });

    $("#concept-map-import-dialog").on("click", ".bt-paste", async (e) => {
      let encoded = await navigator.clipboard.readText();
      $('#concept-map-import-dialog .encoded-data').val(encoded);
    });

    $('#concept-map-import-dialog').on('click', '.bt-selective-import', async (e) => {

      try {
        const data = $('#concept-map-import-dialog .encoded-data').val().trim();
        const parsedData = App.parseIni(data);
        const conceptMap = this.decodeMap(parsedData.conceptMap ? parsedData.conceptMap : data);
        const propositions = App.buildPropositions(conceptMap.canvas);
        App.dialogImport.propositions = propositions;
        // console.log(data, parsedData, conceptMap, propositions);
  
        let propHtml = ``;
        propositions.forEach((prop, key) => {
          propHtml += `<div class="form-check">`;
          propHtml += `  <input class="form-check-input" type="checkbox" value="${key}" id="prop-${key}" checked>`;
          propHtml += `  <label class="form-check-label" for="prop-${key}">`
          propHtml += `    <span class="badge badge-pill text-bg-warning">`;
          propHtml += `    ${prop.source?.label}`;
          propHtml += `    </span>`;
          propHtml += `    <span class="badge badge-pill text-bg-light">`;
          propHtml += `    ${prop.link?.label}`;
          propHtml += `    </span>`;
          propHtml += `    <span class="badge badge-pill text-bg-warning">`;
          propHtml += `    ${prop.target?.label}`;
          propHtml += `    </span>`;
          propHtml += `  </label>`;
          propHtml += `</div>`;
        });
  
        $('#concept-map-selective-import-dialog .prop-list').html(propHtml);
  
        App.dialogSelectiveImport = UI.modal('#concept-map-selective-import-dialog', {
          backdrop: false,
          draggable: true,
          dragHandle: '.handle',
          width: '600px',
          height: '300px',
          hideElement: '.bt-cancel'
        }).show();
      } catch (error) { 
        console.error(error);
        UI.errorDialog('Invalid file or data').show(); 
      }
    });

    $('#concept-map-selective-import-dialog .bt-toggle-selected').on('click', () => {
      const cbs = $('#concept-map-selective-import-dialog .prop-list input[type="checkbox"]');
      // console.log(cbs);
      cbs.each((idx, cb) => { // console.log(idx, cb);
        const checked = $(cb).prop('checked');
        console.log(checked);
        $(cb).prop('checked', !checked);
      });
    });

    $('#concept-map-selective-import-dialog .bt-import-selected').on('click', () => {
      const cbs = $('#concept-map-selective-import-dialog .prop-list input[type="checkbox"]:checked');
      const selectedProps = new Map();
      cbs.each((idx, cb) => { // console.log(idx, cb);
        const key = $(cb).val();
        selectedProps.set(key, App.dialogImport?.propositions?.get(parseInt(key)));
      });
      // console.log(selectedProps);
      if (selectedProps.size == 0) {
        UI.dialog('Nothing to import').show();
        return;
      }
      const confirm = UI.confirm(
        `Do you want to import ${selectedProps.size} selected proposition(s) to your concept map?`
      ).positive(async () => {
        confirm.hide();

        this.importPropositions(selectedProps);
        // await this.saveMap('submission');
        // confirm.hide();
        // UI.dialog('Your concept map has been submitted.').show();
      }).negative(() => {}).show();
    });

    $('#concept-map-import-dialog').on("click", ".bt-decode", async (e) => {
      try {
        let data = $('#concept-map-import-dialog .encoded-data').val().trim();
        let parsedData = App.parseIni(data);
        // console.log(data, parsedData);
        let conceptMap = this.decodeMap(parsedData.conceptMap ? parsedData.conceptMap : data);
        let prevMap = Core.compress(this.canvas.cy.elements().jsons());
        // console.log(conceptMap, prevMap);
        let proceed = () => {
          this.showConceptMap(conceptMap);
          this.canvas.cy.elements('node[type="link"]').data('limit', 9);
          App.dialogImport.hide();
          let dataMap = L.dataMap(CDM.conceptMapId);
          L.canvas(dataMap, App.inst.canvas);
          L.proposition(dataMap, App.inst.canvas);
          L.log('concept-map-import', {
            prevMap: prevMap,
            nextMap: Core.compress(this.canvas.cy.elements().jsons())
          }, dataMap);
        }
        // console.log(this.canvas.cy.elements());
        if (this.canvas.cy.elements().length > 0) {
          (UI.confirm('Do you want to replace current concept map in canvas?')).positive(() => {
            proceed();
          }).show();
        } else proceed();
      } catch (error) { 
        console.error(error);
        UI.errorDialog('Invalid file or data').show(); 
      }
    });
  
    /**
     * 
     * Compose Kit
     * 
     **/

    $(".app-navbar").on("click", ".bt-compose-kit", () => {
      if (!this.conceptMap) {
        new CoreInfo('Please save your concept map before composing a kit.').show();
        return;
      }
      new CoreConfirm('Save the concept map and begin composing a kit for this concept map?')
        .positive(() => {
          // console.log(this.fileData);
          let data = Core.decompress(this.fileData.conceptMap);
          data.canvas = KitBuildUI.buildConceptMapData(this.canvas);
          data.fileName = this.fileName;
          // api.saveFileAsSilent(data);
        })
        .show();
    });

    /**
     *
     * Submit
     */
    $(".app-navbar").on("click", ".bt-submit", () => {
      let confirm = UI.confirm(
        "Do you want to submit your concept map?"
      ).positive(async () => {
        await this.saveMap('submission');
        confirm.hide();
        UI.dialog('Your concept map has been submitted.').show();
      }).show();
    });

    $(".app-navbar").on("click", ".bt-finalize", () => {
      let confirm = UI.confirm(
        "Do you want to finalize your concept map?"
      ).positive(async () => {
        await this.saveMap('finalized');
        confirm.hide();
        UI.dialog('Your concept map has been finalized.').show();
      }).show();

      // console.warn(CDM);
      // let data = {
      //   id: CDM.conceptMapId,
      //   userid: CDM.userid,
      //   title: CDM.title,
      //   type: 'finalized',
      //   data: Core.compress(this.canvas.cy.elements().jsons())
      // };
      // // console.log(data);
      // confirm.hide();
      // // return;
      // this.ajax
      //   .post("mapApi/saveScratchMap", data)
      //   .then(map => { // console.log(map);
      //     data.id = map.id;
      //     data.created = map.created;
      //     data.logcmid = CDM.conceptMapId;
      //     // data.duration = App.timer.ts;
      //     let dataMap = L.dataMap(CDM.conceptMapId);
      //     L.canvas(dataMap, this.canvas);
      //     L.proposition(dataMap, this.canvas);
      //     L.log('finalized', data, dataMap);
      //     UI.dialog('Your concept map has been finalized.').show();
      //   }).catch((error) => {
      //     console.error(error);
      //   });
      // }).show();
    });

    /**
     * 
     * Data Generator: for Gakuto
     * 
     **/

    $(".app-navbar").on("click", ".bt-data-gen", () => {
      // api.openDataGenerator();
    });

    /*
    *
    * Electron API
    * 
    */

    // api.saveFileAsCancelled((e, result) => {
    //   // console.log(e, result);
    //   UI.info("Save cancelled.").show();
    // });

    // api.saveFileAsResult((e, data, fileName, fileData) => {
    //   // console.log(e, data, fileName, fileData);
    //   if(data) new CoreInfo('Save successful.').show();
    //   else new CoreInfo('Save error.').show();
    //   this.fileName = fileName;
    //   this.fileData = fileData;
    // });

    // api.saveFileAsResultSilent((e, data, fileName, fileData) => {
    //   // console.log(e, data, fileName, fileData);
    //   api.composeKit(fileName);
    // }); 

    // api.openFileResult((e, data) => {
    //   // console.log(e, data);
    //   this.fileName = data.fileName;
    //   delete data.fileName;
    //   this.fileData = data;
    //   this.decodeMap(importDialog, data.conceptMap);
    // });

    // api.openFileCancelled((e, data) => {
    //   // console.warn(e, data, "Open file cancelled.");
    //   UI.warning('Open file cancelled').show();
    // });

    $('.bt-test').on('click', (e) => {

    });

  }

  importPropositions(selectedProps) {

    console.log(selectedProps);

    const concepts = new Map();
    const links = new Map();

    selectedProps.forEach(async (prop, index) => {
      concepts.set(prop.source?.cid, prop.source);
      concepts.set(prop.target?.cid, prop.target);
      prop.link.source = concepts.get(prop.link?.source_cid);
      prop.link.target = concepts.get(prop.target?.cid);
      // links.set(prop.link?.lid + "-" + prop.source?.cid, prop.link);
    });

    const getConcept = (label = '') => {
      for(let [idx, concept] of concepts) {
        // console.log("Comparing:", concept, concept.label, label);
        if (concept.label == label) {
          // console.log("Found!", concept);
          return concept;
        }
      }
      return null;
    }

    console.log(concepts, links);

    concepts.forEach(async (concept) => {
      if (this.canvas.cy.elements(`node[label="${concept.label}"]`).size() == 0) {
        let data = null;
        try {
          data = JSON.parse(concept.data);
        } catch (error) { }
        // console.log("Prop data:", data);
        conceptNode = await this.canvas.createNode({
          type: 'concept',
          label: concept.label,
          color: data?.color ?? null, // optional
          position: {
            x: concept.x,
            y: concept.y,
          }
        });
      }
    });

    selectedProps.forEach(async (prop) => {
      const link = prop.link;
      const source = prop.link.source;
      const target = prop.link.target;
      console.log("Processing proposition:", link, link.source.label, link.label, link.target.label);


      const sourceConcept = getConcept(link.source.label);
      const targetConcept = getConcept(link.target.label);
      // const linkExists = this.canvas.cy.elements(`node[label="${link.label}"][sourceLabel="${source.label}"]`).size() > 0;
      // console.log("Link Exists", this.canvas.cy.elements(`node[label="${link.label}"]`), linkExists);

      let ls = this.canvas.cy.elements(`node[label="${link.label}"]`)
      let lsf = ls.filter((ele, i, eles) => {
        // let data = ele.data();
        // console.warn(data, data.sourceLabel);
        // console.log(ele, ele.data(), ele.data('sourceLabel') == source.label);
        return ele.data('sourceLabel') == source.label;
      });
      // console.log(source.label, ls, lsf, ls.size(), lsf.size());

      if (lsf.size() == 0) { // means it does not exists
        let data = null;
        try { data = JSON.parse(link.data); } catch (error) { }
        // console.log("AAAAAAA");
        // console.log("Prop data:", data);
        let dataMap = new Map();
        dataMap.set('sourceLabel', source.label);
        let linkNode = await this.canvas.createNode({
          type: 'link',
          label: link.label,
          color: data?.color ?? null, // optional
          position: {
            x: link.x,
            y: link.y,
          }
        }, dataMap);
        // linkNode.data('sourceLabel', source.label);
        // linkNode.data('targetLabel', target.label);
        let scid = 
          await this.canvas?.cy?.elements(`node[type="concept"][label="${source.label}"]`).data('id');
        await this.canvas?.createEdge({
          source: link?.lid,
          target: scid,
          type: 'left'
        });
      }

      // let links = 
      //   this.canvas?.cy?.elements(`node[type="link"][label="${link.label}"]`);

      // console.log(links);

      // console.log("Source", sourceConcept, "Target", targetConcept);
      // let tcid = 
      //     this.canvas?.cy?.elements(`node[type="concept"][label="${target.label}"]`).data('id');
      // this.canvas?.createEdge({
      //   source: link?.lid,
      //   target: tcid,
      //   type: 'right'
      // });
    });

    // selectedProps.forEach(async (prop, index) => {
    //   console.log(`Prop ${index}`, prop);
    //   let source = null, link = null, target = null;
    //   if (this.canvas.cy.elements(`node[label="${prop.source?.label}"]`).size() > 0) {
    //     source = this.canvas.cy.elements(`node[label="${prop.source?.label}"]`)[0];
    //     console.log("Source Exists", source);
    //   } else {
    //     let data = null;
    //     try {
    //       data = JSON.parse(prop.data);
    //     } catch (error) { }
    //     console.log("Prop data:", data);
    //     source = await this.canvas.createNode({
    //       type: 'concept',
    //       label: prop.source?.label,
    //       color: data?.color ?? null, // optional
    //       position: {
    //         x: prop.source?.x,
    //         y: prop.source?.y,
    //       }
    //     });
    //   }
    //   if (this.canvas.cy.elements(`node[label="${prop.target?.label}"]`).size() > 0) {
    //     target = this.canvas.cy.elements(`node[label="${prop.target?.label}"]`)[0];
    //     console.log("Target Exists", source);
    //   } else {
    //     let data = null;
    //     try {
    //       data = JSON.parse(prop.data);
    //     } catch (error) { }
    //     console.log("Prop data:", data);
    //     target = await this.canvas.createNode({
    //       type: 'concept',
    //       label: prop.target?.label,
    //       color: data?.color ?? null, // optional
    //       position: {
    //         x: prop.source?.x,
    //         y: prop.source?.y,
    //       }
    //     });
    //   }

    // });
  }

  saveMap(type = 'draft') {
    return new Promise((resolve, reject) => {
      if (!CDM.userid) reject('Invalid CDM user ID: userid');
      if (!CDM.title) reject('Invalid CDM concept map title: title.');
      if (!CDM.conceptMapId) reject('Invalid CDM concept map id: conceptMapId.');

      // console.warn(App.collab.data.get('userid'));
      // CDM.userid = App.collab.getData('userid');
      let data = {
        id: CDM.conceptMapId,
        userid: CDM.userid,
        title: CDM.title,
        type: type, // 'draft'
        data: Core.compress(this.canvas.cy.elements().jsons())
      };
      console.log(data);
      // confirm.hide();
      // return;
      this.ajax
        .post("mapApi/saveScratchMap", data)
        .then(map => {
          data.id = map.id;
          data.created = map.created;
          data.logcmid = CDM.conceptMapId;
          // data.duration = App.timer.ts;
          resolve(data);
        }).catch((error) => console.error(error));
    });
    
  }

  // decodeMap(importDialog, data) {
  //   try {
  //     let conceptMap = Core.decompress(data.replaceAll('"',''));
  //     console.warn(conceptMap);
  //     if (typeof conceptMap == "string")
  //       conceptMap = JSON.parse(conceptMap);
  //     // console.log(res);
  //     // console.log(JSON.parse(conceptMap));
  //     Object.assign(conceptMap, {
  //       cyData: KitBuildUI.composeConceptMap(conceptMap.canvas),
  //     });
  //     // KitBuildUI.composeConceptMap(conceptMap);
  //     // console.log(conceptMap);
  //     let proceed = () => {
  //       App.inst.setConceptMap(conceptMap);
  //       this.canvas.cy.elements().remove();
  //       this.canvas.cy.add(conceptMap.cyData);
  //       this.canvas.applyElementStyle();
  //       this.canvas.toolbar.tools
  //         .get(KitBuildToolbar.CAMERA)
  //         .fit(null, { duration: 0 });
  //       this.canvas.toolbar.tools
  //         .get(KitBuildToolbar.NODE_CREATE)
  //         .setActiveDirection(conceptMap.map.direction);
  //       this.canvas.toolCanvas.clearCanvas().clearIndicatorCanvas();
  //       KitBuildUI.showBackgroundImage(this.canvas);
  //       UI.success("Concept map loaded.").show();
  //       L.log("open-concept-map", conceptMap.map, null, {
  //         cmid: conceptMap.map.cmid,
  //         includeMapData: true,
  //       });
  //       importDialog.hide();
  //     };
  //     if (this.canvas.cy.elements().length) {
  //       let confirm = new CoreConfirm(
  //         "Do you want to open and replace current concept map on canvas?"
  //       ).positive(() => {
  //           confirm.hide();
  //           proceed();
  //         }).show();
  //     } else
  //       proceed();
  //   } catch (error) {
  //     console.error(error);
  //     new CoreInfo("The concept map data is invalid.", {
  //       icon: "exclamation-triangle",
  //       iconStyle: "danger",
  //     }).show();
  //   }
  // }

  showConceptMap(conceptMap) {
    // App.inst.setConceptMap(conceptMap);
    this.canvas.cy.elements().remove();
    this.canvas.cy.add(conceptMap.cyData);
    this.canvas.applyElementStyle();
    this.canvas.toolbar.tools
      .get(KitBuildToolbar.CAMERA)
      .fit(null, { duration: 0 });
    this.canvas.toolbar.tools
      .get(KitBuildToolbar.NODE_CREATE)
      .setActiveDirection(conceptMap.map.direction);
    this.canvas.toolCanvas.clearCanvas().clearIndicatorCanvas();
    KitBuildUI.showBackgroundImage(this.canvas);
  }

  decodeMap(data, dialog) {
    try {
      // console.log(data, typeof data);
      let conceptMap = (typeof data != 'object') ? Core.decompress(data.replaceAll('"','')) : data;
      // console.log(data, conceptMap);
      Object.assign(conceptMap, {
        cyData: KitBuildUI.composeConceptMap(conceptMap.canvas),
      });
      // KitBuildUI.composeConceptMap(conceptMap);
      // console.log(conceptMap);
      return conceptMap;
    } catch (error) {
      console.error(error);
      new CoreInfo("The concept map data is invalid.", {
        icon: "exclamation-triangle",
        iconStyle: "danger",
      }).show();
    }
  }

  disable() {
    $('.app-navbar button').prop('disabled', true);
    $('.app-navbar button.bt-new').prop('disabled', false);
    this.canvas.toolbar.tools.get(KitBuildToolbar.UNDO_REDO).disable();
    this.canvas.toolbar.tools.get(KitBuildToolbar.NODE_CREATE).disable();
    this.canvas.toolCanvas.tools.get("create-concept").disable();
    this.canvas.toolCanvas.tools.get("create-link").disable();
  }
  
  enable() {
    $('.app-navbar button').prop('disabled', false);
    this.canvas.toolbar.tools.get(KitBuildToolbar.UNDO_REDO).enable();
    this.canvas.toolbar.tools.get(KitBuildToolbar.NODE_CREATE).enable();
    this.canvas.toolCanvas.tools.get("create-concept").enable();
    this.canvas.toolCanvas.tools.get("create-link").enable();
  }

  handleRefresh() {
    
    this.disable();
    return new Promise((resolve, reject) => {
      this.session.getAll().then((sessions) => {
        Logger.userid = sessions.userid;
        Logger.sessid = App.getCookie(CDM.cookieid);
        Logger.canvasid = App.canvasId;
        this.canvas.on("event", App.onCanvasEvent);
        resolve(sessions);
        console.log(sessions, document.cookie);
        console.log(Logger.userid, Logger.sessid);  

        // restoring CDM data for concept mapping
        if (sessions.userid) CDM.userid = sessions.userid;
        if (sessions.map?.title) CDM.title = sessions.map.title;
        if (sessions.map?.cmid) CDM.conceptMapId = sessions.map.cmid;

        // if userid and cmid are available, enable concept mapping UI
        if (CDM.userid && CDM.conceptMapId) this.enable();
        // verify CDM contents
        // console.log(CDM);
      });
    });

  }

  generateMapState() {
    return new Promise((resolve, reject) => { // console.log(CDM);
      let mapState = {
        kit: CDM.kit,
        conceptMap: CDM.conceptMap,
        cyData: this.canvas.cy.elements().jsons()
      };
      resolve(mapState)
    })
  }

  applyMapState(mapState){ console.log(mapState);
    return new Promise((resolve, reject) => {
      let kit = mapState.kit;
      let cyData = mapState.cyData;
      let conceptMap = mapState.conceptMap;
      if (!cyData) {
        console.warn('Invalid cyData: ', cyData);
        return;
      }
      // if (!kit) {
      //   console.warn('Invalid kit: ', kit);
      //   return;
      // }
      // if (!conceptMap) {
      //   console.warn('Invalid conceptMap: ', conceptMap);
      //   return;
      // }

      // CDM.kit = kit;
      // CDM.kitId = kit.map.id;
      // CDM.conceptMapId = kit.map.cmid;
      // CDM.conceptMap = conceptMap;

      this.canvas.cy.elements().remove();
      this.canvas.cy.add(cyData ? cyData : {}).unselect();
      this.canvas.applyElementStyle();
      // this.canvas.toolbar.tools.get(KitBuildToolbar.NODE_CREATE)
      //   .setActiveDirection(conceptMap.map.direction)
      this.canvas.toolbar.tools.get(KitBuildToolbar.CAMERA).fit(null, {duration: 0});
      this.canvas.toolbar.tools.get(KitBuildToolbar.UNDO_REDO).clearStacks().updateStacksStateButton();
      this.canvas.toolCanvas.clearCanvas().clearIndicatorCanvas();
      // this.canvas.toolCanvas.tools
      //   .get(KitBuildCanvasTool.DISTANCECOLOR)
      //   .setConceptMap(CDM.conceptMap.canvas);
      this.canvas.cy.remove('#VIRTUAL');
      resolve(mapState);
    });
  }  

  async startCollab(session = null) { console.log(session);
    App.collab = await KitBuildCollab.instance('cmap', this.canvas, {
      host: this.config.get('collabhost'),
      port: this.config.get('collabport'),
      path: this.config.get('collabpath'),
      listener: this.onCollabEvent.bind(this),
      session: session
    }); // console.log(App.collab);
    if (session?.mapid)
      await App.collab?.setData('mapid', session.mapid);
    if (session?.userid)
      await App.collab?.setData('userid', session.userid);
    KitBuildCollab.enableControl();
    return App.collab;
  }

    // Collab Server --> App
  async onCollabEvent(e, ...data) { console.warn("Consuming collaboration event:", e, data);
    switch(e) {
      case 'reconnected':
      case 'connected':
        // check id from cookie
        let userid = decodeURIComponent(App.getCookie('userid')); console.log("Cookie", userid);
        if (userid == null || userid == "null" || userid == "undefined") {
          userid = decodeURIComponent(App.collab?.getCollabId()); console.log("Collab", userid);
        }
        console.log("Set", userid);
        if (userid != null && userid != "null" && userid != "undefined") {
          // console.log(userid);
          // console.log(Core.instance().cookie());
          Core.instance().cookie().set('userid', userid);
          // .then((e)=> console.log(e, userid));
          App.collab?.registerUser(userid);
          CDM.userid = userid;
          Logger.userid = userid;
          this.session.set('userid', userid);
        }
        let dataMap = L.dataMap(null, null, CDM.room);
        L.log(e, userid, dataMap);
        break;
      case 'socket-disconnect':
      case 'disconnect': {
        L.log(e);
      } break;
      case 'join-room': {
        let room = data.shift();
        CDM.room = room;
        let dataMap = L.dataMap(null, null, CDM.room);
        L.log("join-room", room, dataMap);
      } break;
      case 'user-unregistered': {
        let user = data.shift();
        App.removeCookie('userid');
        // Core.instance().cookie().unset('userid');
        L.log(e, user);
      } break;
      case 'socket-command': {
        let command = data.shift();
        switch(command) {
          case 'push-map-state':
            this.applyMapState(data.shift());
            let dataMap = L.dataMap(CDM.kitId, CDM.conceptMapId, CDM.room);
            L.log("socket-push-map-state", CDM.room, dataMap);
            break;
          case 'reset': {
            App.openKit(CDM.kit, CDM.conceptMap).then(
              (result) => {
                let undoRedo = this.canvas.toolbar.tools.get(KitBuildToolbar.UNDO_REDO);
                if (undoRedo) undoRedo.clearStacks().updateStacksStateButton();
                UI.info("Concept map has been reset.").show();
                let dataMap = L.dataMap(CDM.kitId, CDM.conceptMapId, CDM.room);
                L.canvas(dataMap, App.inst.canvas);
                // L.compare(dataMap, App.inst.canvas, CDM.conceptMap.canvas);
                L.log("socket-command-reset", CDM.room, dataMap);
              },
              (error) => UI.error(error).show()
            );
          } break;
          case 'load-reciprocal-map': {
            const room = data.shift();
            const pairs = await this.ajax.post(`collabApi/getRoomPairs`, {
              room: room.split("/")[1]
            });
            // console.log(pairs);

            const basefileurl = Core.instance().config('basefileurl');
            const mapid = App.collab?.getData('mapid');

            let promises = [];
            for(const pair of pairs) {
              const filename = pair?.userid?.split("/")[0];
              const url = `${basefileurl}files/peermaps/${mapid}/${filename}.cmap`;
              promises.push(this.ajax.get(url));
            }
            const results = await Promise.allSettled(promises);
            // console.log(results);
            const linkTargets = new Set();
            const commonLinkTargets = new Set();
            const cmapLinkTargets = new Set();
            CDM.conceptMap?.canvas?.linktargets?.forEach(lt => {
              cmapLinkTargets.add(`${lt.lid}-${lt.target_cid}`);
            });
            results.forEach(result => {
              if (result.status == 'fulfilled') {
                const mapData = result?.value?.replace("conceptMap=", "");
                const data = Core.decompress(mapData);
                // console.log(data);
                // compare with goal map
                // data?.canvas?.linktargets.forEach(linkTarget => {
                //   if (cmapLinkTargets.has(`${linkTarget.lid}-${linkTarget.target_cid}`))
                //     commonLinkTargets.add(`${linkTarget.lid}-${linkTarget.target_cid}`);
                //   else linkTargets.add(`${linkTarget.lid}-${linkTarget.target_cid}`);
                // });
                data?.canvas?.linktargets.forEach(lt => {
                  if (linkTargets.has(`${lt.lid}-${lt.target_cid}`))
                    commonLinkTargets.add(`${lt.lid}-${lt.target_cid}`);
                  else linkTargets.add(`${lt.lid}-${lt.target_cid}`);
                });
              }
            });
            // console.log(linkTargets, commonLinkTargets, cmapLinkTargets);
            // console.warn(CDM.conceptMap);
            // console.log(this.canvas.cy.edges());
            this.canvas?.cy?.edges('[type="right"]')?.remove();
            for(const link of commonLinkTargets) {
              const l = link.split("-");
              try {
                this.canvas?.createEdge({
                  source: l[0],
                  target: l[1],
                  type: 'right'
                });
              } catch(err) { console.error(err); }
            }

            let dataMap = L.dataMap(CDM.kitId, CDM.conceptMapId, CDM.room);
            L.canvas(dataMap, App.inst.canvas); 
            // L.compare(dataMap, App.inst.canvas, CDM.conceptMap.canvas);
            L.log("load-reciprocal-map", CDM.kitId, dataMap);
            
          } break;
        }
        // console.error(data);
        // App.processCollabCommand(command, data)
      } break;
      case 'socket-get-map-state': {
        let requesterSocketId = data.shift();
        this.generateMapState()
          .then(mapState => { // console.log(mapState);
            App.collab.send("send-map-state", requesterSocketId, mapState);
            let dataMap = L.dataMap(CDM.kitId, CDM.conceptMapId, CDM.room);
            L.canvas(dataMap, App.inst.canvas);
            // L.compare(dataMap, App.inst.canvas, CDM.conceptMap?.canvas);
            L.log("send-map-state", {requesterSocketId: requesterSocketId}, dataMap);
          });
      }  break;
      case 'socket-set-map-state': {
        let mapState = data.shift(); // console.log(mapState);
        this.applyMapState(mapState).then(() => { // console.log(this);
          App.collab.send("get-channels");
          let dataMap = L.dataMap(CDM.kitId, CDM.conceptMapId, CDM.room);
          L.canvas(dataMap, App.inst.canvas);
          // L.compare(dataMap, App.inst.canvas, CDM.conceptMap.canvas);
          L.log("set-map-state", mapState, dataMap);
        });
      }  break;
      case 'join-room-request': {
        let room = data.shift();
        let redrawDialog = false;
        if(App.confirmDialog?._isShown) App.confirmDialog.hide();
        // console.log(App.confirmDialog);
        App.confirmDialog = UI.confirm(`You have been requested to join room <strong>${room}</strong>. Do you want to accept?`)
          .noDismiss()
          .emphasize()
          .positive(() => {
            App.collab.joinRoom(room, App.collab.user).then(e => {
              App.collab.broadcastEvent('join-room', room);
              UI.info(`Room ${room} joined.`).show();
              CDM.room = room;
              let dataMap = L.dataMap(CDM.kitId, CDM.conceptMapId, CDM.room);
              L.log("join-room", CDM.room, dataMap);
            });
          })
          .negative((e) => {
            // console.log(e.delegateTarget);
            // if (!redrawDialog)
            let dataMap = L.dataMap(CDM.kitId, CDM.conceptMapId, CDM.room);
            L.log("reject-join-room", CDM.room, dataMap);
            App.collab.rejectjoinRoomRequest(room, App.collab.user);
          })
          .show();
      } break;
      case 'socket-user-join-room': {
        let user = data.shift();
        let room = data.shift();
        this.showPeers(room);
        if (user.socketId == App.collab?.socket?.id) {
          Core.instance()?.cookie()?.set('userid', user?.name);
          //.then((e) => console.log(e));
          // CDM.room = room
        }
        // console.log(data, App.collab);
      } break;
      case 'user-leave-room': {
        let user = data.shift();
        let room = data.shift();
        console.log(user, room);
        this.showPeers(room);
      } break;
      case 'socket-user-leave-room': {
        let user = data.shift();
        let room = data.shift();
        this.showPeers(room);
        let dataMap = L.dataMap(CDM.kitId, CDM.conceptMapId, CDM.room);
        L.log("leave-room", {user: user, room: CDM.room}, dataMap);
        
        delete CDM.room;
        UI.info(`You have left Room: <strong>${room.name}</strong>.`)
          .show();
      } break;
      case 'push-mapkit': {
        let mapkit = data.shift(); console.log(mapkit);
        // mapkit = {
        //   id: "mapid or kit id"
        //   mapdata: "JSON string of mapdata"
        // }
        // mapdata = {
        //   conceptMap: "... compressed ...",
        //   kit: "... compressed ..."
        //}
        if (!('id' in mapkit && 'mapdata' in mapkit)) {
          UI.error('Invalid map kit.').show();
        }
        this.session.set('mapid', mapkit?.id);
        App.collab?.setData('mapid', mapkit?.id);
        CDM.userid = App.collab.getCollabId(); // console.log(App.collab, CDM);

        // unpack and open kit on cytoscape canvas.
        let { conceptMap, kit } = this.unpackMapkit(mapkit);
        this.setKitCDM(kit, conceptMap);
        App.openKit(kit, conceptMap).then(
          (result) => {
            let dataMap = L.dataMap(CDM.kitId, CDM.conceptMapId, CDM.room);
            let data = {
              room: KitBuildCollab?.getPersonalRoom()
            }
            L.canvas(dataMap, App.inst.canvas);
            // L.compare(dataMap, App.inst.canvas, CDM.conceptMap.canvas);
            L.log('open-mapkit', data, dataMap);
          },
          (error) => UI.error(error).show()
        );
      } break;
      case 'load-collabmap': {
        let id = data.shift();
        // console.log(id);
        this.ajax.get(`mapApi/getCollabMap/${id}`).then(map => {
          // console.log(map);
          let mapkit = JSON.parse(map.data);
          let conceptMap = JSON.parse(map.cmapdata);
          let kit = JSON.parse(map.kitdata);
          this.setKitCDM(kit, conceptMap);
          // console.log(mapkit, conceptMap, kit);
          let collabMap = KitBuildUI.composeLearnerMap(mapkit.canvas, conceptMap.canvas);
          // console.log(collabMap);

          this.canvas.cy.elements().remove();
          this.canvas.cy.add(collabMap);
          this.canvas.applyElementStyle();
          this.canvas.toolbar.tools
            .get(KitBuildToolbar.CAMERA)
            .fit(null, { duration: 0 });
          KitBuildUI.showBackgroundImage(this.canvas);

          let sessid = App.getCookie(CDM.cookieid); 
          // console.log(CDM.cookieid, sessid, collabMap.sessid);

          let draftData = Object.assign({
            sessid: sessid,
            psessid: collabMap.sessid,
            collabmap: id,
            room: CDM.room
          }, map);
          delete draftData.data;
          delete draftData.cmapdata;
          delete draftData.kitdata;

          let dataMap = L.dataMap(CDM.kitId, CDM.conceptMapId, CDM.room);
          L.canvas(dataMap, App.inst.canvas);
          // L.compare(dataMap, App.inst.canvas, CDM.conceptMap.canvas);
          L.log('load-collabmap', draftData, dataMap);
          UI.info("Concept map has been loaded from saved data.").show();
        });        
      } break;
      case 'message': {
        let mData = data.shift();
        let room = data.shift();
        let dataMap = L.dataMap(CDM.kitId, CDM.conceptMapId, CDM.room);
        L.canvas(dataMap, App.inst?.canvas);
        // L.compare(dataMap, App.inst?.canvas, CDM.conceptMap?.canvas);
        L.log(e, {message: mData, room: room}, dataMap);
      } break;
      case 'channel-message': {
        let mData = data.shift();
        let room = data.shift();
        let id = data.shift();
        let dataMap = L.dataMap(CDM.kitId, CDM.conceptMapId, CDM.room);
        L.canvas(dataMap, App.inst.canvas);
        // L.compare(dataMap, App.inst.canvas, CDM.conceptMap.canvas);
        L.log(e, {message: mData, room: room, channelId: id}, dataMap);
      } break;
    }
  }

  showPeers(room) { // console.log(room);
    if (!room) return;
    let html = '';
    for (const user of room?.users) {
      html += `<li>`;
      html += `<a href="#" class="dropdown-item item-peer-map" data-userid="${user.name}" 
                    data-socketid="${user.socketId}">`;
      html += `<i class="bi bi-diagram-2"></i>`;
      html += `<small class="text-primary ms-2">${user.name}</small>`;
      html += `</a>`;
      html += `</li>`;
    }
    $('.peer-maps').html(html);
  }

}

// App.processCollabCommand = (command, data) => {
//   console.log(command, data);
//   switch (command) {
//     case "set-concept-map":
//       {
//         let conceptMap = data.shift();
//         let cyData = data.shift();
//         console.log(conceptMap, cyData);
//         App.inst.setConceptMap(conceptMap);
//         App.inst.canvas.cy.elements().remove();
//         App.inst.canvas.cy.add(cyData);
//         App.inst.canvas.applyElementStyle();
//         App.inst.canvas.canvasTool.clearCanvas().clearIndicatorCanvas();
//         App.inst.canvas.toolbar.tools
//           .get(KitBuildToolbar.CAMERA)
//           .fit(null, { duration: 0 });
//         App.inst.canvas.toolbar.tools
//           .get(KitBuildToolbar.NODE_CREATE)
//           .setActiveDirection(conceptMap.map.direction);
//         App.inst.canvas.toolbar.tools
//           .get(KitBuildToolbar.UNDO_REDO)
//           .clearStacks()
//           .updateStacksStateButton();
//       }
//       break;
//     case "move-nodes":
//       {
//         // let canvasId = data.shift();
//         let moves = data.shift();
//         let nodes = moves.later;
//         if (Array.isArray(nodes))
//           nodes.forEach((node) =>
//             App.inst.canvas.moveNode(node.id, node.x, node.y, 200)
//           );
//       }
//       break;
//     case "redo-move-nodes":
//     case "undo-move-nodes":
//       {
//         // let canvasId = data.shift();
//         let moves = data.shift();
//         let nodes = moves;
//         if (Array.isArray(nodes))
//           nodes.forEach((node) =>
//             App.inst.canvas.moveNode(node.id, node.x, node.y, 200)
//           );
//       }
//       break;
//     case "undo-centroid":
//     case "undo-move-link":
//     case "undo-move-concept":
//       {
//         let canvasId = data.shift();
//         let move = data.shift();
//         App.inst.canvas.moveNode(
//           move.from.id,
//           move.from.x,
//           move.from.y,
//           200
//         );
//       }
//       break;
//     case "centroid":
//     case "redo-centroid":
//     case "redo-move-link":
//     case "redo-move-concept":
//     case "move-link":
//     case "move-concept":
//       {
//         // let canvasId = data.shift();
//         let move = data.shift();
//         App.inst.canvas.moveNode(move.to.id, move.to.x, move.to.y, 200);
//       }
//       break;
//     case "layout-elements":
//       {
//         // let canvasId = data.shift();
//         let layoutMoves = data.shift();
//         let nodes = layoutMoves.later;
//         if (Array.isArray(nodes))
//           nodes.forEach((node) =>
//             App.inst.canvas.moveNode(
//               node.id,
//               node.position.x,
//               node.position.y,
//               200
//             )
//           );
//       }
//       break;
//     case "redo-layout-elements":
//     case "undo-layout-elements":
//     case "undo-layout":
//       {
//         // let canvasId = data.shift();
//         let nodes = data.shift();
//         if (Array.isArray(nodes))
//           nodes.forEach((node) =>
//             App.inst.canvas.moveNode(
//               node.id,
//               node.position.x,
//               node.position.y,
//               200
//             )
//           );
//       }
//       break;
//     case "undo-disconnect-right":
//     case "undo-disconnect-left":
//     case "redo-connect-right":
//     case "redo-connect-left":
//     case "connect-right":
//     case "connect-left":
//       {
//         // let canvasId = data.shift();
//         let edge = data.shift();
//         App.inst.canvas.createEdge(edge.data);
//       }
//       break;
//     case "undo-connect-right":
//     case "undo-connect-left":
//     case "redo-disconnect-right":
//     case "redo-disconnect-left":
//     case "disconnect-left":
//     case "disconnect-right":
//       {
//         // let canvasId = data.shift();
//         let edge = data.shift();
//         App.inst.canvas.removeEdge(edge.data.source, edge.data.target);
//       }
//       break;
//     case "undo-move-connect-left":
//     case "undo-move-connect-right":
//       {
//         // let canvasId = data.shift();
//         let moveData = data.shift();
//         App.inst.canvas.moveEdge(moveData.later, moveData.prior);
//       }
//       break;
//     case "redo-move-connect-left":
//     case "redo-move-connect-right":
//     case "move-connect-left":
//     case "move-connect-right":
//       {
//         // let canvasId = data.shift();
//         let moveData = data.shift();
//         App.inst.canvas.moveEdge(moveData.prior, moveData.later);
//       }
//       break;
//     case "switch-direction":
//       {
//         // let canvasId = data.shift();
//         let switchData = data.shift();
//         App.inst.canvas.switchDirection(switchData.prior, switchData.later);
//       }
//       break;
//     case "undo-disconnect-links":
//       {
//         // let canvasId = data.shift();
//         let edges = data.shift();
//         if (!Array.isArray(edges)) break;
//         edges.forEach((edge) => {
//           App.inst.canvas.createEdge(edge.data);
//         });
//       }
//       break;
//     case "redo-disconnect-links":
//     case "disconnect-links":
//       {
//         // let canvasId = data.shift();
//         let edges = data.shift();
//         if (!Array.isArray(edges)) break;
//         console.log(edges);
//         edges.forEach((edge) => {
//           App.inst.canvas.removeEdge(edge.data.source, edge.data.target);
//         });
//       }
//       break;
//     case "create-link":
//     case "create-concept":
//     case "redo-duplicate-link":
//     case "redo-duplicate-concept":
//     case "duplicate-link":
//     case "duplicate-concept":
//       {
//         // let canvasId = data.shift();
//         let node = data.shift();
//         console.log(node);
//         App.inst.canvas.addNode(node.data, node.position);
//       }
//       break;
//     case "undo-duplicate-link":
//     case "undo-duplicate-concept":
//       {
//         // let canvasId = data.shift();
//         let node = data.shift();
//         console.log(node);
//         App.inst.canvas.removeElements([node.data]);
//       }
//       break;
//     case "duplicate-nodes":
//       {
//         // let canvasId = data.shift();
//         let nodes = data.shift();
//         if (!Array.isArray(nodes)) break;
//         nodes.forEach((node) =>
//           App.inst.canvas.addNode(node.data, node.position)
//         );
//       }
//       break;
//     case "undo-delete-node":
//     case "undo-clear-canvas":
//     case "undo-delete-multi-nodes":
//       {
//         // let canvasId = data.shift();
//         let elements = data.shift();
//         App.inst.canvas.addElements(elements);
//       }
//       break;
//     case "delete-link":
//     case "delete-concept":
//     case "redo-delete-multi-nodes":
//     case "delete-multi-nodes":
//       {
//         // let canvasId = data.shift();
//         let elements = data.shift();
//         // console.log(canvasId, elements);
//         App.inst.canvas.removeElements(
//           elements.map((element) => element.data)
//         );
//       }
//       break;
//     case "undo-update-link":
//     case "undo-update-concept":
//       {
//         // let canvasId = data.shift();
//         let node = data.shift();
//         App.inst.canvas.updateNodeData(node.id, node.prior.data);
//       }
//       break;
//     case "redo-update-link":
//     case "redo-update-concept":
//     case "update-link":
//     case "update-concept":
//       {
//         // let canvasId = data.shift();
//         let node = data.shift();
//         App.inst.canvas.updateNodeData(node.id, node.later.data);
//       }
//       break;
//     case "redo-concept-color-change":
//     case "undo-concept-color-change":
//       {
//         // let canvasId = data.shift();
//         let changes = data.shift();
//         App.inst.canvas.changeNodesColor(changes);
//       }
//       break;
//     case "concept-color-change":
//       {
//         // let canvasId = data.shift();
//         let changes = data.shift();
//         let nodesData = changes.later;
//         App.inst.canvas.changeNodesColor(nodesData);
//       }
//       break;
//     case "undo-lock":
//     case "undo-unlock":
//     case "redo-lock":
//     case "redo-unlock":
//     case "lock-edge":
//     case "unlock-edge":
//       {
//         // let canvasId = data.shift();
//         let edge = data.shift();
//         App.inst.canvas.updateEdgeData(edge.id, edge);
//       }
//       break;
//     case "undo-lock-edges":
//     case "undo-unlock-edges":
//     case "redo-lock-edges":
//     case "redo-unlock-edges":
//       {
//         // let canvasId = data.shift();
//         let lock = data.shift();
//         if (!lock) break;
//         if (!Array.isArray(lock.edges)) break;
//         lock.edges.forEach((edge) =>
//           App.inst.canvas.updateEdgeData(edge.substring(1), {
//             lock: lock.lock,
//           })
//         );
//       }
//       break;
//     case "lock-edges":
//     case "unlock-edges":
//       {
//         // let canvasId = data.shift();
//         let edges = data.shift();
//         if (!Array.isArray(edges)) return;
//         edges.forEach((edge) =>
//           App.inst.canvas.updateEdgeData(edge.data.id, edge.data)
//         );
//       }
//       break;
//     case "redo-clear-canvas":
//     case "clear-canvas":
//       {
//         App.inst.canvas.reset();
//       }
//       break;
//     case "convert-type":
//       {
//         // let canvasId = data.shift();
//         let map = data.shift();
//         let elements = map.later;
//         let direction = map.to;
//         App.inst.canvas.convertType(direction, elements);
//       }
//       break;
//     case "select-nodes":
//       {
//         // let canvasId = data.shift();
//         let ids = data.shift();
//         console.log(ids);
//         ids = ids.map((id) => `#${id}`);
//         App.inst.canvas.cy.nodes(ids.join(", ")).addClass("peer-select");
//       }
//       break;
//     case "unselect-nodes":
//       {
//         // let canvasId = data.shift();
//         let ids = data.shift();
//         console.log(ids);
//         ids = ids.map((id) => `#${id}`);
//         App.inst.canvas.cy.nodes(ids.join(", ")).removeClass("peer-select");
//       }
//       break;
//   }
// };

App.buildPropositions = (canvas) => { console.log(canvas);
  let concepts = new Map(canvas.concepts.map((concept) => [concept.cid, concept]));
  let links = new Map(canvas.links.map((link) => [link.lid, link]));
  let propositions = new Map();
  let propid = 0;
  canvas.linktargets?.forEach((linktarget) => {
    let prop = {
      source: concepts.get(links.get(linktarget.lid).source_cid),
      link: links.get(linktarget.lid),
      target: concepts.get(linktarget.target_cid),
    };
    if (prop.source && prop.target) propositions.set(++propid, prop);
  });
  return propositions;
}

App.onCanvasEvent = (canvasId, event, data) => { 
  // console.log(canvasId, event, data);
  Logger.canvasid = canvasId;
  let skip = [ // for canvas data
    'camera-reset', 
    'camera-center', 
    'camera-fit', 
    'camera-zoom-in', 
    'camera-zoom-out'
  ];

  let dataMap = L.dataMap(CDM.conceptMapId);
  if (!skip.includes(event))
    L.canvas(dataMap, App.inst.canvas);
  // if (!F && !F)  T && T
  if (!event.includes("move") && !event.includes('layout') && !skip.includes(event))
    L.proposition(dataMap, App.inst.canvas);
  L.log(event, data, dataMap);
    // forward event to collaboration interface
  App.collab?.send("command", event, data);
  // App.collab("command", event, canvasId, data);
};

App.uuidv4 = () => {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

App.parseIni = (data) => {
  var regex = {
    section: /^\s*\[\s*([^\]]*)\s*\]\s*$/,
    param: /^\s*([^=]+?)\s*=\s*(.*?)\s*$/,
    comment: /^\s*;.*$/
  };
  var value = {};
  var lines = data.split(/[\r\n]+/);
  var section = null;
  lines.forEach(function(line){
    if(regex.comment.test(line)){
      return;
    }else if(regex.param.test(line)){
      var match = line.match(regex.param);
      if(section){
        value[section][match[1]] = match[2];
      }else{
        value[match[1]] = match[2];
      }
    }else if(regex.section.test(line)){
      var match = line.match(regex.section);
      value[match[1]] = {};
      section = match[1];
    }else if(line.length == 0 && section){
      section = null;
    };
  });
  return value;
}

// App.getCookie = (name) => {
//   const value = `; ${document.cookie}`;
//   const parts = value.split(`; ${name}=`);
//   if (parts.length === 2) return parts.pop().split(';').shift();
// }

// App.getCookie = (cname) => {
//   let name = cname + "=";
//   let ca = document.cookie.split(';');
//   for(let i = 0; i < ca.length; i++) {
//     let c = ca[i];
//     while (c.charAt(0) == ' ') c = c.substring(1);
//     if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
//   }
//   return "";
// }

App.getCookie = (name) => {
  let value = Core.instance().cookie().getCookie(name);
  return value;
}
App.removeCookie = async (name) => {
  const status = await Core.instance().cookie().unset(name);
  console.warn("Removing cookie:", name, App.getCookie(name));
}

App.duration = (seconds) => {
  let d = Number(seconds);
  if (d <= 0) return '00:00:00';
  else {
    let h = Math.floor(d / 3600);
    let m = Math.floor(d % 3600 / 60);
    let s = Math.floor(d % 3600 % 60);
    let hDisplay = h == 0 ? null : (h <= 9 ? '0'+h+'°' : h+'°');
    let mDisplay = m == 0 ? null : (m <= 9 ? '0'+m+'\'' : m+'\'');
    let sDisplay = s == s <= 9 ? '0'+s : s;
    return `${hDisplay ?? ""}${mDisplay ?? ""}${sDisplay}"`; 
  }
}

App.time = (seconds) => {
  let d = Number(seconds);
  if (d <= 0) return '00:00:00';
  else {
    let h = Math.floor(d / 3600);
    let m = Math.floor(d % 3600 / 60);
    let s = Math.floor(d % 3600 % 60);
    let hDisplay = h <= 9 ? '0'+h : h;
    let mDisplay = m <= 9 ? '0'+m : m;
    let sDisplay = s <= 9 ? '0'+s : s;
    return `${hDisplay}:${mDisplay}:${sDisplay}`; 
  }
}

App.download = (filename, text) => {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

App.canvasId = "goalmap-canvas";
App.defaultMapType = "scratch";
App.timer = null;



