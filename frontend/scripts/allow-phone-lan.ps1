# Allow phones on the same Wi-Fi to reach Vite (Node.js) on this PC.
# Run in PowerShell as Administrator:
#   powershell -ExecutionPolicy Bypass -File .\scripts\allow-phone-lan.ps1

$ErrorActionPreference = 'Stop'

$node = 'C:\Program Files\nodejs\node.exe'
if (-not (Test-Path $node)) {
  throw "Node.js not found at $node"
}

Get-NetFirewallRule -DisplayName 'Node.js JavaScript Runtime' -ErrorAction SilentlyContinue |
  Where-Object { $_.Direction -eq 'Inbound' -and $_.Action -eq 'Block' -and $_.Profile -eq 'Private' } |
  ForEach-Object {
    Set-NetFirewallRule -Name $_.Name -Action Allow
    Write-Output "Changed $($_.Name) from Block to Allow on Private."
  }

$existing = Get-NetFirewallRule -DisplayName 'Doctor Clinic Vite LAN' -ErrorAction SilentlyContinue
if (-not $existing) {
  New-NetFirewallRule -DisplayName 'Doctor Clinic Vite LAN' `
    -Direction Inbound `
    -Action Allow `
    -Profile Private,Domain,Public `
    -Protocol TCP `
    -LocalPort 4173,5173 `
    -Program $node |
    Out-Null
  Write-Output 'Created inbound rule: Doctor Clinic Vite LAN (TCP 4173, 5173).'
} else {
  Write-Output 'Inbound rule already exists: Doctor Clinic Vite LAN'
}

Write-Output 'Done. Keep npm run preview running, then open http://192.168.1.90:4173/queue on the phone.'
