<?php

class HomeController extends CoreController {
  
  function index($mapid = null) {
    $this->ui->useCoreLib('core-ui');
    $this->ui->usePlugin('core-runtime');
    $this->ui->usePlugin('kitbuild-ui', 'kitbuild', 'kitbuild-collab', 'kitbuild-logger');

    $configlib = Core::lib(Core::CONFIG); 

    $host = $configlib->get('collabhost');
    $port = $configlib->get('collabport');
    $path = $configlib->get('collabpath');
    $enablecollab = $configlib->get('enablecollab');

    $configlib->set('mapid', $mapid, CoreConfig::CONFIG_TYPE_CLIENT);
    $configlib->set('collabhost', $host, CoreConfig::CONFIG_TYPE_CLIENT);
    $configlib->set('collabport', $port, CoreConfig::CONFIG_TYPE_CLIENT);
    $configlib->set('collabpath', $path, CoreConfig::CONFIG_TYPE_CLIENT);
    $configlib->set('enablecollab', $enablecollab, CoreConfig::CONFIG_TYPE_CLIENT);

    $this->ui->useScript("compose.js");
    $this->ui->useStyle("compose.css");    
    $this->ui->view('head.php', null, CoreView::CORE);
    $this->ui->view("compose.php", array());
    $this->ui->viewPlugin("general-ui");
    $this->ui->view('foot.php', null, CoreView::CORE);
  }

  function manage() {
    $this->ui->useCoreLib('core-ui');
    $this->ui->usePlugin('core-runtime');
    $this->ui->usePlugin('general-ui', 'cmap-collab-manager', 'dragula');
    $this->ui->useScript("manage.js");
    $this->ui->useStyle("manage.css");

    $configlib = Core::lib(Core::CONFIG); 

    $host = $configlib->get('collabhost');
    $port = $configlib->get('collabport');
    $path = $configlib->get('collabpath');

    $configlib->set('collabhost', $host, CoreConfig::CONFIG_TYPE_CLIENT);
    $configlib->set('collabport', $port, CoreConfig::CONFIG_TYPE_CLIENT);
    $configlib->set('collabpath', $path, CoreConfig::CONFIG_TYPE_CLIENT);

    $this->ui->view('head.php', null, CoreView::CORE);
    $this->ui->view("manage.php");
    $this->ui->viewPlugin("general-ui", null);
    $this->ui->view('foot.php', null, CoreView::CORE);
  }

}
