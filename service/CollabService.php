<?php

class CollabService extends CoreService {
  function search($keyword) {
    $db = self::instance('kb');
    $qb = QB::instance('pair')
      ->select()
      ->where('userid', 'LIKE', '%'.QB::esc($keyword).'%')
      ->where('room', 'LIKE', '%'.QB::esc($keyword).'%', QB::OR);
    $result = $db->query($qb->get());
    return $result;
  }
  function insert($userid, $room) {
    $insert['userid'] = QB::esc($userid);
    $insert['room']   = QB::esc($room);
    $db = self::instance('kb');
    $qb = QB::instance('pair')
      ->insert($insert);
    $result = $db->query($qb->get());
    $id = $db->getInsertId();
    return $id;
  }
  function updateRoom($id, $room) {
    $db = self::instance('kb');
    $qb = QB::instance('pair')
      ->update('room', QB::esc($room))
      ->where('id', QB::esc($id));
    $result = $db->query($qb->get());
    return $result;
  }
  function updateUserId($id, $userid) {
    $db = self::instance('kb');
    $qb = QB::instance('pair')
      ->update('userid', QB::esc($userid))
      ->where('id', QB::esc($id));
    $result = $db->query($qb->get());
    return $result;
  }
  function deletePair($id) {
    $db = self::instance('kb');
    $qb = QB::instance('pair')
      ->delete()
      ->where('id', QB::esc($id));
    $result = $db->query($qb->get());
    return $result;
  }
  function getRoomPairs($room) {
    $db = self::instance('kb');
    $qb = QB::instance('pair')
      ->select('userid')
      ->where('room', QB::esc($room));
    $result = $db->query($qb->get());
    return $result;
  }
}