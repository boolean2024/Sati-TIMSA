param(
  [string]$OutputDir = "backups"
)

if (-not $env:DATABASE_URL) {
  throw "DATABASE_URL no esta definido."
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
  throw "pg_dump no esta instalado o no esta en PATH."
}

$parsed = [System.Uri]$env:DATABASE_URL
$server = $parsed.Host
$port = $parsed.Port
$user = $parsed.UserInfo -replace ':.*$', ''
$db = $parsed.AbsolutePath.TrimStart('/')
$env:PGPASSWORD = $parsed.UserInfo -replace '^.*:', ''

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$file = Join-Path $OutputDir "sati-timsa-$stamp.dump"

try {
  & $pgDump.Source --format=custom --no-owner --no-acl --host=$server --port=$port --username=$user --dbname=$db --file=$file
  if ($LASTEXITCODE -ne 0) {
    throw "pg_dump fallo con codigo $LASTEXITCODE."
  }
  Write-Output "Backup creado: $file"
} finally {
  Remove-Item -Path "env:PGPASSWORD" -ErrorAction SilentlyContinue
}
