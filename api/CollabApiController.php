<?php

class CollabApiController extends CoreApi {
  function getAll($keyword = null) {
    try {
      $service = new CollabService();
      $result = $service->search($keyword);
      CoreResult::instance($result)->show();
    } catch (Exception $ex) {
      CoreError::instance($ex->getMessage())->show();
    }
  }
  function createUserRoom() {
    try {
      $userid   = $this->postv('userid');
      $room = $this->postv('room');
      $service = new CollabService();
      $id = $service->insert($userid, $room);
      CoreResult::instance($id)->show();
    } catch (Exception $ex) {
      CoreError::instance($ex->getMessage())->show();
    }
  }
  function updateRoom() {
    try {
      $id   = $this->postv('id');
      $room = $this->postv('room');
      $service = new CollabService();
      $id = $service->updateRoom($id, $room);
      CoreResult::instance(true)->show();
    } catch (Exception $ex) {
      CoreError::instance($ex->getMessage())->show();
    }
  }
  function updateUserId() {
    try {
      $id     = $this->postv('id');
      $userid = $this->postv('userid');
      $service = new CollabService();
      $id = $service->updateUserId($id, $userid);
      CoreResult::instance(true)->show();
    } catch (Exception $ex) {
      CoreError::instance($ex->getMessage())->show();
    }
  }
  function deletePair() {
    try {
      $id = $this->postv('id');
      $service = new CollabService();
      $result = $service->deletePair($id);
      CoreResult::instance($result)->show();
    } catch (Exception $ex) {
      CoreError::instance($ex->getMessage())->show();
    }
  }
  function getRoomPairs() {
    try {
      $room = $this->postv('room');
      // var_dump($room);exit;
      $service = new CollabService();
      $result = $service->getRoomPairs($room);
      CoreResult::instance($result)->show();
    } catch (Exception $ex) {
      CoreError::instance($ex->getMessage())->show();
    }
  }
}