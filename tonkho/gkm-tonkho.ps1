# GKM Tồn kho: chương trình nhỏ chạy nền, giúp app GKM lấy tồn kho từ KiotViet.
# - Chỉ dùng PowerShell và Edge có sẵn trên Windows 10/11, không cần cài thêm gì.
# - Dùng trình duyệt Edge với hồ sơ RIÊNG, tách hẳn khỏi trình duyệt anh đang dùng.
# - Chỉ nhận lệnh từ chính máy này (127.0.0.1), không mở ra mạng ngoài.
# - Không lưu mật khẩu: anh tự đăng nhập KiotViet một lần trong cửa sổ riêng, Edge riêng tự nhớ.
$ErrorActionPreference = 'Stop'
$Version = '1.1'
$Port = 47321
$DebugPort = 9333
$Base = Join-Path $env:LOCALAPPDATA 'GKM-TonKho'
$ProfileDir = Join-Path $Base 'profile'
$DlDir = Join-Path $Base 'downloads'
$LogFile = Join-Path $Base 'log.txt'
New-Item -ItemType Directory -Force -Path $DlDir | Out-Null

function Log([string]$m) {
  $line = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' ' + $m
  Write-Host $line
  try { Add-Content -Path $LogFile -Value $line -Encoding UTF8 } catch { }
}

function Find-Browser {
  $c = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  )
  foreach ($p in $c) { if ($p -and (Test-Path $p)) { return $p } }
  return $null
}

function Get-DebugInfo {
  try { return Invoke-RestMethod -Uri "http://127.0.0.1:$DebugPort/json/version" -TimeoutSec 2 } catch { return $null }
}

function Products-Url([string]$shop) { return "https://$shop.kiotviet.vn/man/#/Products" }

