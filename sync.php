<?php
/**
 * Jednoduché sdílené úložiště zaškrtnutí (JSON soubor).
 * Nahraj vedle index.html na hosting s PHP. Složka data/ se vytvoří sama.
 *
 * Volitelná ochrana: nastav $SYNC_SECRET a stejný řetězec do REMOTE_SYNC.secret ve script.js
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$SYNC_SECRET = '';

if ($SYNC_SECRET !== '' && (string)($_GET['key'] ?? '') !== $SYNC_SECRET) {
    http_response_code(403);
    echo json_encode(['error' => 'forbidden'], JSON_UNESCAPED_UNICODE);
    exit;
}

$dir = __DIR__ . '/data';
$file = $dir . '/checks.json';

if (!is_dir($dir)) {
    if (!@mkdir($dir, 0755, true) && !is_dir($dir)) {
        http_response_code(500);
        echo json_encode(['error' => 'cannot_create_data_dir'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

if (!file_exists($file)) {
    file_put_contents($file, '{}');
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $raw = file_get_contents($file);
    if ($raw === false) {
        http_response_code(500);
        echo json_encode(['error' => 'read_failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    echo $raw === '' ? '{}' : $raw;
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = file_get_contents('php://input');
    $input = json_decode($body ?? '', true);
    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_json'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $id = isset($input['id']) ? (string) $input['id'] : '';
    $checked = !empty($input['checked']);

    if ($id === '' || !preg_match('/^[a-z0-9-]+$/', $id)) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_id'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $fp = fopen($file, 'c+');
    if ($fp === false) {
        http_response_code(500);
        echo json_encode(['error' => 'lock_failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        http_response_code(500);
        echo json_encode(['error' => 'flock_failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $raw = stream_get_contents($fp);
    $data = json_decode($raw !== false && $raw !== '' ? $raw : '{}', true);
    if (!is_array($data)) {
        $data = [];
    }

    if ($checked) {
        $data[$id] = true;
    } else {
        unset($data[$id]);
    }

    $out = json_encode($data, JSON_UNESCAPED_UNICODE);
    if ($out === false) {
        flock($fp, LOCK_UN);
        fclose($fp);
        http_response_code(500);
        echo json_encode(['error' => 'encode_failed'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, $out);
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    echo $out;
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'method_not_allowed'], JSON_UNESCAPED_UNICODE);
