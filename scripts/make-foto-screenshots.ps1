Add-Type -AssemblyName System.Drawing

$fotoDir = "c:\Users\New\Desktop\hesap\foto"
if (!(Test-Path $fotoDir)) {
    New-Item -ItemType Directory -Path $fotoDir | Out-Null
}

$inputImages = @(
    "C:\Users\New\.gemini\antigravity\brain\30c33556-f3fe-4fc6-b903-577b60a56b4f\.user_uploaded\media_1787247579182.jpg",
    "C:\Users\New\.gemini\antigravity\brain\30c33556-f3fe-4fc6-b903-577b60a56b4f\.user_uploaded\media_1787247579187.jpg",
    "C:\Users\New\.gemini\antigravity\brain\30c33556-f3fe-4fc6-b903-577b60a56b4f\.user_uploaded\media_1787247579256.jpg"
)

$names = @("1_Giris", "2_MesaiQR", "3_Vardiyam")

# Target sizes
# iPhone 6.5-inch: 1242 x 2688
# iPad 13-inch: 2048 x 2732

function Create-AppStoreScreenshot($srcPath, $targetW, $targetH, $outputPath) {
    $srcImg = [System.Drawing.Image]::FromFile($srcPath)
    $bitmap = New-Object System.Drawing.Bitmap($targetW, $targetH)
    $g = [System.Drawing.Graphics]::FromImage($bitmap)

    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Dark background #090d16
    $bgColor = [System.Drawing.Color]::FromArgb(255, 9, 13, 22)
    $brush = New-Object System.Drawing.SolidBrush($bgColor)
    $g.FillRectangle($brush, 0, 0, $targetW, $targetH)

    # Scale image to fit inside target keeping aspect ratio
    $scaleW = $targetW / $srcImg.Width
    $scaleH = $targetH / $srcImg.Height
    $scale = [Math]::Min($scaleW, $scaleH)

    # Make scaled dimensions
    $drawW = [int]($srcImg.Width * $scale)
    $drawH = [int]($srcImg.Height * $scale)

    $posX = [int](($targetW - $drawW) / 2)
    $posY = [int](($targetH - $drawH) / 2)

    $g.DrawImage($srcImg, $posX, $posY, $drawW, $drawH)

    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose()
    $bitmap.Dispose()
    $srcImg.Dispose()
    Write-Host "Created: $outputPath ($targetW x $targetH)"
}

for ($i = 0; $i -lt $inputImages.Count; $i++) {
    $src = $inputImages[$i]
    $name = $names[$i]

    # iPhone 6.5-inch (1242x2688)
    $iphonePath = Join-Path $fotoDir "iPhone_6.5_$name.png"
    Create-AppStoreScreenshot $src 1242 2688 $iphonePath

    # iPad 13-inch (2048x2732)
    $ipadPath = Join-Path $fotoDir "iPad_13_$name.png"
    Create-AppStoreScreenshot $src 2048 2732 $ipadPath
}

Write-Host "ALL PHOTOS SUCCESSFULLY GENERATED IN foto FOLDER!"