# Bật Edge riêng nếu chưa bật. $visible = $false: cửa sổ nằm ngoài màn hình, anh không thấy.
function Ensure-Browser([bool]$visible, [string]$url) {
  $info = Get-DebugInfo
  if ($info) { return $info }
  $exe = Find-Browser
  if (-not $exe) { throw 'Không tìm thấy Edge hoặc Chrome trên máy' }
  $a = @("--remote-debugging-port=$DebugPort", "--user-data-dir=`"$ProfileDir`"", '--no-first-run', '--no-default-browser-check', '--disable-features=Translate')
  if ($visible) { $a += '--window-size=1200,860' } else { $a += '--window-position=-2400,-2400'; $a += '--window-size=1280,860' }
  $a += $url
  if ($visible) { Log 'Mở cửa sổ đăng nhập KiotViet' } else { Log 'Bật Edge riêng (ẩn)' }
  Start-Process -FilePath $exe -ArgumentList $a | Out-Null
  for ($i = 0; $i -lt 40; $i++) { Start-Sleep -Milliseconds 500; $info = Get-DebugInfo; if ($info) { return $info } }
  throw 'Edge riêng không bật được'
}

# ---------- Kết nối điều khiển Edge (Chrome DevTools Protocol) ----------
$script:ws = $null; $script:cid = 0; $script:rt = $null
$script:buf = New-Object byte[] 262144
$script:ms = New-Object System.IO.MemoryStream
$script:dlNames = @{}; $script:doneGuid = $null; $script:dlFail = $null

function Cdp-Connect([string]$url) {
  $script:ws = New-Object System.Net.WebSockets.ClientWebSocket
  $script:ws.ConnectAsync([Uri]$url, [Threading.CancellationToken]::None).Wait(10000) | Out-Null
  if ($script:ws.State -ne 'Open') { throw 'Không kết nối được Edge riêng' }
  $script:rt = $null; $script:ms.SetLength(0)
}
function Cdp-Close { try { $script:ws.Abort(); $script:ws.Dispose() } catch { }; $script:ws = $null; $script:rt = $null }

# Đọc 1 tin nhắn, chờ tối đa $timeoutMs. Trả về $null nếu chưa có.
function Cdp-ReadOne([int]$timeoutMs) {
  while ($true) {
    if (-not $script:rt) {
      $seg = New-Object 'System.ArraySegment[byte]' -ArgumentList (, $script:buf)
      $script:rt = $script:ws.ReceiveAsync($seg, [Threading.CancellationToken]::None)
    }
    if (-not $script:rt.Wait($timeoutMs)) { return $null }
    $r = $script:rt.Result; $script:rt = $null
    $script:ms.Write($script:buf, 0, $r.Count)
    if ($r.EndOfMessage) {
      $txt = [Text.Encoding]::UTF8.GetString($script:ms.ToArray()); $script:ms.SetLength(0)
      return ($txt | ConvertFrom-Json)
    }
  }
}
function Cdp-Event($m) {
  if ($m.method -eq 'Browser.downloadWillBegin') { $script:dlNames[$m.params.guid] = $m.params.suggestedFilename }
  elseif ($m.method -eq 'Browser.downloadProgress') {
    if ($m.params.state -eq 'completed') { $script:doneGuid = $m.params.guid }
    elseif ($m.params.state -eq 'canceled') { $script:dlFail = 'Tải file bị hủy' }
  }
}
function Cdp-Send([string]$method, $params, [string]$sid) {
  $script:cid++; $id = $script:cid
  if ($null -eq $params) { $params = @{} }
  $msg = @{ id = $id; method = $method; params = $params }
  if ($sid) { $msg.sessionId = $sid }
  $bytes = [Text.Encoding]::UTF8.GetBytes(($msg | ConvertTo-Json -Depth 10 -Compress))
  $seg = New-Object 'System.ArraySegment[byte]' -ArgumentList (, $bytes)
  $script:ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait() | Out-Null
  $deadline = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $deadline) {
    $m = Cdp-ReadOne 1000
    if ($null -eq $m) { continue }
    if ($m.id -eq $id) {
      if ($m.error) { throw ("Lỗi điều khiển Edge: " + $m.error.message) }
      return $m.result
    }
    if ($m.method) { Cdp-Event $m }
  }
  throw "Hết giờ chờ: $method"
}
function Cdp-Pump([int]$ms) {
  $end = (Get-Date).AddMilliseconds($ms)
  while ((Get-Date) -lt $end) { $m = Cdp-ReadOne 200; if ($m -and $m.method) { Cdp-Event $m } }
}
function Eval-In([string]$sid, [string]$expr) {
  $r = Cdp-Send 'Runtime.evaluate' @{ expression = $expr; awaitPromise = $true; returnByValue = $true } $sid
  if ($r.exceptionDetails) { throw ('Lỗi trên trang: ' + $r.exceptionDetails.text) }
  return $r.result.value
}

# ---------- Các đoạn chạy trên trang KiotViet ----------
$JS_STATE = @'
(() => {
  const vis = e => !!(e && (e.offsetWidth || e.offsetHeight || e.getClientRects().length));
  if (/login|dang-nhap/i.test(location.href) || vis(document.querySelector('input[type=password]'))) return 'login';
  if (vis(document.querySelector('a.kv2BtnExport'))) return 'ready';
  return 'loading';
})()
'@
$JS_EXPORT = "(() => { const a = document.querySelector('a.kv2BtnExport'); if (!a) return false; a.click(); return true; })()"
$JS_CONFIRM = @'
(() => {
  const vis = e => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
  const b = [...document.querySelectorAll('.k-window-content button, [role=dialog] button, .modal button')].find(e => e.textContent.trim() === 'Xuất file' && vis(e));
  if (!b) return false; b.click(); return true;
})()
'@
# Bỏ ô tìm kiếm còn sót (nếu có) để xuất đủ tất cả hàng hóa
$JS_CLEAR = @'
(() => {
  const vis = e => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
  const inp = [...document.querySelectorAll('input')].find(i => /Theo mã, tên hàng/.test(i.placeholder || ''));
  const box = inp && inp.closest('.k-multiselect, .k-widget');
  const x = box && [...box.querySelectorAll('.k-clear-value, .k-i-close, .k-delete, .k-select')].find(vis);
  if (x) { x.click(); return true; } return false;
})()
'@

# Vào KiotViet, bấm Xuất file danh sách hàng hóa, chờ tải xong. Trả về @{ name; bytes }
function Export-Products([string]$shop) {
  $info = Ensure-Browser $false 'about:blank'
  Cdp-Connect $info.webSocketDebuggerUrl
  $targetId = $null
  try {
    Get-ChildItem -Path $DlDir -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    $script:dlNames = @{}; $script:doneGuid = $null; $script:dlFail = $null
    Cdp-Send 'Browser.setDownloadBehavior' @{ behavior = 'allowAndName'; downloadPath = $DlDir; eventsEnabled = $true } $null | Out-Null
    $targetId = (Cdp-Send 'Target.createTarget' @{ url = (Products-Url $shop) } $null).targetId
    $sid = (Cdp-Send 'Target.attachToTarget' @{ targetId = $targetId; flatten = $true } $null).sessionId
    $st = 'loading'
    for ($i = 0; $i -lt 60 -and $st -eq 'loading'; $i++) {
      Cdp-Pump 1000
      try { $st = Eval-In $sid $JS_STATE } catch { $st = 'loading' }
    }
    if ($st -eq 'login') { throw 'NEED_LOGIN' }
    if ($st -ne 'ready') { throw 'Trang hàng hóa KiotViet không mở được (quá 60 giây)' }
    Cdp-Pump 1500
    if (Eval-In $sid $JS_CLEAR) { Log 'Đã bỏ ô tìm kiếm cũ'; Cdp-Pump 2500 }
    if (-not (Eval-In $sid $JS_EXPORT)) { throw 'Không thấy nút Xuất file' }
    $ok = $false
    for ($i = 0; $i -lt 20 -and -not $ok; $i++) { Cdp-Pump 500; $ok = Eval-In $sid $JS_CONFIRM }
    if (-not $ok) { throw 'Không thấy hộp xác nhận Xuất file' }
    Log 'Đã bấm Xuất file, chờ KiotViet tạo file...'
    $end = (Get-Date).AddSeconds(150)
    while (-not $script:doneGuid -and -not $script:dlFail -and (Get-Date) -lt $end) { Cdp-Pump 500 }
    if ($script:dlFail) { throw $script:dlFail }
    if (-not $script:doneGuid) { throw 'Chờ quá 2 phút mà KiotViet chưa xuất xong file' }
    $name = $script:dlNames[$script:doneGuid]; if (-not $name) { $name = 'DanhSachSanPham.xlsx' }
    $fp = Join-Path $DlDir $script:doneGuid
    for ($i = 0; $i -lt 20 -and -not (Test-Path $fp); $i++) { Start-Sleep -Milliseconds 250 }
    $bytes = [IO.File]::ReadAllBytes($fp)
    Remove-Item $fp -Force -ErrorAction SilentlyContinue
    Log ("Đã tải $name, " + $bytes.Length + ' byte')
    return @{ name = $name; bytes = $bytes }
  } finally {
    if ($targetId) { try { Cdp-Send 'Target.closeTarget' @{ targetId = $targetId } $null | Out-Null } catch { } }
    Cdp-Close
  }
}

# Mở cửa sổ riêng để anh đăng nhập KiotViet (chỉ cần một lần)
function Open-Login([string]$shop, [bool]$fresh) {
  $info = Get-DebugInfo
  if ($fresh -and -not $info) { $info = Ensure-Browser $false 'about:blank' }
  if ($info) {
    try {
      Cdp-Connect $info.webSocketDebuggerUrl
      if ($fresh) { Cdp-Send 'Storage.clearCookies' @{} $null | Out-Null; Log 'Đã đăng xuất KiotViet (xóa cookie hồ sơ riêng)' }
      Cdp-Send 'Browser.close' @{} $null | Out-Null
    } catch { } finally { Cdp-Close }
    for ($i = 0; $i -lt 20 -and (Get-DebugInfo); $i++) { Start-Sleep -Milliseconds 300 }
  }
  Ensure-Browser $true (Products-Url $shop) | Out-Null
}

# ---------- Máy chủ nhỏ trên 127.0.0.1 để app gọi ----------
function Send-Resp($stream, [int]$code, [string]$ctype, [byte[]]$body, [string]$fileName) {
  $reason = @{ 200 = 'OK'; 204 = 'No Content'; 400 = 'Bad Request'; 404 = 'Not Found'; 409 = 'Conflict'; 500 = 'Internal Server Error' }[$code]
  $h = "HTTP/1.1 $code $reason`r`n" +
       "Access-Control-Allow-Origin: *`r`nAccess-Control-Allow-Methods: GET, OPTIONS`r`nAccess-Control-Allow-Headers: *`r`n" +
       "Access-Control-Allow-Private-Network: true`r`nAccess-Control-Expose-Headers: X-File-Name`r`n" +
       "Cache-Control: no-store`r`nConnection: close`r`n"
  if ($ctype) { $h += "Content-Type: $ctype`r`n" }
  if ($fileName) { $h += 'X-File-Name: ' + [Uri]::EscapeDataString($fileName) + "`r`n" }
  if ($null -eq $body) { $body = New-Object byte[] 0 }
  $h += 'Content-Length: ' + $body.Length + "`r`n`r`n"
  $hb = [Text.Encoding]::ASCII.GetBytes($h)
  $stream.Write($hb, 0, $hb.Length)
  if ($body.Length) { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}
function Send-Json($stream, [int]$code, $obj) {
  Send-Resp $stream $code 'application/json; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Compress))) $null
}

$listener = New-Object System.Net.Sockets.TcpListener ([Net.IPAddress]::Loopback, $Port)
try { $listener.Start() } catch { Log 'GKM Tồn kho đã chạy sẵn rồi.'; exit 0 }
Log "GKM Tồn kho v$Version đang chạy ở http://127.0.0.1:$Port"

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $client.ReceiveTimeout = 5000
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 4096, $true)
    $first = $reader.ReadLine()
    while ($true) { $l = $reader.ReadLine(); if ($null -eq $l -or $l -eq '') { break } }
    if (-not $first) { continue }
    $parts = $first.Split(' ')
    $method = $parts[0]; $target = $parts[1]
    $pathOnly = $target.Split('?')[0]
    $shop = ''
    if ($target -match '[?&]shop=([A-Za-z0-9-]{2,60})(&|$)') { $shop = $Matches[1].ToLower() }
    if ($method -eq 'OPTIONS') { Send-Resp $stream 204 $null $null $null; continue }
    if ($pathOnly -eq '/ping') { Send-Json $stream 200 @{ ok = $true; version = $Version; browser = [bool](Find-Browser) }; continue }
    if (-not $shop) { Send-Json $stream 400 @{ error = 'bad_shop'; message = 'Tên cửa hàng KiotViet không hợp lệ' }; continue }
    try {
      if ($pathOnly -eq '/login') { Open-Login $shop $false; Send-Json $stream 200 @{ ok = $true } }
      elseif ($pathOnly -eq '/logout') { Open-Login $shop $true; Send-Json $stream 200 @{ ok = $true } }
      elseif ($pathOnly -eq '/export') {
        $r = Export-Products $shop
        Send-Resp $stream 200 'application/octet-stream' $r.bytes $r.name
      }
      else { Send-Json $stream 404 @{ error = 'not_found' } }
    } catch {
      $msg = $_.Exception.Message
      if ($msg -eq 'NEED_LOGIN') { Log 'Cần đăng nhập KiotViet'; Send-Json $stream 409 @{ error = 'need_login'; message = 'Cần đăng nhập KiotViet' } }
      else { Log ('Lỗi: ' + $msg); Send-Json $stream 500 @{ error = 'error'; message = $msg } }
    }
  } catch {
    Log ('Lỗi kết nối: ' + $_.Exception.Message)
  } finally {
    try { $client.Close() } catch { }
  }
}
