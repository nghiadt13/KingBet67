Add-Type -AssemblyName System.Drawing

$baseDir = 'D:/Education/MMA301/KingBet67/assets/images'

function New-Canvas($w, $h) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  return @{ Bitmap = $bmp; Graphics = $g }
}

function Save-Png($bmp, $path) {
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

$dark = [System.Drawing.Color]::FromArgb(255, 11, 17, 32)
$dark2 = [System.Drawing.Color]::FromArgb(255, 22, 31, 50)
$green = [System.Drawing.Color]::FromArgb(255, 173, 255, 47)
$greenSoft = [System.Drawing.Color]::FromArgb(255, 123, 214, 35)
$white = [System.Drawing.Color]::FromArgb(255, 245, 248, 255)

function Draw-MainBrand($w, $h, $outputPath) {
  $ctx = New-Canvas $w $h
  $bmp = $ctx.Bitmap
  $g = $ctx.Graphics

  $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
  $lg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $dark, $dark2, 45)
  $g.FillRectangle($lg, $rect)

  $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(70, 0, 0, 0))
  $ringBrush = New-Object System.Drawing.SolidBrush($green)
  $innerBrush = New-Object System.Drawing.SolidBrush($dark)
  $textBrush = New-Object System.Drawing.SolidBrush($white)
  $dotBrush = New-Object System.Drawing.SolidBrush($greenSoft)
  $dotInner = New-Object System.Drawing.SolidBrush($dark)

  $g.FillEllipse($shadowBrush, [float]($w * 0.16), [float]($h * 0.16), [float]($w * 0.72), [float]($h * 0.72))
  $g.FillEllipse($ringBrush, [float]($w * 0.18), [float]($h * 0.18), [float]($w * 0.64), [float]($h * 0.64))
  $g.FillEllipse($innerBrush, [float]($w * 0.24), [float]($h * 0.24), [float]($w * 0.52), [float]($h * 0.52))

  $fontSize = [float]($w * 0.2)
  $font = New-Object System.Drawing.Font('Segoe UI Black', $fontSize, [System.Drawing.FontStyle]::Bold)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $textRect = New-Object System.Drawing.RectangleF([float]($w * 0.12), [float]($h * 0.31), [float]($w * 0.76), [float]($h * 0.34))
  $g.DrawString('K67', $font, $textBrush, $textRect, $sf)

  $g.FillEllipse($dotBrush, [float]($w * 0.43), [float]($h * 0.68), [float]($w * 0.14), [float]($h * 0.14))
  $g.FillEllipse($dotInner, [float]($w * 0.47), [float]($h * 0.72), [float]($w * 0.06), [float]($h * 0.06))

  Save-Png $bmp $outputPath

  $font.Dispose(); $sf.Dispose(); $lg.Dispose(); $shadowBrush.Dispose(); $ringBrush.Dispose(); $innerBrush.Dispose(); $textBrush.Dispose(); $dotBrush.Dispose(); $dotInner.Dispose(); $g.Dispose(); $bmp.Dispose()
}

Draw-MainBrand 1024 1024 (Join-Path $baseDir 'icon.png')
Draw-MainBrand 1024 1024 (Join-Path $baseDir 'splash-icon.png')

$ctxF = New-Canvas 432 432
$bmpF = $ctxF.Bitmap
$gF = $ctxF.Graphics
$gF.Clear([System.Drawing.Color]::Transparent)
$ringBrushF = New-Object System.Drawing.SolidBrush($green)
$innerBrushF = New-Object System.Drawing.SolidBrush($dark)
$whiteBrushF = New-Object System.Drawing.SolidBrush($white)
$ballBrush = New-Object System.Drawing.SolidBrush($greenSoft)
$gF.FillEllipse($ringBrushF, 74, 74, 284, 284)
$gF.FillEllipse($innerBrushF, 106, 106, 220, 220)
$fontF = New-Object System.Drawing.Font('Segoe UI Black', 84, [System.Drawing.FontStyle]::Bold)
$sfF = New-Object System.Drawing.StringFormat
$sfF.Alignment = [System.Drawing.StringAlignment]::Center
$sfF.LineAlignment = [System.Drawing.StringAlignment]::Center
$textRectF = New-Object System.Drawing.RectangleF(86, 130, 260, 150)
$gF.DrawString('K67', $fontF, $whiteBrushF, $textRectF, $sfF)
$gF.FillEllipse($ballBrush, 183, 289, 66, 66)
Save-Png $bmpF (Join-Path $baseDir 'android-icon-foreground.png')
$ringBrushF.Dispose(); $innerBrushF.Dispose(); $whiteBrushF.Dispose(); $fontF.Dispose(); $sfF.Dispose(); $ballBrush.Dispose(); $gF.Dispose(); $bmpF.Dispose()

$ctxB = New-Canvas 432 432
$bmpB = $ctxB.Bitmap
$gB = $ctxB.Graphics
$rectB = New-Object System.Drawing.Rectangle(0, 0, 432, 432)
$lgB = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rectB, $dark, $dark2, 55)
$stripe = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(36, 173, 255, 47))
$gB.FillRectangle($lgB, $rectB)
$gB.FillRectangle($stripe, 0, 300, 432, 120)
Save-Png $bmpB (Join-Path $baseDir 'android-icon-background.png')
$lgB.Dispose(); $stripe.Dispose(); $gB.Dispose(); $bmpB.Dispose()

$ctxM = New-Canvas 432 432
$bmpM = $ctxM.Bitmap
$gM = $ctxM.Graphics
$gM.Clear([System.Drawing.Color]::Transparent)
$mono = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$gM.FillEllipse($mono, 74, 74, 284, 284)
$gM.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$transparentBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Transparent)
$gM.FillEllipse($transparentBrush, 116, 116, 200, 200)
$gM.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
$fontM = New-Object System.Drawing.Font('Segoe UI Black', 84, [System.Drawing.FontStyle]::Bold)
$sfM = New-Object System.Drawing.StringFormat
$sfM.Alignment = [System.Drawing.StringAlignment]::Center
$sfM.LineAlignment = [System.Drawing.StringAlignment]::Center
$textRectM = New-Object System.Drawing.RectangleF(86, 130, 260, 150)
$gM.DrawString('K67', $fontM, $mono, $textRectM, $sfM)
Save-Png $bmpM (Join-Path $baseDir 'android-icon-monochrome.png')
$mono.Dispose(); $transparentBrush.Dispose(); $fontM.Dispose(); $sfM.Dispose(); $gM.Dispose(); $bmpM.Dispose()

Draw-MainBrand 64 64 (Join-Path $baseDir 'favicon.png')

Write-Output 'Icon assets regenerated cleanly.'
