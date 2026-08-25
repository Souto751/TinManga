<#
.SYNOPSIS
    Publica una version nueva de TinMangas: valida el repo, opcionalmente
    tipa con tsc, calcula el proximo numero de version (semver), commitea,
    taguea y pushea - lo que dispara el workflow de GitHub Actions que
    compila el APK de produccion y publica el GitHub Release
    (.apk + latest.json) que la app consulta para autoactualizarse.

.PARAMETER Bump
    Que parte de la version subir si no pasas -Version a mano.
    patch = arreglos, minor = funciones nuevas, major = cambios grandes/rotos.
    Default: patch.

.PARAMETER Version
    Version exacta a taguear (sin la "v"), por ejemplo "1.9.0".
    Si la pasas, ignora -Bump.

.PARAMETER Message
    Mensaje del commit. Si no lo pasas, te lo pregunta.

.PARAMETER SkipTypeCheck
    Salta el chequeo de "npx tsc --noEmit" antes de commitear.

.EXAMPLE
    .\scripts\publish.ps1
    Sube un patch (arreglo) y te pregunta el mensaje del commit.

.EXAMPLE
    .\scripts\publish.ps1 -Bump minor -Message "Modo online/offline + idioma de MangaDex"
    Sube un minor (funcion nueva) sin preguntar el mensaje.

.EXAMPLE
    .\scripts\publish.ps1 -Version 2.0.0 -Message "Rediseno completo"
    Fuerza una version puntual en vez de calcularla sola.
#>

[CmdletBinding()]
param(
    [ValidateSet('patch', 'minor', 'major')]
    [string]$Bump = 'patch',

    [string]$Version,

    [string]$Message,

    [switch]$SkipTypeCheck
)

$ErrorActionPreference = 'Stop'

function Fail([string]$msg) {
    Write-Host ""
    Write-Host "ABORTADO: $msg" -ForegroundColor Red
    exit 1
}

function Step([string]$msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

# --- 1. Correr desde la raiz del repo --------------------------------------
if (-not (Test-Path ".git")) {
    Fail "Corre este script desde la raiz del repo (donde esta la carpeta .git), ej: .\scripts\publish.ps1"
}

# --- 2. Un index.lock viejo rompe todo lo que sigue -------------------------
if (Test-Path ".git\index.lock") {
    Fail ".git\index.lock existe (quedo una operacion de git colgada). Borralo con `"Remove-Item .git\index.lock -Force`" y reintenta."
}

# --- 3. El .env con el token nunca se sube -----------------------------------
Step "Chequeando que .env no este trackeado por git..."
$envTracked = git ls-files ".env"
if ($envTracked) {
    Fail ".env esta trackeado por git (tiene tu token). Sacalo con `"git rm --cached .env`" antes de seguir."
}

# --- 4. Rama y estado del working tree ---------------------------------------
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "Rama actual: $branch"

Step "Estado del repo (git status):"
git status --short
Write-Host ""

$statusLines = git status --porcelain
if (-not $statusLines) {
    Fail "No hay cambios para commitear. No hace falta publicar nada."
}

$confirmStatus = Read-Host "Revisa la lista de arriba. ¿Seguimos? (s/n)"
if ($confirmStatus -ne 's') {
    Fail "Cancelado por vos."
}

# --- 5. Chequeo de tipos (opcional) -------------------------------------------
if (-not $SkipTypeCheck) {
    Step "Corriendo npx tsc --noEmit..."
    npx tsc --noEmit
    if ($LASTEXITCODE -ne 0) {
        Fail "tsc encontro errores de tipos. Arreglalos antes de publicar (o corre con -SkipTypeCheck si estas seguro de que esta bien)."
    }
} else {
    Write-Host "Salteando el chequeo de tipos (-SkipTypeCheck)." -ForegroundColor Yellow
}

# --- 6. Calcular la proxima version -------------------------------------------
function Get-LatestTag {
    $tag = git describe --tags --abbrev=0 --match "v*.*.*" 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $tag) {
        return $null
    }
    return $tag.Trim()
}

function Get-BumpedVersion([string]$current, [string]$part) {
    $parts = $current.TrimStart('v').Split('.')
    $maj = [int]$parts[0]
    $min = [int]$parts[1]
    $pat = [int]$parts[2]
    switch ($part) {
        'major' { $maj++; $min = 0; $pat = 0 }
        'minor' { $min++; $pat = 0 }
        'patch' { $pat++ }
    }
    return "$maj.$min.$pat"
}

$latestTag = Get-LatestTag
if ($Version) {
    $nextVersion = $Version.TrimStart('v')
} elseif ($latestTag) {
    $nextVersion = Get-BumpedVersion -current $latestTag -part $Bump
} else {
    $nextVersion = "1.0.0"
}
$nextTag = "v$nextVersion"

Write-Host ""
if ($latestTag) {
    Write-Host "Ultimo tag publicado: $latestTag"
} else {
    Write-Host "No hay tags publicados todavia en este checkout."
}
Write-Host "Proxima version: $nextTag" -ForegroundColor Green

$existingTag = git tag -l $nextTag
if ($existingTag) {
    Fail "El tag $nextTag ya existe. Pasa -Version con otro numero, ej: -Version 1.9.1"
}

# --- 7. Mensaje del commit -----------------------------------------------------
if (-not $Message) {
    $Message = Read-Host "Mensaje del commit"
}
if (-not $Message) {
    Fail "Hace falta un mensaje de commit."
}

# --- 8. Confirmacion final ------------------------------------------------------
Write-Host ""
Write-Host "Se va a hacer:" -ForegroundColor Cyan
Write-Host "  git add -A"
Write-Host "  git commit -m `"$Message`""
Write-Host "  git tag $nextTag"
Write-Host "  git push origin $branch --tags"
Write-Host ""
$confirmFinal = Read-Host "¿Confirmas? (s/n)"
if ($confirmFinal -ne 's') {
    Fail "Cancelado por vos."
}

# --- 9. Ejecutar -------------------------------------------------------------------
Step "git add -A"
git add -A

Step "git commit"
git commit -m $Message
if ($LASTEXITCODE -ne 0) {
    Fail "El commit fallo (mira el mensaje de git de arriba - puede ser un hook)."
}

Step "git tag $nextTag"
git tag $nextTag

Step "git push origin $branch --tags"
git push origin $branch --tags
if ($LASTEXITCODE -ne 0) {
    Fail "El push fallo. El tag $nextTag quedo creado LOCAL. Si vas a reintentar, borralo primero con: git tag -d $nextTag"
}

Write-Host ""
Write-Host "Listo. $nextTag esta pusheado." -ForegroundColor Green
Write-Host "El workflow de release deberia dispararse solo en:"
Write-Host "  https://github.com/Souto751/TinManga/actions"
