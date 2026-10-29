[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)][int]$Port = 8765,
    [switch]$NoBrowser
)
$ErrorActionPreference = 'Stop'
$indexPath = Join-Path $PSScriptRoot 'index.html'
if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) {
    throw 'index.html is missing. Extract the entire ZIP first.'
}
$listener = New-Object System.Net.Sockets.TcpListener -ArgumentList ([System.Net.IPAddress]::Loopback), $Port
try {
    $listener.Start()
    $url = 'http://127.0.0.1:' + $Port + '/'
    Write-Host ('Study Atlas RPC test: ' + $url)
    Write-Host 'Keep this window open. Press Ctrl+C to stop.'
    Write-Host 'This server serves local files only. The browser contacts Supabase directly.'
    if (-not $NoBrowser) {
        try { Start-Process $url } catch { Write-Host ('Open this URL in your browser: ' + $url) }
    }
    while ($true) {
        if (-not $listener.Pending()) { Start-Sleep -Milliseconds 100; continue }
        $client = $listener.AcceptTcpClient()
        $stream = $null
        $reader = $null
        try {
            $client.ReceiveTimeout = 3000
            $client.SendTimeout = 3000
            $stream = $client.GetStream()
            $reader = New-Object System.IO.StreamReader -ArgumentList $stream, ([System.Text.Encoding]::ASCII), $false, 1024, $true
            $request = $reader.ReadLine()
            if ([string]::IsNullOrEmpty($request)) { continue }
            $parts = $request.Split(' ')
            $headerBytes = $request.Length
            do {
                $line = $reader.ReadLine()
                if ($null -eq $line) { break }
                $headerBytes += $line.Length
                if ($headerBytes -gt 16384) { throw 'Request headers are too large.' }
            } while ($line.Length -gt 0)
            $method = $parts[0]
            $path = if ($parts.Length -ge 2) { $parts[1].Split('?')[0] } else { '' }
            $status = '200 OK'
            $contentType = 'text/html; charset=utf-8'
            if ($method -ne 'GET' -and $method -ne 'HEAD') {
                $status = '405 Method Not Allowed'
                $contentType = 'text/plain; charset=utf-8'
                $body = [System.Text.Encoding]::UTF8.GetBytes('GET and HEAD only.')
            } elseif ($path -eq '/' -or $path -eq '/index.html') {
                $body = [System.IO.File]::ReadAllBytes($indexPath)
            } else {
                $status = '404 Not Found'
                $contentType = 'text/plain; charset=utf-8'
                $body = [System.Text.Encoding]::UTF8.GetBytes('Not found.')
            }
            $header = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
            $headerData = [System.Text.Encoding]::ASCII.GetBytes($header)
            $stream.Write($headerData, 0, $headerData.Length)
            if ($method -ne 'HEAD') { $stream.Write($body, 0, $body.Length) }
            $stream.Flush()
        } catch {
            # Browsers may cancel connections. Continue accepting the next request.
        } finally {
            if ($null -ne $reader) { $reader.Dispose() }
            if ($null -ne $stream) { $stream.Dispose() }
            $client.Close()
        }
    }
} finally {
    $listener.Stop()
}
