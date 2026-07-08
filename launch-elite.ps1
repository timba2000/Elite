# Launches the Elite dev server (if not already running) and opens the game in the browser.
$port = 5173
$url = "http://localhost:$port/"

function Test-Port {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $async = $client.BeginConnect('localhost', $port, $null, $null)
        $ok = $async.AsyncWaitHandle.WaitOne(500)
        if ($ok) { $client.EndConnect($async) }
        $client.Close()
        return $ok
    } catch { return $false }
}

if (-not (Test-Port)) {
    Start-Process cmd -ArgumentList '/c', 'npm run dev' -WorkingDirectory "C:\Users\Tim Barnes\Elite" -WindowStyle Minimized
    # Wait up to 30s for the server to come up
    $deadline = (Get-Date).AddSeconds(30)
    while (-not (Test-Port) -and (Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
    }
}

Start-Process $url
