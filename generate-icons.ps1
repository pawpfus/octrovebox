# generate-icons.ps1 — draws the COIN QUEST app icon: an 8-bit pixel-art octopus.
# A 16x16 pixel map is rendered, then scaled up with nearest-neighbor (no
# smoothing) so the pixels stay crisp at every size.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$dir = $PSScriptRoot

# 16x16 pixel map.  legend:
#   . transparent (shows navy background)   X dark outline
#   B body (purple)   D darker body / tentacle tips
#   W eye white       K pupil
$MAP = @(
  '................',
  '.....XXXXXX.....',
  '...XXBBBBBBXX...',
  '..XBBBBBBBBBBX..',
  '.XBBBBBBBBBBBBX.',
  '.XBBBBBBBBBBBBX.',
  '.XBBWWBBBBWWBBX.',
  '.XBBWKBBBBKWBBX.',
  '.XBBBBBBBBBBBBX.',
  '.XBBBBBBBBBBBBX.',
  '.XBBBBBBBBBBBBX.',
  '.XBBBBBBBBBBBBX.',
  '.BB.BB.BB.BB.BB.',
  '.DD.DD.DD.DD.DD.',
  '................',
  '................'
)

$COLORS = @{
  'X' = '#7a4f00'  # outline (dark bronze)
  'B' = '#ffd23f'  # body (gold)
  'D' = '#c98a00'  # shade / tentacle tips (deep gold)
  'W' = '#ffffff'  # eye white
  'K' = '#3a2400'  # pupil
}
$NAVY = [System.Drawing.ColorTranslator]::FromHtml('#161635')

# build the crisp 16x16 source sprite
$src = New-Object System.Drawing.Bitmap(16, 16)
for ($y = 0; $y -lt 16; $y++) {
  $row = $MAP[$y]
  for ($x = 0; $x -lt 16; $x++) {
    $ch = $row[$x]
    if ($ch -eq '.') {
      $src.SetPixel($x, $y, $NAVY)
    } else {
      $src.SetPixel($x, $y, [System.Drawing.ColorTranslator]::FromHtml($COLORS["$ch"]))
    }
  }
}

function New-Icon($size, $path) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear($NAVY)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::None

  # draw the sprite into the centre ~88% (maskable safe zone)
  $inner = [int]($size * 0.88)
  $off   = [int](($size - $inner) / 2)
  $dst = New-Object System.Drawing.Rectangle($off, $off, $inner, $inner)
  $g.DrawImage($src, $dst, 0, 0, 16, 16, [System.Drawing.GraphicsUnit]::Pixel)

  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "  $path ($size x $size)"
}

Write-Host "Generating octopus icons..."
New-Icon 512 (Join-Path $dir 'icon-512.png')
New-Icon 192 (Join-Path $dir 'icon-192.png')
New-Icon 180 (Join-Path $dir 'apple-touch-icon.png')
New-Icon 32  (Join-Path $dir 'favicon-32.png')
$src.Dispose()
Write-Host "Done."
