# generate-icons.ps1 — draws the COIN QUEST app icons (pixel gold coin) as PNGs.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$dir = $PSScriptRoot

function New-Icon($size, $path) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $navy   = [System.Drawing.ColorTranslator]::FromHtml('#161635')
  $gold   = [System.Drawing.ColorTranslator]::FromHtml('#ffd23f')
  $goldDk = [System.Drawing.ColorTranslator]::FromHtml('#c98a00')
  $shadow = [System.Drawing.ColorTranslator]::FromHtml('#050510')

  $g.Clear($navy)

  $cx = $size / 2; $cy = $size / 2
  $r  = $size * 0.33
  $off = [int]($size * 0.022)

  # hard pixel shadow
  $bShadow = New-Object System.Drawing.SolidBrush($shadow)
  $g.FillEllipse($bShadow, $cx - $r + $off, $cy - $r + $off, 2 * $r, 2 * $r)

  # coin body
  $bGold = New-Object System.Drawing.SolidBrush($gold)
  $g.FillEllipse($bGold, $cx - $r, $cy - $r, 2 * $r, 2 * $r)

  # inner ring
  $pen = New-Object System.Drawing.Pen($goldDk, [single]($size * 0.03))
  $ir = $r * 0.74
  $g.DrawEllipse($pen, $cx - $ir, $cy - $ir, 2 * $ir, 2 * $ir)

  # $ glyph
  $bDk = New-Object System.Drawing.SolidBrush($goldDk)
  $font = New-Object System.Drawing.Font('Arial', [single]($size * 0.36), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
  $g.DrawString('$', $font, $bDk, $rect, $sf)

  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "  $path ($size x $size)"
}

Write-Host "Generating icons..."
New-Icon 512 (Join-Path $dir 'icon-512.png')
New-Icon 192 (Join-Path $dir 'icon-192.png')
New-Icon 180 (Join-Path $dir 'apple-touch-icon.png')
New-Icon 32  (Join-Path $dir 'favicon-32.png')
Write-Host "Done."
